import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridMarketListingWriteEnabled } from '@/lib/grid/server/market-listing-feature-flags';
import type { GridMarketListingPurchaseFailureReason } from '@/lib/grid/server/market-listing-purchase-service';
import { purchaseGridMarketListing } from '@/lib/grid/server/market-listing-purchase-service';
import { createSupabaseGridMarketListingPurchaseReadPort } from '@/lib/grid/server/supabase-market-listing-purchase';
import { resolveSupabaseGridMarketSeasonId } from '@/lib/grid/server/supabase-market-listing-read';
import { createSupabaseGridMarketSettlementPort } from '@/lib/grid/server/supabase-market-settlement';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

const FAILURE_MESSAGES: Record<GridMarketListingPurchaseFailureReason, string> = {
  'listing-not-found': 'This listing is no longer available.',
  'property-not-found': 'This property could not be found.',
  'buyer-not-joined': 'Join the Grid season before trading on the market.',
  'listing-not-open': 'This listing is no longer open.',
  'outside-listing-window': 'This listing has expired.',
  'seller-cannot-buy': 'You cannot buy your own listing.',
  'city-mismatch': 'This listing is not available in your city.',
  'asset-mismatch': 'This listing no longer matches its property.',
  'asset-owner-mismatch': 'The seller no longer owns this property.',
  'asset-not-tradable': 'This property cannot be traded.',
  'major-landmark': 'Major landmarks cannot be traded.',
  'property-cooldown-unverifiable': 'This property cannot be verified for trade yet.',
  'property-cooldown-active': 'This property is still in its post-acquisition cooldown.',
  'insufficient-credits': 'You do not have enough Credits for this purchase.',
};

export async function POST(
  request: Request,
  context: { params: { listingId: string } },
) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };

  if (!isGridMarketListingWriteEnabled()) {
    return response(
      { success: false, error: 'Grid market purchases are not enabled.' },
      { status: 404 },
    );
  }
  if (!session.player) {
    return response(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const listingId = context.params.listingId ?? '';
  const body = await request.json().catch(() => ({}));
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';

  if (!listingId.trim()) {
    return response(
      { success: false, error: 'Missing listingId.' },
      { status: 400 },
    );
  }
  if (!idempotencyKey.trim()) {
    return response(
      { success: false, error: 'Missing idempotencyKey.' },
      { status: 400 },
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

    const outcome = await purchaseGridMarketListing(
      createSupabaseGridMarketListingPurchaseReadPort(),
      createSupabaseGridMarketSettlementPort(),
      {
        seasonId,
        listingId,
        buyerPlayerId: session.player.id,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );

    if (!outcome.purchased) {
      return response(
        {
          success: false,
          reason: outcome.reason,
          error: FAILURE_MESSAGES[outcome.reason] ?? 'Purchase was rejected.',
        },
        { status: 400 },
      );
    }

    return response({ success: true, settlement: outcome.settlement });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to complete the Grid market purchase.';
    return response({ success: false, error: message }, { status: 400 });
  }
}
