import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/Dashboard',
  '/admin',
  '/portal',
  '/workspace',
  '/account',
  '/photographer/status',
];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSessionCookie =
    request.cookies.get('icx_logged_in')?.value === '1' ||
    Boolean(request.cookies.get('icx_refresh_token')?.value);

  if (!hasSessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    loginUrl.search = `?redirect=${encodeURIComponent(`${pathname}${search}`)}`;
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/Dashboard' || pathname.startsWith('/Dashboard/')) {
    const normalizedUrl = request.nextUrl.clone();
    normalizedUrl.pathname = `/dashboard${pathname.slice('/Dashboard'.length)}`;
    return NextResponse.redirect(normalizedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/Dashboard/:path*',
    '/admin/:path*',
    '/portal/:path*',
    '/workspace/:path*',
    '/account/:path*',
    '/photographer/status/:path*',
  ],
};
