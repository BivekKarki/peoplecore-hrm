import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'headcount';

  try {
    let data: unknown = null;

    switch (type) {
      case 'headcount':
        data = (await query(`
          SELECT
            department,
            COUNT(*)::int                                              AS total,
            COUNT(*) FILTER (WHERE employment_type='full-time')::int  AS full_time,
            COUNT(*) FILTER (WHERE employment_type='part-time')::int  AS part_time,
            COUNT(*) FILTER (WHERE employment_type='contract')::int   AS contract,
            COUNT(*) FILTER (WHERE employment_type='casual')::int     AS casual,
            ROUND(AVG(salary))::int                                   AS avg_salary,
            SUM(salary)::bigint                                       AS total_salary_cost
          FROM employees
          WHERE status != 'inactive'
          GROUP BY department
          ORDER BY total DESC
        `)).rows;
        break;

      case 'payroll':
        data = (await query(`
          SELECT
            TO_CHAR(pr.period_start, 'Mon YYYY') AS period,
            pr.status,
            pr.employee_count,
            pr.total_gross,
            pr.total_tax,
            pr.total_super,
            pr.total_net,
            pr.pay_date
          FROM payroll_runs pr
          ORDER BY pr.period_start DESC
          LIMIT 12
        `)).rows;
        break;

      case 'attendance':
        data = (await query(`
          SELECT
            e.first_name || ' ' || e.last_name AS employee_name,
            e.department,
            COUNT(*) FILTER (WHERE a.status='present')::int  AS present_days,
            COUNT(*) FILTER (WHERE a.status='absent')::int   AS absent_days,
            COUNT(*) FILTER (WHERE a.status='late')::int     AS late_days,
            ROUND(AVG(a.hours_worked)::numeric, 2)           AS avg_hours,
            ROUND(
              COUNT(*) FILTER (WHERE a.status='present')::numeric /
              NULLIF(COUNT(*), 0) * 100, 1
            )                                                AS attendance_rate
          FROM employees e
          LEFT JOIN attendance a ON a.employee_id = e.id
            AND a.date >= CURRENT_DATE - INTERVAL '30 days'
          WHERE e.status != 'inactive'
          GROUP BY e.id, e.first_name, e.last_name, e.department
          ORDER BY attendance_rate ASC NULLS LAST
        `)).rows;
        break;

      case 'leave':
        data = (await query(`
          SELECT
            e.first_name || ' ' || e.last_name AS employee_name,
            e.department,
            COUNT(*) FILTER (WHERE lr.leave_type='annual')::int       AS annual_taken,
            COUNT(*) FILTER (WHERE lr.leave_type='sick')::int         AS sick_taken,
            COUNT(*) FILTER (WHERE lr.status='pending')::int          AS pending_requests,
            COUNT(*) FILTER (WHERE lr.status='approved')::int         AS approved_requests,
            SUM(lr.days) FILTER (WHERE lr.status='approved')::int     AS total_days_approved
          FROM employees e
          LEFT JOIN leave_requests lr ON lr.employee_id = e.id
          WHERE e.status != 'inactive'
          GROUP BY e.id, e.first_name, e.last_name, e.department
          ORDER BY total_days_approved DESC NULLS LAST
        `)).rows;
        break;

      case 'performance':
        data = (await query(`
          SELECT
            e.first_name || ' ' || e.last_name  AS employee_name,
            e.department,
            e.job_title,
            ROUND(AVG(pr.rating)::numeric, 1)   AS avg_rating,
            ROUND(AVG(pr.kpi_achievement)::numeric, 1) AS avg_kpi,
            COUNT(pr.id)::int                   AS review_count,
            MAX(pr.created_at)                  AS last_reviewed
          FROM employees e
          LEFT JOIN performance_reviews pr ON pr.employee_id = e.id
          WHERE e.status = 'active'
          GROUP BY e.id, e.first_name, e.last_name, e.department, e.job_title
          ORDER BY avg_rating DESC NULLS LAST
        `)).rows;
        break;

      case 'compliance':
        data = (await query(`
          SELECT
            e.first_name || ' ' || e.last_name AS employee_name,
            e.department,
            e.employment_type,
            e.tax_file_number IS NOT NULL       AS has_tfn,
            e.bank_account IS NOT NULL          AS has_bank,
            e.super_fund IS NOT NULL            AS has_super,
            COALESCE(i.status,'not_started')    AS induction_status,
            e.face_enrolled,
            e.start_date
          FROM employees e
          LEFT JOIN inductions i ON i.employee_id = e.id
          WHERE e.status != 'inactive'
          ORDER BY e.start_date DESC
        `)).rows;
        break;

      default:
        return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
    }

    return NextResponse.json({ data, type });
  } catch (err) {
    console.error('[Reports GET]', err);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
