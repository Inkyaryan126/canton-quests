import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import {
  createSessionTokenHash,
  createIpHash,
  extractCookieValue,
  getServerDerivedAuthenticatedPlayerId,
  SPECTATOR_COOKIE_NAME,
  PLAYER_COOKIE_NAME,
} from '@/lib/spectator-engine';
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
  resolveSpectatorEventId,
} from '@/lib/spectator-db';
import * as supabaseModule from '@/lib/supabase';

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

function getOrGenerateSessionToken(request?: Request): { token: string; isNew: boolean } {
  try {
    const cookieStore = cookies();
    const existingCookie = cookieStore.get(SPECTATOR_COOKIE_NAME)?.value;

    if (existingCookie) {
      return { token: existingCookie, isNew: false };
    }
  } catch {
    // Fallback if cookies() context is unavailable in direct route test execution
  }

  if (request) {
    const rawCookieHeader = request.headers.get('cookie');
    const existingFromHeader = extractCookieValue(rawCookieHeader, SPECTATOR_COOKIE_NAME);
    if (existingFromHeader) {
      return { token: existingFromHeader, isNew: false };
    }
  }

  const newToken = `spec_${crypto.randomUUID()}`;
  return { token: newToken, isNew: true };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'feed';
    const eventId = await resolveSpectatorEventId(
      url.searchParams.get('eventId'),
      url.searchParams.get('eventSlug')
    );

    if (action === 'options') {
      const audienceEventId = url.searchParams.get('audienceEventId') || '';
      const options = await getAudienceEventOptionsDB(audienceEventId, false);
      return NextResponse.json({ success: true, options });
    }

    // No event resolvable yet (nothing configured/active) is a legitimate,
    // successful "nothing live right now" state — never a 500. This is what
    // lets /watch reach a stable loaded state instead of spinning forever.
    if (!eventId) {
      if (action === 'events') return NextResponse.json({ success: true, events: [] });
      if (action === 'broadcasts') return NextResponse.json({ success: true, broadcasts: [] });
      if (action === 'settings') {
        return NextResponse.json({
          success: true,
          settings: { eventId: '', isSpectatorSystemDisabled: false, updatedAt: new Date().toISOString() },
        });
      }
      if (action === 'districts') return NextResponse.json({ success: true, districts: [] });
      if (action === 'stats') return NextResponse.json({ success: true, activeSpectators: 0 });
      return NextResponse.json({ success: true, feed: [] });
    }

    if (action === 'events') {
      const events = await getAudienceEventsDB(eventId, false);
      return NextResponse.json({ success: true, events });
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
    console.error('[API /spectator] GET error:', error);
    return NextResponse.json({ success: false, error: 'Spectator data unavailable' }, { status: 500 });
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

    const { token: sessionToken, isNew } = getOrGenerateSessionToken(request);
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

    // 2. Spectator-to-Player Conversion (Server-Verified Spectator / Player Session)
    if (action === 'convert_to_player') {
      const rawCookieHeader = request.headers.get('cookie');
      const specCookieToken = extractCookieValue(rawCookieHeader, SPECTATOR_COOKIE_NAME);

      if (!specCookieToken || isNew) {
        return NextResponse.json(
          { success: false, error: 'Valid spectator session required for conversion. Please visit /watch first.' },
          { status: 400 }
        );
      }

      let authenticatedPlayerId: string | undefined;

      if (supabaseModule.isSupabaseConfigured) {
        if (!supabaseModule.supabaseAdmin) {
          return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
        }

        // Verify spectator session ALREADY exists in spectator_sessions DB table
        const { data: sessionRow } = await supabaseModule.supabaseAdmin
          .from('spectator_sessions')
          .select('converted_to_player_id')
          .eq('session_token_hash', sessionTokenHash)
          .maybeSingle();

        if (!sessionRow) {
          return NextResponse.json(
            { success: false, error: 'No active spectator session found for conversion. Please visit /watch first.' },
            { status: 400 }
          );
        }

        if (sessionRow.converted_to_player_id) {
          authenticatedPlayerId = sessionRow.converted_to_player_id;
        } else {
          // Check if caller has verified Supabase Auth JWT in Authorization header
          const derivedPlayerId = await getServerDerivedAuthenticatedPlayerId(request);
          if (derivedPlayerId) {
            authenticatedPlayerId = derivedPlayerId;
          } else {
            // Generate a fresh UUID-compatible player ID SERVER-SIDE. DO NOT trust body.playerId!
            authenticatedPlayerId = crypto.randomUUID();
          }
        }
      } else {
        // Local dev mode fallback (non-Supabase)
        const derivedPlayerId = await getServerDerivedAuthenticatedPlayerId(request);
        authenticatedPlayerId = derivedPlayerId || body.playerId || `plr-${crypto.randomUUID()}`;
      }

      const targetPlayerId: string = authenticatedPlayerId || crypto.randomUUID();
      const updated = await convertSpectatorToPlayerDB(sessionTokenHash, targetPlayerId);

      if (!updated) {
        return NextResponse.json(
          { success: false, error: 'No active spectator session found for conversion. Please visit /watch first.' },
          { status: 400 }
        );
      }

      const canonicalPlayerId: string = updated.convertedToPlayerId || targetPlayerId;

      const response = NextResponse.json({
        success: true,
        session: {
          convertedToPlayerId: canonicalPlayerId,
          lastSeenAt: updated.lastSeenAt,
        },
      });

      response.cookies.set({
        name: PLAYER_COOKIE_NAME,
        value: canonicalPlayerId,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });

      return response;
    }


    // 3. Vote Submission (Default POST action)
    const { audienceEventId, optionId } = body;
    if (!audienceEventId || !optionId) {
      return NextResponse.json(
        { success: false, error: 'Missing audienceEventId or optionId' },
        { status: 400 }
      );
    }
    const eventId = await resolveSpectatorEventId(body.eventId, body.eventSlug);
    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'No active event configured' },
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
    console.error('[API /spectator] POST error:', error);
    return NextResponse.json({ success: false, error: 'Spectator action failed' }, { status: 500 });
  }
}
