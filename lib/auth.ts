import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { AdminUser } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_NAME = 'pc_session';

export function signToken(payload: Omit<AdminUser, 'created_at'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): AdminUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminUser;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getSession(): Promise<AdminUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function setCookieHeader(token: string): string {
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function clearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

export function requireAuth(user: AdminUser | null): Response | null {
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
