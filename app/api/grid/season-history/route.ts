import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { readPublicGridSeasonHistory } from '@/lib/grid/server/season-history-service';
import { createSupabaseGridSeasonHistoryPort } from '@/lib/grid/server/supabase-season-history';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isGridWorldReadEnabled()) {
    return NextResponse.json({
      enabled: false,
      archive: null,
      entries: [],
    });
  }

  try {
    const history = await readPublicGridSeasonHistory(
      createSupabaseGridSeasonHistoryPort(),
      cantonFoundingSeasonPackage.city.slug,
      cantonFoundingSeasonPackage.seasonTemplate.slug,
    );

    const response = NextResponse.json({
      enabled: true,
      ...history,
    });
    response.headers.set(
      'Cache-Control',
      history.archive
        ? 'public, s-maxage=300, stale-while-revalidate=900'
        : 'public, s-maxage=15, stale-while-revalidate=30',
    );
    return response;
  } catch (error) {
    console.error('[Grid season history]', error);
    return NextResponse.json(
      { error: 'Grid season history unavailable' },
      { status: 500 },
    );
  }
}
