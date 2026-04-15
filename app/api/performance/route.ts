import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';
import { PerformanceReview } from '@/types';

export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const employee_id = searchParams.get('employee_id');
  const period = searchParams.get('period');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (employee_id) { conditions.push(`pr.employee_id = $${idx++}`); params.push(employee_id); }
  if (period)      { conditions.push(`pr.review_period = $${idx++}`); params.push(period); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const res = await query<PerformanceReview>(
      `SELECT pr.*,
              e.first_name || ' ' || e.last_name AS employee_name,
              a.name AS reviewer_name
       FROM performance_reviews pr
       JOIN employees e ON e.id = pr.employee_id
       JOIN admin_users a ON a.id = pr.reviewer_id
       ${where}
       ORDER BY pr.created_at DESC`,
      params
    );
    return NextResponse.json({ data: res.rows });
  } catch (err) {
    console.error('[Performance GET]', err);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const {
      employee_id, review_period, rating,
      kpi_achievement, goals_met, comments,
      strengths, improvements, next_review_date, salary_adjustment,
    } = body;

    if (!employee_id)   return NextResponse.json({ error: 'Employee required' }, { status: 400 });
    if (!review_period) return NextResponse.json({ error: 'Review period required' }, { status: 400 });
    if (!rating || rating < 1 || rating > 5) return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    if (!comments?.trim()) return NextResponse.json({ error: 'Comments required' }, { status: 400 });

    const res = await query<PerformanceReview>(
      `INSERT INTO performance_reviews
         (employee_id, reviewer_id, review_period, rating, kpi_achievement,
          goals_met, comments, strengths, improvements, next_review_date, salary_adjustment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        employee_id, user!.id, review_period, rating,
        kpi_achievement ?? 0, goals_met ?? 0, comments.trim(),
        strengths || null, improvements || null,
        next_review_date || null, salary_adjustment || null,
      ]
    );

    return NextResponse.json({ data: res.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[Performance POST]', err);
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}
