import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import {
  buildPublicGridProgressionLeaderboard,
  parsePublicGridProgressionBoard,
} from '@/lib/grid/server/public-progression-leaderboard';
import { resolveSupabaseGridSeason } from '@/lib/grid/server/supabase-grid-season';
import { createSupabaseGridProgressionLeaderboardDataPort } from '@/lib/grid/server/supabase-progression-leaderboard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isGridWorldReadEnabled()) {
    return NextResponse.json({ enabled: false, board: { type: 'overall' }, entries: [] });
  }

  try {
    const url = new URL(request.url);
    const board = parsePublicGridProgressionBoard(
      url.searchParams.get('board'),
      url.searchParams.get('stat'),
    );
    const rawLimit = Number(url.searchParams.get('limit') ?? 25);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 25;
    const season = await resolveSupabaseGridSeason(cantonFoundingSeasonPackage);
    if (!season) {
      return NextResponse.json({ enabled: true, seasonStatus: null, board, entries: [] });
    }

    const leaderboard = await buildPublicGridProgressionLeaderboard(
      createSupabaseGridProgressionLeaderboardDataPort(),
      { seasonId: season.seasonId, board, limit },
    );
    const response = NextResponse.json({
      enabled: true,
      seasonStatus: season.status,
      ...leaderboard,
    });
    response.headers.set('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
    return response;
  } catch (error) {
    if (error instanceof Error && (
      error.message.startsWith('Unknown Grid leaderboard') ||
      error.message.includes('is not ranking-enabled')
    )) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[Grid progression leaderboard]', error);
    return NextResponse.json(
      { error: 'Grid progression leaderboard unavailable' },
      { status: 500 },
    );
  }
}
