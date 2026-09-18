import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { buildPublicGridCityPowerLeaderboard } from '@/lib/grid/server/city-power-progression-service';
import { resolveSupabaseGridSeason } from '@/lib/grid/server/supabase-grid-season';
import { createSupabaseGridProgressionLeaderboardDataPort } from '@/lib/grid/server/supabase-progression-leaderboard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isGridWorldReadEnabled()) {
    return NextResponse.json({
      enabled: false,
      board: { type: 'city-power' },
      entries: [],
    });
  }

  const config = cantonFoundingSeasonPackage.seasonTemplate.cityPower;
  if (!config) {
    return NextResponse.json(
      { error: 'Grid City Power is not configured for this season.' },
      { status: 503 },
    );
  }

  try {
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get('limit') ?? 25);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 25;
    const season = await resolveSupabaseGridSeason(cantonFoundingSeasonPackage);

    if (!season) {
      return NextResponse.json({
        enabled: true,
        seasonStatus: null,
        board: { type: 'city-power' },
        entries: [],
      });
    }

    const leaderboard = await buildPublicGridCityPowerLeaderboard(
      createSupabaseGridProgressionLeaderboardDataPort(),
      {
        seasonId: season.seasonId,
        config,
        limit,
      },
    );

    const response = NextResponse.json({
      enabled: true,
      seasonStatus: season.status,
      ...leaderboard,
    });
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=15, stale-while-revalidate=30',
    );
    return response;
  } catch (error) {
    console.error('[Grid City Power leaderboard]', error);
    return NextResponse.json(
      { error: 'Grid City Power leaderboard unavailable' },
      { status: 500 },
    );
  }
}
