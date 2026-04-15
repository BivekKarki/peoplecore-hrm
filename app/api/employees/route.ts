import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';
import { generateEmployeeId, randomAvatarColor } from '@/lib/utils';
import { Employee } from '@/types';

export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';
  const department = searchParams.get('department') ?? '';
  const status = searchParams.get('status') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20'));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(
      to_tsvector('english', e.first_name || ' ' || e.last_name || ' ' || e.email || ' ' || e.department)
      @@ plainto_tsquery('english', $${paramIdx})
      OR e.employee_id ILIKE $${paramIdx + 1}
    )`);
    params.push(search, `%${search}%`);
    paramIdx += 2;
  }
  if (department) {
    conditions.push(`e.department = $${paramIdx++}`);
    params.push(department);
  }
  if (status) {
    conditions.push(`e.status = $${paramIdx++}`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [dataRes, countRes] = await Promise.all([
      query<Employee>(
        `SELECT e.*,
                m.first_name || ' ' || m.last_name AS manager_name
         FROM employees e
         LEFT JOIN employees m ON m.id = e.manager_id
         ${where}
         ORDER BY e.created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      ),
      query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM employees e ${where}`,
        params
      ),
    ]);

    return NextResponse.json({
      data: dataRes.rows,
      total: countRes.rows[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error('[Employees GET]', err);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const {
      first_name, last_name, email, phone, department, job_title,
      employment_type, status, start_date, salary, manager_id,
      address, emergency_contact, tax_file_number,
      bank_bsb, bank_account, super_fund, notes,
    } = body;

    // Validation
    if (!first_name?.trim()) return NextResponse.json({ error: 'First name is required' }, { status: 400 });
    if (!last_name?.trim())  return NextResponse.json({ error: 'Last name is required' }, { status: 400 });
    if (!email?.includes('@')) return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    if (!department)         return NextResponse.json({ error: 'Department is required' }, { status: 400 });
    if (!job_title?.trim())  return NextResponse.json({ error: 'Job title is required' }, { status: 400 });
    if (!start_date)         return NextResponse.json({ error: 'Start date is required' }, { status: 400 });

    // Check email uniqueness
    const existing = await query('SELECT id FROM employees WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rowCount && existing.rowCount > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const employee_id = generateEmployeeId();
    const avatar_color = randomAvatarColor();

    const res = await query<Employee>(
      `INSERT INTO employees (
         employee_id, first_name, last_name, email, phone,
         department, job_title, employment_type, status, start_date,
         salary, manager_id, address, emergency_contact,
         tax_file_number, bank_bsb, bank_account, super_fund, notes, avatar_color
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
       ) RETURNING *`,
      [
        employee_id, first_name.trim(), last_name.trim(), email.toLowerCase().trim(),
        phone ?? null, department, job_title.trim(),
        employment_type ?? 'full-time', status ?? 'pending',
        start_date, parseFloat(salary) || 0,
        manager_id || null, address || null, emergency_contact || null,
        tax_file_number || null, bank_bsb || null, bank_account || null,
        super_fund || null, notes || null, avatar_color,
      ]
    );

    // Auto-create induction record
    await query(
      `INSERT INTO inductions (employee_id) VALUES ($1)`,
      [res.rows[0].id]
    );

    return NextResponse.json({ data: res.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    console.error('[Employees POST]', err);
    if (err instanceof Error && err.message.includes('unique')) {
      return NextResponse.json({ error: 'Employee with this email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}
