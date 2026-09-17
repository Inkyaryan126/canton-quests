import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridAuctionReadEnabled } from '@/lib/grid/server/auction-feature-flags';
import { getGridActiveAuction } from '@/lib/grid/server/auction-read-service';
import {
  createSupabaseGridAuctionReadPort,
  resolveSupabaseGridAuctionSeasonId,
} from '@/lib/grid/server/supabase-auction-read';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: { auctionId: string } },
) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };

  if (!isGridAuctionReadEnabled()) {
    return response(
      { success: false, error: 'Grid auctions are not enabled.' },
      { status: 404 },
    );
  }
  if (!session.player) {
    return response(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const auctionId = context.params.auctionId ?? '';
  if (!auctionId.trim()) {
    return response(
      { success: false, error: 'Missing auctionId.' },
      { status: 400 },
    );
  }

  try {
    const seasonId = await resolveSupabaseGridAuctionSeasonId(
      cantonFoundingSeasonPackage,
    );
    if (!seasonId) {
      return response(
        { success: false, error: 'Grid season is not available.' },
        { status: 404 },
      );
    }

    const auction = await getGridActiveAuction(
      createSupabaseGridAuctionReadPort(),
      {
        seasonId,
        auctionId,
        viewerPlayerId: session.player.id,
        now: new Date().toISOString(),
      },
    );

    if (!auction) {
      return response(
        { success: false, error: 'This auction is no longer active.' },
        { status: 404 },
      );
    }

    return response({ success: true, auction });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to load the Grid auction.';
    return response({ success: false, error: message }, { status: 400 });
  }
}
