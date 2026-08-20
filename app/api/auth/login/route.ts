import { NextResponse } from 'next/server';
import {
  sendEmailOtp,
  verifyEmailOtp,
  resolveAuthenticatedPlayer,
  resolveOrCreatePlayerForAuthUser,
} from '@/lib/supabase-auth';
import { StartingPath } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      action,
      email,
      token,
      authToken,
      identifier,
      displayName,
      selectedStartingPath,
      acquisitionSource,
      avatarUrl,
      isMinor,
      redirectTo,
    } = body;

    // 1. Send OTP / Magic Code
    if (action === 'send_otp' || (email && !token && !authToken && !identifier)) {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json(
          { success: false, error: 'Valid email address is required.' },
          { status: 400 }
        );
      }

      const cleanPath: StartingPath | undefined = ['family', 'challenge', 'secret'].includes(selectedStartingPath)
        ? selectedStartingPath
        : undefined;

      const result = await sendEmailOtp(email.trim(), {
        startingPath: cleanPath,
        acquisitionSource: acquisitionSource || 'main_site',
        redirectTo,
      });

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error || result.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: result.message,
      });
    }

    // 2. Verify OTP / Magic Code & Authenticate / Restore Player
    if (action === 'verify_otp' || (email && token)) {
      if (!email || !token) {
        return NextResponse.json(
          { success: false, error: 'Email and verification code are required.' },
          { status: 400 }
        );
      }

      const verifyRes = await verifyEmailOtp(email, token);
      if (!verifyRes.success || !verifyRes.user) {
        return NextResponse.json(
          { success: false, error: verifyRes.error || 'Invalid or expired verification code.' },
          { status: 401 }
        );
      }

      const cleanPath: StartingPath | undefined = ['family', 'challenge', 'secret'].includes(selectedStartingPath)
        ? selectedStartingPath
        : undefined;

      const player = await resolveOrCreatePlayerForAuthUser(verifyRes.user, {
        displayName: displayName ? String(displayName).trim() : undefined,
        selectedStartingPath: cleanPath,
        acquisitionSource: acquisitionSource || 'main_site',
        avatarUrl,
        isMinor: Boolean(isMinor),
      });

      const response = NextResponse.json({
        success: true,
        player,
        session: verifyRes.session,
        message: `Welcome to Canton Quests, ${player.displayName}!`,
      });

      // Set convenience cookie for mobile client UX (non-authoritative cache)
      response.cookies.set('canton_player_id', player.id, {
        path: '/',
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });

      return response;
    }

    // 3. Restore / Validate Verified Supabase Session
    if (action === 'session' || authToken) {
      const authHeader = request.headers.get('authorization') || '';
      const effectiveToken = authToken || authHeader.replace(/^Bearer\s+/i, '').trim();

      const player = await resolveAuthenticatedPlayer(effectiveToken);
      if (!player) {
        return NextResponse.json(
          { success: false, error: 'Session is invalid, expired, or unlinked.' },
          { status: 401 }
        );
      }

      const response = NextResponse.json({
        success: true,
        player,
        message: `Welcome back, ${player.displayName}!`,
      });

      response.cookies.set('canton_player_id', player.id, {
        path: '/',
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });

      return response;
    }

    // 4. Reject Insecure / Callsign-Only / Email-Only Login Attempts
    // Public identifiers (callsigns, display names) are NOT credentials.
    if (identifier || displayName || email) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Authentication denied. Callsigns and emails are public identifiers. Secure email OTP verification through Supabase Auth is required.',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Authentication request is missing required action or credentials.' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Authentication failed.' },
      { status: 500 }
    );
  }
}
