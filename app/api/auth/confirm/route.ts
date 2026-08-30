import { NextResponse } from 'next/server';
import {
  verifyTokenHash,
  resolveAuthenticatedPlayer,
  resolveOrCreatePlayerForAuthUser,
  computeNeedsCallsignPrompt,
  getSiteUrl,
  sanitizeRedirectUrl,
  setAuthCookies,
  EmailOtpType,
} from '@/lib/supabase-auth';
import { StartingPath } from '@/lib/types';

/**
 * POST /api/auth/confirm
 * Deliberate user action endpoint: Verifies token_hash and creates/restores player profile.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      token_hash,
      type = 'email',
      next = '/profile',
      displayName,
      selectedStartingPath,
      acquisitionSource,
      avatarUrl,
      isMinor,
    } = body;

    if (!token_hash || typeof token_hash !== 'string' || token_hash.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Verification token hash is required.' },
        { status: 400 }
      );
    }

    const cleanType: EmailOtpType = (type as EmailOtpType) || 'email';
    const verifyRes = await verifyTokenHash(token_hash.trim(), cleanType);

    if (!verifyRes.success || !verifyRes.user) {
      return NextResponse.json(
        {
          success: false,
          error: verifyRes.error || 'Invalid or expired confirmation link. Please request a new link.',
        },
        { status: 401 }
      );
    }

    if (cleanType === 'recovery') {
      const safeRedirect = sanitizeRedirectUrl(next === '/profile' ? '/auth/reset-password' : next, '/auth/reset-password');
      const player = await resolveAuthenticatedPlayer(verifyRes.session?.access_token || `mock-jwt-${verifyRes.user.id}`).catch(() => null);

      const response = NextResponse.json({
        success: true,
        session: verifyRes.session,
        user: verifyRes.user,
        player: player || undefined,
        redirectTo: safeRedirect || '/auth/reset-password',
        message: 'Recovery session verified. Please set your new password.',
      });

      // Set persistent 30-day cookies including refresh token
      setAuthCookies(response, verifyRes.session, player?.id);

      return response;
    }

    const cleanPath: StartingPath | undefined = ['family', 'challenge', 'secret'].includes(selectedStartingPath)
      ? selectedStartingPath
      : undefined;

    // Resolve existing player or create new player profile for the verified auth user
    const player = await resolveOrCreatePlayerForAuthUser(verifyRes.user, {
      displayName: displayName ? String(displayName).trim() : undefined,
      selectedStartingPath: cleanPath,
      acquisitionSource: acquisitionSource || 'email_confirmation',
      avatarUrl: avatarUrl || '⚡',
      isMinor: Boolean(isMinor),
    });

    // Prefer the destination saved at signup time (verifyRes.user.user_
    // metadata.pending_redirect) over whatever `next` the confirm page's
    // own URL carries. Supabase's real "Confirm signup" email link never
    // preserves emailRedirectTo's extra query params (confirmed live — only
    // token_hash and type survive), so the client-submitted `next` is
    // always just the '/profile' default in practice; without this, a
    // player who scanned a Fair QR and registered would land on /profile
    // with no path back to the signal they scanned.
    const pendingRedirect =
      typeof verifyRes.user.user_metadata?.pending_redirect === 'string'
        ? verifyRes.user.user_metadata.pending_redirect
        : undefined;
    const safeRedirect = sanitizeRedirectUrl(pendingRedirect || next, '/profile');

    // Whether the client should offer a one-time callsign prompt AFTER this
    // verification succeeds — derived from reliable server-side state
    // (verifyRes.user.user_metadata + the resolved player), never from the
    // email link's `type` query param. See computeNeedsCallsignPrompt.
    const needsCallsign = computeNeedsCallsignPrompt(verifyRes.user, player);

    const response = NextResponse.json({
      success: true,
      player,
      session: verifyRes.session,
      redirectTo: safeRedirect,
      needsCallsign,
      message: `Email verified successfully! Welcome to Canton Quests, ${player.displayName}!`,
    });

    // Set persistent 30-day cookies (access token, refresh token, player ID)
    setAuthCookies(response, verifyRes.session, player.id);

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Confirmation verification failed.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/confirm
 * Scanner-safe forwarder: Redirects incoming email clicks to the dedicated confirmation page.
 * Crucial: GET does NOT verify or consume the token.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash') || searchParams.get('token') || '';
  const type = searchParams.get('type') || 'email';
  const next = sanitizeRedirectUrl(searchParams.get('next') || searchParams.get('redirectTo'), '/profile');
  const error = searchParams.get('error') || '';
  const error_description = searchParams.get('error_description') || '';

  // Use the incoming request origin if available, or canonical site URL
  const baseUrl = request.url.startsWith('http') ? request.url : getSiteUrl();
  const confirmPageUrl = new URL('/auth/confirm', baseUrl);

  if (token_hash) confirmPageUrl.searchParams.set('token_hash', token_hash);
  if (type) confirmPageUrl.searchParams.set('type', type);
  if (next) confirmPageUrl.searchParams.set('next', next);
  if (error) confirmPageUrl.searchParams.set('error', error);
  if (error_description) confirmPageUrl.searchParams.set('error_description', error_description);

  return NextResponse.redirect(confirmPageUrl.toString(), 307);
}
