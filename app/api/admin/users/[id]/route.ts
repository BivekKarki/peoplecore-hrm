import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth, hashPassword } from '@/lib/auth';
import { checkPermission } from '@/lib/rbac';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const permError = checkPermission(user, 'users:manage');
  if (permError) return permError;

  const { id } = await params;

  try {
    const body = await req.json();
    const { name, email, password, role, is_active } = body;

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (name !== undefined)      { updates.push(`name = $${idx++}`);       values.push(name); }
    if (email !== undefined)     { updates.push(`email = $${idx++}`);      values.push(email.toLowerCase().trim()); }
    if (role !== undefined)      { updates.push(`role = $${idx++}`);       values.push(role); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`);  values.push(is_active); }
    if (password && password.length >= 8) {
      const hash = await hashPassword(password);
      updates.push(`password_hash = $${idx++}`);
      values.push(hash);
    }

    if (!updates.length) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const res = await query(
      `UPDATE admin_users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, is_active`,
      values
    );

    if (!res.rowCount) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ data: res.rows[0] });
  } catch (err) {
    console.error('[Admin User PATCH]', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const permError = checkPermission(user, 'users:manage');
  if (permError) return permError;

  const { id } = await params;

  // Prevent self-deletion
  if (user!.id === id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  try {
    await query(
      `UPDATE admin_users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
      [id]
    );
    return NextResponse.json({ message: 'User deactivated' });
  } catch (err) {
    console.error('[Admin User DELETE]', err);
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
  }
}
