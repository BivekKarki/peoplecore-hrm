import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';

// GET /api/shifts?week=2025-04-07&employee_id=xxx&department=Engineering
export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const week        = searchParams.get('week');       // Monday of the week YYYY-MM-DD
  const employee_id = searchParams.get('employee_id');
  const department  = searchParams.get('department');
  const date_from   = searchParams.get('date_from');
  const date_to     = searchParams.get('date_to');

  const conditions: string[] = [];
  const params: unknown[]    = [];
  let idx = 1;

  if (week) {
    // Show full week Mon-Sun
    conditions.push(`s.shift_date >= $${idx++} AND s.shift_date < $${idx++}`);
    const mon = new Date(week);
    const sun = new Date(week);
    sun.setDate(sun.getDate() + 7);
    params.push(mon.toISOString().split('T')[0], sun.toISOString().split('T')[0]);
  } else if (date_from && date_to) {
    conditions.push(`s.shift_date >= $${idx++} AND s.shift_date <= $${idx++}`);
    params.push(date_from, date_to);
  } else {
    // Default: next 14 days
    conditions.push(`s.shift_date >= CURRENT_DATE AND s.shift_date < CURRENT_DATE + 14`);
  }

  if (employee_id) { conditions.push(`s.employee_id = $${idx++}`); params.push(employee_id); }
  if (department)  { conditions.push(`e.department = $${idx++}`);  params.push(department); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [shiftsRes, templatesRes] = await Promise.all([
      query<{
        id: string; employee_id: string; shift_date: string;
        start_time: string; end_time: string; break_mins: number;
        status: string; location: string | null; notes: string | null;
        first_name: string; last_name: string; department: string;
        avatar_color: string; template_name: string | null; template_color: string | null;
      }>(
        `SELECT s.*,
                e.first_name, e.last_name, e.department, e.avatar_color,
                st.name AS template_name, st.color AS template_color
         FROM shifts s
         JOIN employees e ON e.id = s.employee_id
         LEFT JOIN shift_templates st ON st.id = s.shift_template_id
         ${where}
         ORDER BY s.shift_date ASC, s.start_time ASC`,
        params
      ),
      query('SELECT * FROM shift_templates WHERE is_active = TRUE ORDER BY start_time'),
    ]);

    return NextResponse.json({
      shifts:    shiftsRes.rows,
      templates: templatesRes.rows,
    });
  } catch (err) {
    console.error('[Shifts GET]', err);
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 });
  }
}

// POST /api/shifts — create one or bulk shifts
export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();

    // Support bulk: { shifts: [...] } or single shift
    const items = body.shifts ?? [body];

    if (!items.length) {
      return NextResponse.json({ error: 'No shifts provided' }, { status: 400 });
    }

    const created = [];
    for (const item of items) {
      const { employee_id, shift_template_id, shift_date, start_time, end_time, break_mins, location, notes } = item;

      if (!employee_id || !shift_date || !start_time || !end_time) {
        continue; // skip invalid entries
      }

      // If template provided, use its times unless overridden
      let finalStart = start_time;
      let finalEnd   = end_time;
      let finalBreak = break_mins ?? 30;

      if (shift_template_id && (!start_time || !end_time)) {
        const tmpl = await query<{ start_time: string; end_time: string; break_mins: number }>(
          'SELECT start_time, end_time, break_mins FROM shift_templates WHERE id = $1',
          [shift_template_id]
        );
        if (tmpl.rowCount) {
          finalStart = tmpl.rows[0].start_time;
          finalEnd   = tmpl.rows[0].end_time;
          finalBreak = tmpl.rows[0].break_mins;
        }
      }

      const res = await query(
        `INSERT INTO shifts
           (employee_id, shift_template_id, shift_date, start_time, end_time, break_mins, location, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [employee_id, shift_template_id || null, shift_date, finalStart, finalEnd, finalBreak, location || null, notes || null, user!.id]
      );
      if (res.rowCount) created.push(res.rows[0]);
    }

    return NextResponse.json({ data: created, count: created.length }, { status: 201 });
  } catch (err) {
    console.error('[Shifts POST]', err);
    return NextResponse.json({ error: 'Failed to create shift(s)' }, { status: 500 });
  }
}

// DELETE /api/shifts?id=xxx
export async function DELETE(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Shift ID required' }, { status: 400 });

  try {
    await query('DELETE FROM shifts WHERE id = $1', [id]);
    return NextResponse.json({ message: 'Shift deleted' });
  } catch (err) {
    console.error('[Shifts DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 });
  }
}
