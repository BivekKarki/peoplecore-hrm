import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const status      = searchParams.get('status');
  const employee_id = searchParams.get('employee_id');

  const conditions: string[] = [];
  const params: unknown[]    = [];
  let idx = 1;

  if (status)      { conditions.push(`ec.status = $${idx++}`);       params.push(status); }
  if (employee_id) { conditions.push(`ec.employee_id = $${idx++}`);  params.push(employee_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const res = await query<{
      id: string; employee_id: string; title: string; amount: number;
      category: string; claim_date: string; status: string;
      receipt_url: string | null; notes: string | null;
      employee_name: string; approver_name: string | null;
    }>(
      `SELECT ec.*,
              e.first_name || ' ' || e.last_name AS employee_name,
              a.name AS approver_name
       FROM expense_claims ec
       JOIN employees e ON e.id = ec.employee_id
       LEFT JOIN admin_users a ON a.id = ec.approved_by
       ${where}
       ORDER BY ec.created_at DESC`,
      params
    );

    const total_pending  = res.rows.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount), 0);
    const total_approved = res.rows.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.amount), 0);

    return NextResponse.json({ data: res.rows, total_pending, total_approved });
  } catch (err) {
    console.error('[Expenses GET]', err);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { employee_id, title, amount, category, claim_date, receipt_url, notes } = body;

    if (!employee_id)   return NextResponse.json({ error: 'Employee required' },   { status: 400 });
    if (!title?.trim()) return NextResponse.json({ error: 'Title required' },      { status: 400 });
    if (!amount || isNaN(Number(amount))) return NextResponse.json({ error: 'Valid amount required' }, { status: 400 });
    if (!category)      return NextResponse.json({ error: 'Category required' },   { status: 400 });

    const res = await query(
      `INSERT INTO expense_claims (employee_id, title, amount, category, claim_date, receipt_url, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [employee_id, title.trim(), Number(amount), category,
       claim_date || new Date().toISOString().split('T')[0],
       receipt_url || null, notes || null]
    );

    return NextResponse.json({ data: res.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[Expenses POST]', err);
    return NextResponse.json({ error: 'Failed to submit expense' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { id, action } = body; // action: 'approve' | 'reject' | 'mark_paid'

    if (!id)     return NextResponse.json({ error: 'Expense ID required' }, { status: 400 });
    if (!action) return NextResponse.json({ error: 'Action required' },     { status: 400 });

    let sql = '';
    let params: unknown[] = [];

    if (action === 'approve') {
      sql    = `UPDATE expense_claims SET status='approved', approved_by=$1, approved_at=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *`;
      params = [user!.id, id];
    } else if (action === 'reject') {
      sql    = `UPDATE expense_claims SET status='rejected', approved_by=$1, approved_at=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *`;
      params = [user!.id, id];
    } else if (action === 'mark_paid') {
      sql    = `UPDATE expense_claims SET status='paid', paid_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`;
      params = [id];
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const res = await query(sql, params);
    if (!res.rowCount) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    return NextResponse.json({ data: res.rows[0] });
  } catch (err) {
    console.error('[Expenses PATCH]', err);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}
