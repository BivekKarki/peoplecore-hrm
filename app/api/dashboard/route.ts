import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';
import { DashboardStats, DepartmentCount } from '@/types';

export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const [statsRes, deptRes, hiringRes] = await Promise.all([
      query<DashboardStats>(`
        SELECT
          COUNT(*)::int                                                    AS total_employees,
          COUNT(*) FILTER (WHERE status = 'active')::int                  AS active_employees,
          COUNT(*) FILTER (WHERE status = 'on_leave')::int                AS on_leave,
          (SELECT COUNT(*)::int FROM inductions WHERE status != 'completed') AS pending_inductions,
          (SELECT COUNT(*)::int FROM attendance WHERE date = CURRENT_DATE AND status = 'present') AS present_today,
          (SELECT COUNT(*)::int FROM attendance WHERE date = CURRENT_DATE AND status = 'absent')  AS absent_today,
          (SELECT COALESCE(SUM(salary),0) FROM employees WHERE status = 'active') / 12            AS monthly_payroll,
          (SELECT COUNT(*)::int FROM leave_requests WHERE status = 'pending')                     AS pending_leaves,
          COUNT(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', NOW()))::int AS new_this_month
        FROM employees
      `),
      query<DepartmentCount>(`
        SELECT
          department,
          COUNT(*)::int           AS count,
          AVG(salary)::int        AS avg_salary
        FROM employees
        WHERE status != 'inactive'
        GROUP BY department
        ORDER BY count DESC
      `),
      query<{ month: string; count: number }>(`
        SELECT
          TO_CHAR(created_at, 'Mon') AS month,
          COUNT(*)::int              AS count
        FROM employees
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at), TO_CHAR(created_at, 'Mon')
        ORDER BY DATE_TRUNC('month', created_at)
      `),
    ]);

    return NextResponse.json({
      stats: statsRes.rows[0] ?? {},
      departments: deptRes.rows,
      hiring: hiringRes.rows,
    });
  } catch (err) {
    console.error('[Dashboard API]', err);
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
  }
}
