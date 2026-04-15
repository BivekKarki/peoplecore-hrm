import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword, signToken, setCookieHeader, clearCookieHeader, getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const res = await query<{
      id: string; name: string; email: string; role: string;
      password_hash: string; is_active: boolean;
    }>(
      'SELECT id, name, email, role, password_hash, is_active FROM admin_users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const adminUser = res.rows[0];
    if (!adminUser || !adminUser.is_active) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await comparePassword(password, adminUser.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Update last login
    await query('UPDATE admin_users SET last_login = NOW() WHERE id = $1', [adminUser.id]);

    const token = signToken({
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role as 'super_admin' | 'hr_manager' | 'hr_staff',
    });

    const response = NextResponse.json({
      user: { id: adminUser.id, name: adminUser.name, email: adminUser.email, role: adminUser.role },
    });
    response.headers.set('Set-Cookie', setCookieHeader(token));
    return response;
  } catch (err) {
    console.error('[Auth POST]', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest) {
  const response = NextResponse.json({ message: 'Logged out' });
  response.headers.set('Set-Cookie', clearCookieHeader());
  return response;
}

export async function GET(_req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json({ user });
}
