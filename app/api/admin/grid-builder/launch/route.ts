import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import {
  consumeGridBuilderLaunchToken,
  isLocalBuilderHostname,
} from '@/lib/grid/ops/grid-builder-os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (process.env.NODE_ENV === 'production' || !isLocalBuilderHostname(url.hostname)) {
    return NextResponse.json(
      { error: 'Local Boss Panel launcher only.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const token = url.searchParams.get('token') ?? '';
  if (!consumeGridBuilderLaunchToken(token, process.cwd())) {
    return NextResponse.json(
      { error: 'Boss Panel launch token is invalid or expired. Click the Dock button again.' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        },
      },
    );
  }

  const response = NextResponse.redirect(new URL('/admin/grid-builder', request.url));
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: process.env.ADMIN_SECRET_KEY || 'canton-gm-2026',
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
