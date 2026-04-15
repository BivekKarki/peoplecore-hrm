import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth, hashPassword } from '@/lib/auth';
import { checkPermission } from '@/lib/rbac';
import { AdminUser } from '@/types';

export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;
  const permError = checkPermission(user, 'users:manage');
  if (permError) return permError;

  try {
    const res = await query<Omit<AdminUser, 'created_at'> & { created_at: string; last_login: string | null; is_active: boolean }>(
      `SELECT id, name, email, role, is_active, last_login, created_at
       FROM admin_users ORDER BY created_at DESC`
    );
    return NextResponse.json({ data: res.rows });
  } catch (err) {
    console.error('[Users GET]', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;
  const permError = checkPermission(user, 'users:manage');
  if (permError) return permError;

  try {
    const body = await req.json();
    const { name, email, password, role } = body;

    if (!name?.trim())      return NextResponse.json({ error: 'Name required' },         { status: 400 });
    if (!email?.includes('@')) return NextResponse.json({ error: 'Valid email required' },{ status: 400 });
    if (!password || password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    if (!['super_admin','hr_manager','hr_staff'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Only super_admin can create other super_admins
    if (role === 'super_admin' && user!.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can create other super admins' }, { status: 403 });
    }

    const existing = await query('SELECT id FROM admin_users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rowCount && existing.rowCount > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const hash = await hashPassword(password);
    const res  = await query(
      `INSERT INTO admin_users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, created_at`,
      [name.trim(), email.toLowerCase().trim(), hash, role]
    );

    return NextResponse.json({ data: res.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[Users POST]', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;
  const permError = checkPermission(user, 'users:manage');
  if (permError) return permError;

  try {
    const body = await req.json();
    const { id, name, role, is_active, password } = body;

    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    if (id === user!.id && is_active === false) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    const updates: string[]   = [];
    const params: unknown[]   = [];
    let idx = 1;

    if (name)                      { updates.push(`name = $${idx++}`);      params.push(name); }
    if (role)                      { updates.push(`role = $${idx++}`);      params.push(role); }
    if (typeof is_active === 'boolean') { updates.push(`is_active = $${idx++}`); params.push(is_active); }
    if (password && password.length >= 8) {
      const hash = await hashPassword(password);
      updates.push(`password_hash = $${idx++}`);
      params.push(hash);
    }

    if (!updates.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    params.push(id);
    const res = await query(
      `UPDATE admin_users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, name, email, role, is_active`,
      params
    );

    if (!res.rowCount) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json({ data: res.rows[0] });
  } catch (err) {
    console.error('[Users PATCH]', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
