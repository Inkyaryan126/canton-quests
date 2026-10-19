import { NextResponse } from 'next/server';
import { resolveAuthenticatedSession, extractAuthTokens, setAuthCookies, logAuthDiagnostic } from '@/lib/supabase-auth';
import { getAchievementsForPlayer } from '@/lib/game-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const sessionResult = await resolveAuthenticatedSession(request);
    const player = sessionResult.player;

    if (!player) {
      logAuthDiagnostic('GET /api/auth/me:unauthenticated', {
        isAuthenticated: false,
      });
      return NextResponse.json({
        isAuthenticated: false,
        player: null,
        achievements: [],
      });
    }

    const achievements = getAchievementsForPlayer(player.id);

    const response = NextResponse.json({
      isAuthenticated: true,
      player,
      achievements,
      session: sessionResult.refreshedSession,
    });

    // Persist refreshed Supabase tokens and overwrite stale legacy player-id cookies from canonical identity.
    // Migrate existing authenticated sessions to a shared subdomain cookie
    // without exposing token values to the client-side response body.
    const existing = extractAuthTokens(request);
    setAuthCookies(response, sessionResult.refreshedSession ?? {
      access_token: existing.accessToken,
      refresh_token: existing.refreshToken,
    }, player.id);

    logAuthDiagnostic('GET /api/auth/me:authenticated', {
      isAuthenticated: true,
      playerId: player.id,
      displayName: player.displayName,
      wasRefreshed: Boolean(sessionResult.refreshedSession),
    });

    return response;
  } catch (error: any) {
    logAuthDiagnostic('GET /api/auth/me:error', {
      error: error.message || 'Failed to fetch session',
    });
    return NextResponse.json(
      { isAuthenticated: false, player: null, achievements: [], error: error.message || 'Failed to fetch session.' },
      { status: 500 }
    );
  }
}
