import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridMarketListingReadEnabled } from '@/lib/grid/server/market-listing-feature-flags';
import { listGridMarketTransactionFeed } from '@/lib/grid/server/market-transaction-read-service';
import { createSupabaseGridMarketTransactionReadPort } from '@/lib/grid/server/supabase-market-transaction-read';
import { resolveSupabaseGridMarketSeasonId } from '@/lib/grid/server/supabase-market-listing-read';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 20;

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

    const transactions = await listGridMarketTransactionFeed(
      createSupabaseGridMarketTransactionReadPort(),
      {
        seasonId,
        viewerPlayerId: session.player.id,
        limit: DEFAULT_LIMIT,
      },
    );

    return response({ success: true, transactions });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to load Grid market transaction history.';
    return response({ success: false, error: message }, { status: 400 });
  }
}
