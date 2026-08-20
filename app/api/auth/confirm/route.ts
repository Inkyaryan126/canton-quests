import { NextResponse } from 'next/server';
import {
  verifyTokenHash,
  resolveOrCreatePlayerForAuthUser,
  getSiteUrl,
  EmailOtpType,
} from '@/lib/supabase-auth';
import { StartingPath } from '@/lib/types';

/**
 * Validates and sanitizes the next redirect destination to prevent open redirect vulnerabilities.
 */
function sanitizeNextPath(rawNext?: string | null): string {
  if (!rawNext || typeof rawNext !== 'string') return '/profile';
  const trimmed = rawNext.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\') && !trimmed.includes('\0')) {
    return trimmed;
  }
  return '/profile';
}

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
          error: verifyRes.error || 'Invalid or expired confirmation link. Please request a new verification code.',
        },
        { status: 401 }
      );
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

    const safeRedirect = sanitizeNextPath(next);

    const response = NextResponse.json({
      success: true,
      player,
      session: verifyRes.session,
      redirectTo: safeRedirect,
      message: `Email verified successfully! Welcome to Canton Quests, ${player.displayName}!`,
    });

    // Set convenience cookie for mobile client UX
    response.cookies.set('canton_player_id', player.id, {
      path: '/',
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    });

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
  const next = sanitizeNextPath(searchParams.get('next') || searchParams.get('redirectTo'));
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
