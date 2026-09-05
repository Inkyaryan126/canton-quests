import { NextResponse } from 'next/server';
import { getGlobalXpLeaderboardDB } from '@/lib/supabase-db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/game/leaderboard/global
 *
 * The cross-Mission XP leaderboard — every registered player ranked by
 * players.total_xp, not scoped to any one Operation's score_ledger (that's
 * GET /api/game/leaderboard). No auth required, same as the per-Operation
 * leaderboard and the public roster.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 25;

    const leaderboard = await getGlobalXpLeaderboardDB(limit);
    return NextResponse.json({ leaderboard });
  } catch (error: any) {
    console.error('[API /leaderboard/global] Server error:', error);
    return NextResponse.json({ leaderboard: [], error: 'Failed to fetch global leaderboard' }, { status: 500 });
  }
}
