import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSecret, authorizeGameMasterRequest, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';

export async function GET(request: Request) {
  try {
    const headersObj: Record<string, string> = {};
    request.headers.forEach((val, key) => {
      headersObj[key] = val;
    });

    const session = authorizeGameMasterRequest(headersObj);

    if (session.isAdmin) {
      return NextResponse.json({ success: true, isAdmin: true, role: 'admin' });
    }

    // Check cookie
    const cookieStore = cookies();
    const adminCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

    if (adminCookie && verifyAdminSecret(adminCookie)) {
      return NextResponse.json({ success: true, isAdmin: true, role: 'admin' });
    }

    return NextResponse.json({ success: false, isAdmin: false, role: 'player' });
  } catch (error: any) {
    return NextResponse.json({ success: false, isAdmin: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const passphrase = body.passphrase || body.adminKey || '';

    const headersObj: Record<string, string> = {};
    request.headers.forEach((val, key) => {
      headersObj[key] = val;
    });

    const headerSession = authorizeGameMasterRequest(headersObj);
    const isValidPassphrase = verifyAdminSecret(passphrase);

    if (headerSession.isAdmin || isValidPassphrase) {
      const validToken = passphrase || headersObj['x-admin-key'] || process.env.ADMIN_SECRET_KEY || 'canton-gm-2026';

      const response = NextResponse.json({
        success: true,
        isAdmin: true,
        role: 'admin',
        message: 'Admin authorization granted',
      });

      response.cookies.set({
        name: ADMIN_COOKIE_NAME,
        value: validToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 12, // 12 hours
      });

      return response;
    }

    return NextResponse.json(
      { success: false, isAdmin: false, error: 'Unauthorized: Invalid Game Master passphrase' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, isAdmin: false });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
