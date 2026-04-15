import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET — fetch today's sessions or a specific employee's session
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employee_id = searchParams.get('employee_id');
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];

  try {
    const conditions = ['ws.session_date = $1'];
    const params: unknown[] = [date];
    let idx = 2;

    if (employee_id) {
      conditions.push(`ws.employee_id = $${idx++}`);
      params.push(employee_id);
    }

    const res = await query<{
      id: string;
      employee_id: string;
      session_date: string;
      check_in: string;
      check_out: string | null;
      duration_mins: number | null;
      status: string;
      first_name: string;
      last_name: string;
      department: string;
      job_title: string;
    }>(
      `SELECT ws.*, e.first_name, e.last_name, e.department, e.job_title
       FROM work_sessions ws
       JOIN employees e ON e.id = ws.employee_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ws.check_in DESC`,
      params
    );

    return NextResponse.json({ data: res.rows });
  } catch (err) {
    console.error('[Sessions GET]', err);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// POST — check in (start work)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employee_id, device_id, check_in_photo } = body;

    if (!employee_id) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    // Check if already checked in today
    const existing = await query<{ id: string; status: string; check_in: string }>(
      `SELECT id, status, check_in FROM work_sessions
       WHERE employee_id = $1 AND session_date = CURRENT_DATE`,
      [employee_id]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      const session = existing.rows[0];
      if (session.status === 'active') {
        return NextResponse.json({
          error: 'Already checked in',
          session,
          already_checked_in: true,
        }, { status: 409 });
      }
    }

    // Create new session
    const res = await query<{
      id: string;
      employee_id: string;
      session_date: string;
      check_in: string;
      status: string;
    }>(
      `INSERT INTO work_sessions (employee_id, check_in, status, device_id, check_in_photo)
       VALUES ($1, NOW(), 'active', $2, $3)
       ON CONFLICT (employee_id, session_date)
       DO UPDATE SET check_in = NOW(), status = 'active', device_id = $2
       RETURNING *`,
      [employee_id, device_id ?? null, check_in_photo ?? null]
    );

    // Also record in attendance table
    await query(
      `INSERT INTO attendance (employee_id, date, check_in, status, method)
       VALUES ($1, CURRENT_DATE, NOW(), 'present', 'facial')
       ON CONFLICT (employee_id, date)
       DO UPDATE SET check_in = NOW(), status = 'present', method = 'facial'`,
      [employee_id]
    );

    return NextResponse.json({
      message: 'Check-in successful',
      session: res.rows[0],
    }, { status: 201 });
  } catch (err) {
    console.error('[Sessions POST]', err);
    return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
  }
}

// PATCH — check out (end work)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { employee_id } = body;

    if (!employee_id) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    const res = await query<{
      id: string;
      check_in: string;
      check_out: string;
      duration_mins: number;
      status: string;
    }>(
      `UPDATE work_sessions
       SET check_out      = NOW(),
           status         = 'completed',
           duration_mins  = EXTRACT(EPOCH FROM (NOW() - check_in)) / 60,
           updated_at     = NOW()
       WHERE employee_id = $1
         AND session_date = CURRENT_DATE
         AND status = 'active'
       RETURNING *`,
      [employee_id]
    );

    if (!res.rowCount) {
      return NextResponse.json({ error: 'No active session found' }, { status: 404 });
    }

    // Update attendance check-out
    await query(
      `UPDATE attendance
       SET check_out    = NOW(),
           hours_worked = EXTRACT(EPOCH FROM (NOW() - check_in)) / 3600
       WHERE employee_id = $1 AND date = CURRENT_DATE`,
      [employee_id]
    );

    const session = res.rows[0];
    const hours = Math.floor(session.duration_mins / 60);
    const mins  = Math.round(session.duration_mins % 60);

    return NextResponse.json({
      message: 'Check-out successful',
      session,
      duration: `${hours}h ${mins}m`,
    });
  } catch (err) {
    console.error('[Sessions PATCH]', err);
    return NextResponse.json({ error: 'Failed to check out' }, { status: 500 });
  }
}
