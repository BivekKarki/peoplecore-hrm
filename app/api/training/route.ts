import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';

// GET /api/training — list modules and completion status
export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const employee_id = searchParams.get('employee_id');
  const type        = searchParams.get('type') ?? 'modules'; // 'modules' | 'completions' | 'summary'

  try {
    if (type === 'modules') {
      const res = await query(
        `SELECT tm.*,
                COUNT(tc.id)::int                       AS completions_count,
                ROUND(AVG(tc.score)::numeric, 1)        AS avg_score
         FROM training_modules tm
         LEFT JOIN training_completions tc ON tc.module_id = tm.id
         GROUP BY tm.id
         ORDER BY tm.is_mandatory DESC, tm.title`
      );
      return NextResponse.json({ data: res.rows });
    }

    if (type === 'completions' && employee_id) {
      const res = await query(
        `SELECT tc.*, tm.title, tm.duration_mins, tm.is_mandatory, tm.category
         FROM training_completions tc
         JOIN training_modules tm ON tm.id = tc.module_id
         WHERE tc.employee_id = $1
         ORDER BY tc.completed_at DESC`,
        [employee_id]
      );

      // Also get pending mandatory modules
      const pending = await query(
        `SELECT tm.* FROM training_modules tm
         WHERE tm.is_mandatory = TRUE
           AND tm.id NOT IN (
             SELECT module_id FROM training_completions WHERE employee_id = $1
           )`,
        [employee_id]
      );

      return NextResponse.json({ completed: res.rows, pending_mandatory: pending.rows });
    }

    if (type === 'summary') {
      // Overall compliance summary
      const res = await query(
        `SELECT
           e.first_name || ' ' || e.last_name          AS employee_name,
           e.department,
           COUNT(tc.id)::int                            AS modules_completed,
           (SELECT COUNT(*)::int FROM training_modules) AS total_modules,
           (SELECT COUNT(*)::int FROM training_modules WHERE is_mandatory = TRUE) AS mandatory_total,
           COUNT(tc.id) FILTER (
             WHERE tm.is_mandatory = TRUE
           )::int                                       AS mandatory_completed,
           ROUND(
             COUNT(tc.id)::numeric /
             NULLIF((SELECT COUNT(*) FROM training_modules), 0) * 100, 1
           )                                            AS completion_rate
         FROM employees e
         LEFT JOIN training_completions tc ON tc.employee_id = e.id
         LEFT JOIN training_modules tm ON tm.id = tc.module_id
         WHERE e.status = 'active'
         GROUP BY e.id, e.first_name, e.last_name, e.department
         ORDER BY mandatory_completed ASC, e.last_name`
      );
      return NextResponse.json({ data: res.rows });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (err) {
    console.error('[Training GET]', err);
    return NextResponse.json({ error: 'Failed to fetch training data' }, { status: 500 });
  }
}

// POST /api/training — record completion or create module
export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'complete') {
      const { employee_id, module_id, score } = body;
      if (!employee_id || !module_id) {
        return NextResponse.json({ error: 'employee_id and module_id required' }, { status: 400 });
      }

      const res = await query(
        `INSERT INTO training_completions (employee_id, module_id, score)
         VALUES ($1, $2, $3)
         ON CONFLICT (employee_id, module_id)
         DO UPDATE SET completed_at = NOW(), score = EXCLUDED.score
         RETURNING *`,
        [employee_id, module_id, score ?? null]
      );
      return NextResponse.json({ data: res.rows[0] }, { status: 201 });
    }

    if (action === 'create_module') {
      const { title, description, duration_mins, is_mandatory, category } = body;
      if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

      const res = await query(
        `INSERT INTO training_modules (title, description, duration_mins, is_mandatory, category)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [title.trim(), description || null, duration_mins ?? 30, is_mandatory ?? false, category ?? 'compliance']
      );
      return NextResponse.json({ data: res.rows[0] }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[Training POST]', err);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
