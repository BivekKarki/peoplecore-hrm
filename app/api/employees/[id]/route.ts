import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';
import { Employee } from '@/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { id } = await params;

  try {
    const res = await query<Employee>(
      `SELECT e.*, m.first_name || ' ' || m.last_name AS manager_name
       FROM employees e
       LEFT JOIN employees m ON m.id = e.manager_id
       WHERE e.id = $1`,
      [id]
    );
    if (!res.rowCount) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    return NextResponse.json({ data: res.rows[0] });
  } catch (err) {
    console.error('[Employee GET]', err);
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { id } = await params;

  try {
    const body = await req.json();
    const allowed = [
      'first_name','last_name','email','phone','department','job_title',
      'employment_type','status','start_date','end_date','salary','manager_id',
      'address','emergency_contact','tax_file_number','bank_bsb','bank_account',
      'super_fund','super_member_no','notes',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in body) {
        updates.push(`${key} = $${idx++}`);
        values.push(body[key] === '' ? null : body[key]);
      }
    }

    if (!updates.length) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    values.push(id);
    const res = await query<Employee>(
      `UPDATE employees SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!res.rowCount) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    return NextResponse.json({ data: res.rows[0] });
  } catch (err) {
    console.error('[Employee PATCH]', err);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { id } = await params;

  try {
    // Soft delete — set status inactive
    const res = await query(
      `UPDATE employees SET status = 'inactive', end_date = CURRENT_DATE WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!res.rowCount) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    return NextResponse.json({ message: 'Employee deactivated' });
  } catch (err) {
    console.error('[Employee DELETE]', err);
    return NextResponse.json({ error: 'Failed to deactivate employee' }, { status: 500 });
  }
}
