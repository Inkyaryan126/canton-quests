import { NextResponse } from 'next/server';
import { getEventBySlugDB } from '@/lib/supabase-db';
import { isPreLaunchEvent } from '@/lib/launch-status';
import {
  verifyPrelaunchPassword,
  createPrelaunchAccessToken,
  FOUNDER_CIPHER_PRELAUNCH_COOKIE,
} from '@/lib/founder-cipher-prelaunch';

const FOUNDER_CIPHER_EVENT_SLUG = 'canton-weekend-1';
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h, matching the signed token's own TTL.

// Best-effort in-memory throttle. Resets on cold start / new serverless
// instance, so it is a shallow deterrent rather than a hard guarantee — a
// deliberate tradeoff to avoid standing up new persistent infrastructure
// for a temporary prelaunch-only screen.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 60_000;
const attemptsByKey = new Map<string, number[]>();

function isRateLimited(key: string, now: number): boolean {
  const attempts = (attemptsByKey.get(key) || []).filter((t) => now - t < WINDOW_MS);
  attemptsByKey.set(key, attempts);
  return attempts.length >= MAX_ATTEMPTS;
}

function recordAttempt(key: string, now: number): void {
  const attempts = attemptsByKey.get(key) || [];
  attempts.push(now);
  attemptsByKey.set(key, attempts);
}

export async function POST(request: Request) {
  try {
    const clientKey = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    if (isRateLimited(clientKey, now)) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Try again in a minute.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const password: string = typeof body?.password === 'string' ? body.password : '';

    const event = await getEventBySlugDB(FOUNDER_CIPHER_EVENT_SLUG);
    // Only meaningful while genuinely pre-launch. Once the Operation has
    // actually started, every player already has full access, so a
    // stale/guessed password grants nothing extra — refusing here just
    // keeps the response honest rather than pretending the gate exists
    // when it no longer does anything.
    if (!isPreLaunchEvent(event, FOUNDER_CIPHER_EVENT_SLUG)) {
      return NextResponse.json(
        { success: false, error: 'The Founder’s Cipher has already launched.' },
        { status: 400 }
      );
    }

    if (!verifyPrelaunchPassword(password)) {
      recordAttempt(clientKey, now);
      return NextResponse.json({ success: false, error: 'Incorrect access code.' }, { status: 401 });
    }

    const token = createPrelaunchAccessToken(now);
    const res = NextResponse.json({ success: true });
    res.cookies.set(FOUNDER_CIPHER_PRELAUNCH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_SECONDS,
      path: '/',
    });
    return res;
  } catch (error) {
    console.error('[API /game/founder-cipher/prelaunch-access] Server error:', error);
    return NextResponse.json({ success: false, error: 'Request failed.' }, { status: 500 });
  }
}
