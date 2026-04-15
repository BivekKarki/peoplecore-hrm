import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';

const DOC_TYPES = ['contract','id','passport','visa','tax','certificate','qualification','medical','other'];

export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const employee_id = searchParams.get('employee_id');
  const expiring    = searchParams.get('expiring'); // 'true' = expiring within 30 days

  const conditions: string[] = ['1=1'];
  const params: unknown[]    = [];
  let idx = 1;

  if (employee_id) { conditions.push(`d.employee_id = $${idx++}`); params.push(employee_id); }
  if (expiring === 'true') {
    conditions.push(`d.expiry_date IS NOT NULL AND d.expiry_date <= CURRENT_DATE + 30`);
  }

  try {
    const res = await query<{
      id: string; employee_id: string; doc_type: string; title: string;
      file_name: string | null; expiry_date: string | null; is_verified: boolean;
      uploaded_at: string; employee_name: string;
    }>(
      `SELECT d.*,
              e.first_name || ' ' || e.last_name AS employee_name
       FROM employee_documents d
       JOIN employees e ON e.id = d.employee_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY d.uploaded_at DESC`,
      params
    );

    // Summarise expiry alerts
    const expiring30 = res.rows.filter(r =>
      r.expiry_date && new Date(r.expiry_date) <= new Date(Date.now() + 30 * 86400000)
    );

    return NextResponse.json({ data: res.rows, expiring_soon: expiring30.length });
  } catch (err) {
    console.error('[Docs GET]', err);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { employee_id, doc_type, title, file_name, file_size, file_url, mime_type, expiry_date, notes } = body;

    if (!employee_id)            return NextResponse.json({ error: 'Employee required' },      { status: 400 });
    if (!title?.trim())          return NextResponse.json({ error: 'Title required' },         { status: 400 });
    if (!DOC_TYPES.includes(doc_type)) return NextResponse.json({ error: 'Invalid doc type' },{ status: 400 });

    const res = await query(
      `INSERT INTO employee_documents
         (employee_id, doc_type, title, file_name, file_size, file_url, mime_type, expiry_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [employee_id, doc_type, title.trim(), file_name || null, file_size || null,
       file_url || null, mime_type || null, expiry_date || null, notes || null]
    );

    return NextResponse.json({ data: res.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[Docs POST]', err);
    return NextResponse.json({ error: 'Failed to save document' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { id, is_verified } = body;

    if (!id) return NextResponse.json({ error: 'Document ID required' }, { status: 400 });

    const res = await query(
      `UPDATE employee_documents
       SET is_verified = $1, verified_by = $2
       WHERE id = $3
       RETURNING *`,
      [is_verified, user!.id, id]
    );

    if (!res.rowCount) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    return NextResponse.json({ data: res.rows[0] });
  } catch (err) {
    console.error('[Docs PATCH]', err);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Document ID required' }, { status: 400 });

  try {
    await query('DELETE FROM employee_documents WHERE id = $1', [id]);
    return NextResponse.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('[Docs DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
