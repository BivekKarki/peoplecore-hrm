import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireAuth } from '@/lib/auth';
import { hrChatbot } from '@/lib/ai';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 });
    }

    // Fetch context from DB
    const [statsRes, deptRes] = await Promise.all([
      query<{
        total: number; present_today: number;
        pending_leaves: number; monthly_payroll: number;
      }>(`
        SELECT
          COUNT(*)::int                                                     AS total,
          (SELECT COUNT(*)::int FROM attendance WHERE date=CURRENT_DATE AND status='present') AS present_today,
          (SELECT COUNT(*)::int FROM leave_requests WHERE status='pending')  AS pending_leaves,
          COALESCE(SUM(salary),0) / 12                                       AS monthly_payroll
        FROM employees WHERE status='active'
      `),
      query<{ department: string }>('SELECT DISTINCT department FROM employees ORDER BY department'),
    ]);

    const stats   = statsRes.rows[0] ?? { total: 0, present_today: 0, pending_leaves: 0, monthly_payroll: 0 };
    const depts   = deptRes.rows.map(r => r.department);

    const response = await hrChatbot(messages, {
      total_employees:  stats.total,
      present_today:    stats.present_today,
      pending_leaves:   stats.pending_leaves,
      monthly_payroll:  Number(stats.monthly_payroll),
      departments:      depts,
    });

    return NextResponse.json({ response });
  } catch (err) {
    console.error('[Chatbot POST]', err);
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 500 });
  }
}
