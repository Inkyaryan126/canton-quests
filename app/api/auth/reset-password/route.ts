import { NextResponse } from 'next/server';
import { updateUserPassword, resolveAuthenticatedPlayer, setAuthCookies } from '@/lib/supabase-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { password, authToken } = body;

    if (!password || typeof password !== 'string' || password.trim().length < 6) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization') || '';
    const effectiveToken = authToken || authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!effectiveToken && !request.headers.get('cookie')) {
      return NextResponse.json(
        { success: false, error: 'Authentication or recovery session required to reset password.' },
        { status: 401 }
      );
    }

    const updateRes = await updateUserPassword(password.trim(), effectiveToken || request);
    if (!updateRes.success) {
      return NextResponse.json(
        { success: false, error: updateRes.error || 'Failed to update password.' },
        { status: 400 }
      );
    }

    const player = updateRes.player || (await resolveAuthenticatedPlayer(effectiveToken || request));

    const response = NextResponse.json({
      success: true,
      player,
      session: updateRes.session,
      message: 'PLAYER ACCESS RESTORED: Your new password has been set successfully!',
    });

    // Set persistent 30-day cookies (access token, refresh token, player ID)
    setAuthCookies(response, updateRes.session, player?.id);

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Password reset failed.' },
      { status: 500 }
    );
  }
}
