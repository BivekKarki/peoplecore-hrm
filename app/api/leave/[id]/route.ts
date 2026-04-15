import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';
import { sendLeaveDecisionEmail } from '@/lib/email';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { id } = await params;

  try {
    const body = await req.json();
    const { action, denial_reason } = body;

    if (!['approve','deny','cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const status = action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'cancelled';

    const res = await query<{
      id: string; employee_id: string;
      start_date: string; end_date: string;
      days: number; leave_type: string;
    }>(
      `UPDATE leave_requests
       SET status = $1, approved_by = $2, approved_at = NOW(), denial_reason = $3
       WHERE id = $4 AND status = 'pending'
       RETURNING *`,
      [status, user!.id, denial_reason || null, id]
    );

    if (!res.rowCount) {
      return NextResponse.json({ error: 'Not found or already processed' }, { status: 404 });
    }

    const lr = res.rows[0];

    if (action === 'approve') {
      const today = new Date().toISOString().split('T')[0];
      if (today >= lr.start_date && today <= lr.end_date) {
        await query(`UPDATE employees SET status = 'on_leave' WHERE id = $1`, [lr.employee_id]);
      }
    }

    // Send decision email (fire and forget)
    query<{ email: string; first_name: string }>(
      `SELECT email, first_name FROM employees WHERE id = $1`,
      [lr.employee_id]
    ).then(async r => {
      const emp = r.rows[0];
      if (!emp) return;
      const typeLabel = lr.leave_type.charAt(0).toUpperCase() + lr.leave_type.slice(1).replace('_',' ') + ' Leave';
      await sendLeaveDecisionEmail({
        to: emp.email,
        firstName: emp.first_name,
        leaveType: typeLabel,
        startDate: lr.start_date,
        endDate: lr.end_date,
        days: lr.days,
        approved: action === 'approve',
        reason: denial_reason,
      });
    }).catch(console.error);

    return NextResponse.json({ data: res.rows[0] });
  } catch (err) {
    console.error('[Leave PATCH]', err);
    return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 });
  }
}
