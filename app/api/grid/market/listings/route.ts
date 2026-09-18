import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import {
  isGridMarketListingReadEnabled,
  isGridMarketListingWriteEnabled,
} from '@/lib/grid/server/market-listing-feature-flags';
import { openGridPlayerMarketListing } from '@/lib/grid/server/market-listing-action-service';
import { listGridOpenMarketListings } from '@/lib/grid/server/market-listing-read-service';
import { createSupabaseGridMarketSettlementPort } from '@/lib/grid/server/supabase-market-settlement';
import { createSupabaseGridPropertyActionPort } from '@/lib/grid/server/supabase-property-action';
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


export async function POST(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };

  if (!isGridMarketListingWriteEnabled()) {
    return response(
      { success: false, error: 'Grid market listing writes are not enabled.' },
      { status: 404 },
    );
  }
  if (!session.player) {
    return response(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const propertySlug =
    typeof body.propertySlug === 'string' ? body.propertySlug : '';
  const priceCredits =
    typeof body.priceCredits === 'number' ? body.priceCredits : Number.NaN;
  const durationMinutes =
    typeof body.durationMinutes === 'number' ? body.durationMinutes : Number.NaN;
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';

  if (
    !propertySlug.trim() ||
    !Number.isSafeInteger(priceCredits) ||
    !Number.isSafeInteger(durationMinutes) ||
    !idempotencyKey.trim()
  ) {
    return response(
      {
        success: false,
        error:
          'Missing propertySlug, integer priceCredits, integer durationMinutes, or idempotencyKey.',
      },
      { status: 400 },
    );
  }

  try {
    const listing = await openGridPlayerMarketListing(
      createSupabaseGridPropertyActionPort(cantonFoundingSeasonPackage),
      createSupabaseGridMarketSettlementPort(),
      {
        sellerPlayerId: session.player.id,
        propertySlug,
        priceCredits,
        durationMinutes,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );

    return response({ success: true, listing });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to open Grid market listing.';
    return response({ success: false, error: message }, { status: 400 });
  }
}
