import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';
import { LeaveRequest } from '@/types';
import { calculateLeaveDays } from '@/lib/utils';
import { sendLeaveRequestEmail, sendLeaveApprovalAlert } from '@/lib/email';

export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const status      = searchParams.get('status');
  const employee_id = searchParams.get('employee_id');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status)      { conditions.push(`lr.status = $${idx++}`);      params.push(status); }
  if (employee_id) { conditions.push(`lr.employee_id = $${idx++}`); params.push(employee_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const res = await query<LeaveRequest>(
      `SELECT lr.*,
              e.first_name || ' ' || e.last_name AS employee_name,
              a.name AS approver_name
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       LEFT JOIN admin_users a ON a.id = lr.approved_by
       ${where}
       ORDER BY lr.created_at DESC`,
      params
    );
    return NextResponse.json({ data: res.rows });
  } catch (err) {
    console.error('[Leave GET]', err);
    return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { employee_id, leave_type, start_date, end_date, reason } = body;

    if (!employee_id) return NextResponse.json({ error: 'Employee is required' },  { status: 400 });
    if (!leave_type)  return NextResponse.json({ error: 'Leave type is required' }, { status: 400 });
    if (!start_date)  return NextResponse.json({ error: 'Start date is required' }, { status: 400 });
    if (!end_date)    return NextResponse.json({ error: 'End date is required' },   { status: 400 });
    if (new Date(end_date) < new Date(start_date)) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    const days = calculateLeaveDays(start_date, end_date);

    const res = await query<LeaveRequest>(
      `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, reason)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [employee_id, leave_type, start_date, end_date, days, reason || null]
    );

    const lr = res.rows[0];

    // Fire-and-forget email notifications
    query<{ email: string; first_name: string; last_name: string }>(
      `SELECT email, first_name, last_name FROM employees WHERE id = $1`,
      [employee_id]
    ).then(async empRes => {
      const emp = empRes.rows[0];
      if (!emp) return;
      const typeLabel = leave_type.charAt(0).toUpperCase() + leave_type.slice(1).replace('_', ' ') + ' Leave';
      await sendLeaveRequestEmail({
        to: emp.email,
        firstName: emp.first_name,
        leaveType: typeLabel,
        startDate: start_date,
        endDate: end_date,
        days,
      });
      const hrEmail = process.env.HR_ADMIN_EMAIL ?? 'admin@peoplecore.com';
      await sendLeaveApprovalAlert({
        to: hrEmail,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        leaveType: typeLabel,
        startDate: start_date,
        endDate: end_date,
        days,
        leaveId: lr.id,
      });
    }).catch(console.error);

    return NextResponse.json({ data: lr }, { status: 201 });
  } catch (err) {
    console.error('[Leave POST]', err);
    return NextResponse.json({ error: 'Failed to submit leave request' }, { status: 500 });
  }
}
