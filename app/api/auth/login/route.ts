import { NextResponse } from 'next/server';
import {
  signInWithPassword,
  sendPasswordResetEmail,
  sendEmailOtp,
  verifyEmailOtp,
  resolveAuthenticatedSession,
  resolveOrCreatePlayerForAuthUser,
  setAuthCookies,
} from '@/lib/supabase-auth';
import { StartingPath } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      action,
      email,
      password,
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

    // 1. Password Login (Returning Player — Email + Password Only)
    if (
      action === 'password_login' ||
      action === 'login' ||
      (email && password && !token && !identifier)
    ) {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json(
          { success: false, error: 'Valid email address is required.' },
          { status: 400 }
        );
      }
      if (!password || typeof password !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Password is required.' },
          { status: 400 }
        );
      }

      const loginRes = await signInWithPassword(email.trim(), password);
      if (!loginRes.success || !loginRes.player) {
        return NextResponse.json(
          { success: false, error: loginRes.error || 'Invalid email or password.' },
          { status: 401 }
        );
      }

      const response = NextResponse.json({
        success: true,
        player: loginRes.player,
        session: loginRes.session,
        message: loginRes.message || `Welcome back to Canton Quests, ${loginRes.player.displayName}!`,
      });

      // Persistent 30-day cookies (access token, refresh token, player ID) for browser session persistence
      setAuthCookies(response, loginRes.session, loginRes.player.id);

      return response;
    }

    // 2. Forgot Password / Send Recovery Link
    if (action === 'forgot_password' || action === 'send_recovery') {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json(
          { success: false, error: 'Valid email address is required.' },
          { status: 400 }
        );
      }

      const recoveryRes = await sendPasswordResetEmail(email.trim(), {
        redirectTo,
      });

      if (!recoveryRes.success) {
        return NextResponse.json(
          { success: false, error: recoveryRes.error || recoveryRes.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: recoveryRes.message,
      });
    }

    // 3. Send OTP / Confirmation Code (Legacy & Scanner-Safe compatibility)
    if (action === 'send_otp') {
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

    // 4. Verify OTP / Confirmation Code
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

      // Set persistent 30-day cookies
      setAuthCookies(response, verifyRes.session, player.id);

      return response;
    }

    // 5. Restore / Validate Verified Supabase Session
    if (action === 'session' || authToken) {
      const authHeader = request.headers.get('authorization') || '';
      const effectiveToken = authToken || authHeader.replace(/^Bearer\s+/i, '').trim();

      const sessionResult = await resolveAuthenticatedSession(effectiveToken || request);
      const player = sessionResult.player;

      if (!player) {
        return NextResponse.json(
          { success: false, error: 'Session is invalid, expired, or unlinked.' },
          { status: 401 }
        );
      }

      const response = NextResponse.json({
        success: true,
        player,
        session: sessionResult.refreshedSession,
        message: `Welcome back, ${player.displayName}!`,
      });

      setAuthCookies(response, sessionResult.refreshedSession, player.id);

      return response;
    }

    // 6. Reject Insecure / Callsign-Only / Email-Only Login Attempts
    // Public identifiers (callsigns, display names, raw unauthenticated emails) are NOT credentials.
    if (identifier || displayName || email) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Authentication denied. Callsigns and emails are public identifiers. Valid password credentials or secure email verification through Supabase Auth is required.',
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
