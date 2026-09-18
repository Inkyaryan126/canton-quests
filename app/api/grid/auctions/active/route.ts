import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import {
  isGridAuctionReadEnabled,
  isGridAuctionWriteEnabled,
} from '@/lib/grid/server/auction-feature-flags';
import { listGridActiveAuctions } from '@/lib/grid/server/auction-read-service';
import { settleExpiredGridAuctions } from '@/lib/grid/server/auction-settlement-sweep-service';
import { createSupabaseGridAuctionSettlementSweepPort } from '@/lib/grid/server/supabase-auction-settlement-sweep';
import { createSupabaseGridAuctionCommandPort } from '@/lib/grid/server/supabase-auction';
import {
  createSupabaseGridAuctionReadPort,
  resolveSupabaseGridAuctionSeasonId,
} from '@/lib/grid/server/supabase-auction-read';
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
    const now = new Date().toISOString();
    let settlementWarning: string | null = null;

    if (isGridAuctionWriteEnabled()) {
      try {
        const sweep = await settleExpiredGridAuctions(
          createSupabaseGridAuctionSettlementSweepPort(),
          createSupabaseGridAuctionCommandPort(),
          { seasonId, now, limit: 25 },
        );
        if (sweep.failed > 0) {
          settlementWarning =
            `${sweep.failed} expired auction${sweep.failed === 1 ? '' : 's'} could not be settled yet.`;
        }
      } catch {
        settlementWarning = 'Expired auction settlement is temporarily unavailable.';
      }
    }

    const auctions = await listGridActiveAuctions(
      createSupabaseGridAuctionReadPort(),
      {
        seasonId,
        viewerPlayerId: session.player.id,
        now,
      },
    );
    return response({ success: true, auctions, settlementWarning });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to discover active Grid auctions.';
    return response({ success: false, error: message }, { status: 400 });
  }
}
