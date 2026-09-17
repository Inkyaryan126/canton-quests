import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridMarketListingReadEnabled } from '@/lib/grid/server/market-listing-feature-flags';
import { listGridOpenMarketListings } from '@/lib/grid/server/market-listing-read-service';
import {
  createSupabaseGridMarketListingReadPort,
  resolveSupabaseGridMarketSeasonId,
} from '@/lib/grid/server/supabase-market-listing-read';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };

  if (!isGridMarketListingReadEnabled()) {
    return response(
      { success: false, error: 'The Grid market is not enabled.' },
      { status: 404 },
    );
  }
  if (!session.player) {
    return response(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  try {
    const seasonId = await resolveSupabaseGridMarketSeasonId(
      cantonFoundingSeasonPackage,
    );
    if (!seasonId) {
      return response(
        { success: false, error: 'Grid season is not available.' },
        { status: 404 },
      );
    }

    const listings = await listGridOpenMarketListings(
      createSupabaseGridMarketListingReadPort(),
      {
        seasonId,
        viewerPlayerId: session.player.id,
        now: new Date().toISOString(),
      },
    );

    return response({ success: true, listings });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to discover Grid market listings.';
    return response({ success: false, error: message }, { status: 400 });
  }
}
