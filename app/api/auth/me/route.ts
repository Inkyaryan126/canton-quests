import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveAuthenticatedPlayer } from '@/lib/supabase-auth';
import { getAchievementsForPlayer } from '@/lib/game-engine';

export async function GET(request: Request) {
  try {
    const player = await resolveAuthenticatedPlayer(request);

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

    return NextResponse.json({
      isAuthenticated: true,
      player,
      achievements,
    });
  } catch (error: any) {
    return NextResponse.json(
      { isAuthenticated: false, player: null, achievements: [], error: error.message || 'Failed to fetch session.' },
      { status: 500 }
    );
  }
}
