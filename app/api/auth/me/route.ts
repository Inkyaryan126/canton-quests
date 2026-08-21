import { NextResponse } from 'next/server';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';
import { getAchievementsForPlayer } from '@/lib/game-engine';

export async function GET(request: Request) {
  try {
    const sessionResult = await resolveAuthenticatedSession(request);
    const player = sessionResult.player;

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

    // Persist refreshed Supabase tokens and overwrite stale legacy player-id cookies from canonical identity.
    setAuthCookies(response, sessionResult.refreshedSession, player.id);

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { isAuthenticated: false, player: null, achievements: [], error: error.message || 'Failed to fetch session.' },
      { status: 500 }
    );
  }
}
