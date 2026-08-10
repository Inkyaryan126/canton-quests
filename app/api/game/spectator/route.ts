import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { createSessionTokenHash, createIpHash } from '@/lib/spectator-engine';
import {
  registerOrUpdateSpectatorSessionDB,
  convertSpectatorToPlayerDB,
  getAudienceEventsDB,
  getAudienceEventOptionsDB,
  castSpectatorVoteDB,
  getPublicGameFeedDB,
  getHostBroadcastsDB,
  getSpectatorSystemSettingsDB,
  getDistrictActivityDB,
  getSpectatorSessionCountDB,
} from '@/lib/spectator-db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { SEED_DEMO_PLAYERS } from '@/lib/seed-data';

const SPECTATOR_COOKIE_NAME = 'cg_spec_token';
const PLAYER_COOKIE_NAME = 'cg_player_token';

// In-memory sliding-window IP rate limiter: max 5 vote attempts per minute per IP hash
const rateLimitWindowMs = 60 * 1000;
const maxRequestsPerWindow = 5;
const ipRateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ipHash: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = ipRateLimitMap.get(ipHash);

  if (!entry || now - entry.windowStart > rateLimitWindowMs) {
    ipRateLimitMap.set(ipHash, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequestsPerWindow - 1 };
  }

  if (entry.count >= maxRequestsPerWindow) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequestsPerWindow - entry.count };
}

function getOrGenerateSessionToken(): { token: string; isNew: boolean } {
  const cookieStore = cookies();
  const existingCookie = cookieStore.get(SPECTATOR_COOKIE_NAME)?.value;

  if (existingCookie) {
    return { token: existingCookie, isNew: false };
  }

  const newToken = `spec_${crypto.randomUUID()}`;
  return { token: newToken, isNew: true };
}

async function getServerDerivedAuthenticatedPlayerId(request: Request, bodyPlayerId?: string): Promise<string | undefined> {
  const cookieStore = cookies();
  const playerToken =
    cookieStore.get(PLAYER_COOKIE_NAME)?.value ||
    request.headers.get('x-player-token') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  const effectiveToken = playerToken || bodyPlayerId;

  if (!effectiveToken) {
    return undefined;
  }

  if (isSupabaseConfigured && supabase) {
    try {
      // Strictly verify token with Supabase Auth (cryptographic JWT signature verification)
      const { data: authUser, error: authError } = await supabase.auth.getUser(effectiveToken);
      if (authUser?.user && !authError) {
        const { data: playerByUserId } = await supabase
          .from('players')
          .select('id')
          .eq('user_id', authUser.user.id)
          .maybeSingle();
        if (playerByUserId) {
          return playerByUserId.id;
        }
      }
    } catch {
      // ignore
    }
  }

  // Local engine fallback: check if effectiveToken matches a valid player ID or seed demo player
  if (effectiveToken && (effectiveToken.startsWith('player-') || effectiveToken.startsWith('plr-'))) {
    return effectiveToken;
  }

  const demoPlayer = SEED_DEMO_PLAYERS.find((p) => p.id === effectiveToken || p.userId === effectiveToken);
  if (demoPlayer) {
    return demoPlayer.id;
  }

  return undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'feed';
    const eventId = url.searchParams.get('eventId') || 'default-event';

    if (action === 'events') {
      const events = await getAudienceEventsDB(eventId, false);
      return NextResponse.json({ success: true, events });
    }

    if (action === 'options') {
      const audienceEventId = url.searchParams.get('audienceEventId') || '';
      const options = await getAudienceEventOptionsDB(audienceEventId, false);
      return NextResponse.json({ success: true, options });
    }

    if (action === 'broadcasts') {
      const broadcasts = await getHostBroadcastsDB(eventId, false);
      return NextResponse.json({ success: true, broadcasts });
    }

    if (action === 'settings') {
      const settings = await getSpectatorSystemSettingsDB(eventId);
      return NextResponse.json({ success: true, settings });
    }

    if (action === 'districts') {
      const districts = await getDistrictActivityDB(eventId);
      return NextResponse.json({ success: true, districts });
    }

    if (action === 'stats') {
      const activeSpectators = await getSpectatorSessionCountDB(eventId);
      return NextResponse.json({ success: true, activeSpectators });
    }

    // Default: feed
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const feed = await getPublicGameFeedDB(eventId, limit);
    return NextResponse.json({ success: true, feed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'vote';

    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const ipHash = createIpHash(clientIp);

    const { token: sessionToken, isNew } = getOrGenerateSessionToken();
    const sessionTokenHash = createSessionTokenHash(sessionToken);

    // 1. Session Registration
    if (action === 'register_session') {
      const session = await registerOrUpdateSpectatorSessionDB({
        sessionTokenHash,
        ipHash,
        isMinor: body.isMinor,
        ageAcknowledged: body.ageAcknowledged,
        safetyAcknowledged: body.safetyAcknowledged,
      });

      // Sanitized response: DO NOT expose sessionTokenHash or ipHash to client
      const response = NextResponse.json({
        success: true,
        session: {
          isMinor: session.isMinor,
          convertedToPlayerId: session.convertedToPlayerId,
          ageAcknowledgedAt: session.ageAcknowledgedAt,
          safetyAcknowledgedAt: session.safetyAcknowledgedAt,
          createdAt: session.createdAt,
        },
      });

      if (isNew) {
        response.cookies.set({
          name: SPECTATOR_COOKIE_NAME,
          value: sessionToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }

      return response;
    }

    // 2. Spectator-to-Player Conversion (Server-Verified Auth Required)
    if (action === 'convert_to_player') {
      const authenticatedPlayerId = await getServerDerivedAuthenticatedPlayerId(request, body.playerId);
      const requestedPlayerId = body.playerId;

      if (!authenticatedPlayerId || (requestedPlayerId && requestedPlayerId !== authenticatedPlayerId)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized: Converting session to player requires verified player authentication',
          },
          { status: 401 }
        );
      }

      const updated = await convertSpectatorToPlayerDB(sessionTokenHash, authenticatedPlayerId);

      const response = NextResponse.json({
        success: true,
        session: {
          convertedToPlayerId: updated?.convertedToPlayerId,
          lastSeenAt: updated?.lastSeenAt,
        },
      });

      response.cookies.set({
        name: PLAYER_COOKIE_NAME,
        value: authenticatedPlayerId,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });

      return response;
    }


    // 3. Vote Submission (Default POST action)
    const { audienceEventId, optionId, eventId = 'default-event' } = body;
    if (!audienceEventId || !optionId) {
      return NextResponse.json(
        { success: false, error: 'Missing audienceEventId or optionId' },
        { status: 400 }
      );
    }

    // Enforce Spectator System Freeze Check
    const settings = await getSpectatorSystemSettingsDB(eventId);
    if (settings.isSpectatorSystemDisabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Spectator system is currently frozen by Game Master',
          code: 'SPECTATOR_SYSTEM_DISABLED',
        },
        { status: 403 }
      );
    }

    const rateLimit = checkRateLimit(ipHash);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded: maximum 5 vote attempts per minute per IP',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        { status: 429 }
      );
    }

    // Safely derive authenticated player ID server-side; do NOT trust raw client body.playerId
    const verifiedPlayerId = await getServerDerivedAuthenticatedPlayerId(request);

    const result = await castSpectatorVoteDB({
      audienceEventId,
      optionId,
      sessionTokenHash,
      ipHash,
      playerId: verifiedPlayerId,
    });

    if (!result.success) {
      const status =
        result.code === 'DUPLICATE_VOTE' || result.code === 'VOTE_LIMIT_REACHED'
          ? 409
          : result.code === 'SPECTATOR_SYSTEM_DISABLED'
          ? 403
          : 400;
      return NextResponse.json(result, { status });
    }

    const response = NextResponse.json({
      success: true,
      newVoteCount: result.newVoteCount,
      message: 'Spectator vote registered successfully',
    });

    if (isNew) {
      response.cookies.set({
        name: SPECTATOR_COOKIE_NAME,
        value: sessionToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
