import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireAuth } from '@/lib/auth';
import { predictAttrition, AttritionInput } from '@/lib/ai';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    // Fetch employee data needed for attrition prediction
    const empRes = await query<{
      id: string; first_name: string; last_name: string;
      department: string; job_title: string; employment_type: string;
      salary: number; start_date: string;
    }>(`
      SELECT id, first_name, last_name, department, job_title,
             employment_type, salary, start_date
      FROM employees
      WHERE status = 'active'
      ORDER BY start_date ASC
    `);

    if (!empRes.rowCount) {
      return NextResponse.json({ data: [] });
    }

    // Enrich with attendance, leave, performance data per employee
    const enriched = await Promise.all(empRes.rows.map(async (emp) => {
      const [attRes, leaveRes, perfRes] = await Promise.all([
        query<{ absent_days: number; late_days: number }>(`
          SELECT
            COUNT(*) FILTER (WHERE status='absent')::int AS absent_days,
            COUNT(*) FILTER (WHERE status='late')::int   AS late_days
          FROM attendance
          WHERE employee_id=$1 AND date >= CURRENT_DATE - 30
        `, [emp.id]),

        query<{ total_leave_days: number }>(`
          SELECT COALESCE(SUM(days),0)::int AS total_leave_days
          FROM leave_requests
          WHERE employee_id=$1 AND status='approved'
            AND EXTRACT(YEAR FROM start_date)=EXTRACT(YEAR FROM NOW())
        `, [emp.id]),

        query<{ avg_rating: number; last_review: string }>(`
          SELECT ROUND(AVG(rating)::numeric,1) AS avg_rating,
                 MAX(created_at)::text AS last_review
          FROM performance_reviews
          WHERE employee_id=$1
        `, [emp.id]),
      ]);

      const tenureMonths = Math.floor(
        (Date.now() - new Date(emp.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30)
      );

      const lastReviewDate = perfRes.rows[0]?.last_review
        ? new Date(perfRes.rows[0].last_review)
        : null;
      const lastReviewMonthsAgo = lastReviewDate
        ? Math.floor((Date.now() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : null;

      return {
        employee_id:             emp.id,
        name:                    `${emp.first_name} ${emp.last_name}`,
        department:              emp.department,
        job_title:               emp.job_title,
        tenure_months:           tenureMonths,
        salary:                  emp.salary,
        avg_performance_rating:  perfRes.rows[0]?.avg_rating ?? null,
        leave_days_taken:        leaveRes.rows[0]?.total_leave_days ?? 0,
        absent_days_last_30:     attRes.rows[0]?.absent_days ?? 0,
        late_days_last_30:       attRes.rows[0]?.late_days ?? 0,
        last_raise_months_ago:   null, // would come from salary history table
        last_review_months_ago:  lastReviewMonthsAgo,
        employment_type:         emp.employment_type,
      } as AttritionInput;
    }));

    const predictions = await predictAttrition(enriched);

    // Sort by risk score descending
    predictions.sort((a, b) => b.risk_score - a.risk_score);

    // Merge employee names back in
    const withNames = predictions.map(p => {
      const emp = empRes.rows.find(e => e.id === p.employee_id);
      return {
        ...p,
        name:       emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
        department: emp?.department ?? '',
        job_title:  emp?.job_title ?? '',
      };
    });

    return NextResponse.json({ data: withNames });
  } catch (err) {
    console.error('[Attrition GET]', err);
    return NextResponse.json({ error: 'Attrition analysis failed' }, { status: 500 });
  }
}
