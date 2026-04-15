import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Public endpoint — mobile app polls this with employee_id
// In production, secure with a mobile JWT token
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employee_id = searchParams.get('employee_id');

  if (!employee_id) {
    return NextResponse.json({ error: 'employee_id required' }, { status: 400 });
  }

  try {
    // Employee profile
    const empRes = await query<{
      id: string; first_name: string; last_name: string;
      employee_id: string; department: string; job_title: string;
      status: string; avatar_color: string; email: string;
    }>(
      `SELECT id, first_name, last_name, employee_id, department,
              job_title, status, avatar_color, email
       FROM employees WHERE id = $1`,
      [employee_id]
    );

    if (!empRes.rowCount) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const employee = empRes.rows[0];

    // Today's session
    const sessionRes = await query<{
      id: string; check_in: string; check_out: string | null;
      duration_mins: number | null; status: string; session_date: string;
    }>(
      `SELECT id, check_in, check_out, duration_mins, status, session_date
       FROM work_sessions
       WHERE employee_id = $1 AND session_date = CURRENT_DATE`,
      [employee_id]
    );

    const session = sessionRes.rows[0] ?? null;

    // Last 7 days sessions
    const historyRes = await query<{
      session_date: string; check_in: string; check_out: string | null;
      duration_mins: number | null; status: string;
    }>(
      `SELECT session_date, check_in, check_out, duration_mins, status
       FROM work_sessions
       WHERE employee_id = $1
       ORDER BY session_date DESC
       LIMIT 7`,
      [employee_id]
    );

    // Leave balance (simplified)
    const leaveRes = await query<{
      leave_type: string; total_days: number;
    }>(
      `SELECT leave_type, SUM(days) as total_days
       FROM leave_requests
       WHERE employee_id = $1 AND status = 'approved'
         AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM NOW())
       GROUP BY leave_type`,
      [employee_id]
    );

    // Pending leave requests
    const pendingLeaveRes = await query(
      `SELECT id, leave_type, start_date, end_date, days, status
       FROM leave_requests
       WHERE employee_id = $1 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 5`,
      [employee_id]
    );

    // Calculate today's hours if active
    let todayHours = 0;
    if (session?.status === 'active' && session.check_in) {
      const diff = Date.now() - new Date(session.check_in).getTime();
      todayHours = Math.round((diff / 1000 / 60 / 60) * 100) / 100;
    } else if (session?.duration_mins) {
      todayHours = Math.round((session.duration_mins / 60) * 100) / 100;
    }

    return NextResponse.json({
      employee,
      today: {
        date: new Date().toISOString().split('T')[0],
        session,
        hours_worked: todayHours,
        is_checked_in: session?.status === 'active',
      },
      history: historyRes.rows,
      leave: {
        used: leaveRes.rows,
        pending: pendingLeaveRes.rows,
      },
      server_time: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Mobile API]', err);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
