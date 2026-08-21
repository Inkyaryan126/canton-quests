import { NextResponse } from 'next/server';
import { updateUserPassword, resolveAuthenticatedPlayer } from '@/lib/supabase-auth';

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
      message: 'PLAYER ACCESS RESTORED: Your new password has been set successfully!',
    });

    if (player) {
      response.cookies.set('canton_player_id', player.id, {
        path: '/',
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });
    }

    if (effectiveToken) {
      response.cookies.set('sb-access-token', effectiveToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Password reset failed.' },
      { status: 500 }
    );
  }
}
