import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/api/face-match',
  '/api/sessions',
  '/api/mobile',
  '/kiosk',
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const token = req.cookies.get('pc_session')?.value;
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify JWT
  const user = verifyToken(token);
  if (!user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete('pc_session');
    return res;
  }

  // Inject user info into request headers for server components
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id', user.id);
  requestHeaders.set('x-user-name', user.name);
  requestHeaders.set('x-user-role', user.role);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
