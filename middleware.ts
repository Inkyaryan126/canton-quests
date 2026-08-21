import { NextRequest, NextResponse } from 'next/server';

const CANONICAL_AUTH_HOST = 'www.cantonquests.com';
const CANONICAL_REDIRECT_HOSTS = new Set([
  'divinedesigndestinations.com',
  'www.divinedesigndestinations.com',
  'cantonquests.com',
  'canton-quests.vercel.app',
]);

export function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase();

  if (CANONICAL_REDIRECT_HOSTS.has(hostname)) {
    const url = request.nextUrl.clone();
    url.hostname = CANONICAL_AUTH_HOST;
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
