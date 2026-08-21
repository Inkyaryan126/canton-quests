import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';
import { getAchievementsForPlayer } from '@/lib/game-engine';

export async function GET(request: Request) {
  try {
    const sessionResult = await resolveAuthenticatedSession(request);
    const player = sessionResult.player;

    // If cookie is present, ensure it matches authenticated player (fail closed on mismatch)
    let cookieStore: any;
    try {
      cookieStore = await cookies();
    } catch {
      // ignore
    }

    const cookiePlayerId = cookieStore?.get?.('canton_player_id')?.value;
    if (player && cookiePlayerId && cookiePlayerId !== player.id) {
      // Session conflict: Fail closed
      return NextResponse.json({
        isAuthenticated: false,
        player: null,
        achievements: [],
        error: 'Player session conflict detected.',
      });
    }

    if (!player) {
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

    // If session was refreshed during resolution, automatically persist updated tokens
    if (sessionResult.refreshedSession) {
      setAuthCookies(response, sessionResult.refreshedSession, player.id);
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { isAuthenticated: false, player: null, achievements: [], error: error.message || 'Failed to fetch session.' },
      { status: 500 }
    );
  }
}
