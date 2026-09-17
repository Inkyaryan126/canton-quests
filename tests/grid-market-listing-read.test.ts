import { describe, expect, it, vi } from 'vitest';
import {
  getGridMarketListing,
  listGridOpenMarketListings,
} from '../lib/grid/server/market-listing-read-service';
import { createSupabaseGridMarketListingReadPort } from '../lib/grid/server/supabase-market-listing-read';
import type { GridMarketListingReadPort } from '../lib/grid/server/market-listing-read-port';

describe('Grid market listing discovery', () => {
  it('validates season, viewer, and server time before reading', async () => {
    const port: GridMarketListingReadPort = {
      listOpenListings: vi.fn().mockResolvedValue([]),
      getListing: vi.fn().mockResolvedValue(null),
    };

    await expect(
      listGridOpenMarketListings(port, {
        seasonId: ' ',
        viewerPlayerId: 'player-1',
        now: '2026-09-17T12:00:00.000Z',
      }),
    ).rejects.toThrow('seasonId');

    await expect(
      listGridOpenMarketListings(port, {
        seasonId: 'season-1',
        viewerPlayerId: 'player-1',
        now: 'bad-time',
      }),
    ).rejects.toThrow('valid now timestamp');

    expect(port.listOpenListings).not.toHaveBeenCalled();
  });

  it('validates listingId before reading a single listing', async () => {
    const port: GridMarketListingReadPort = {
      listOpenListings: vi.fn().mockResolvedValue([]),
      getListing: vi.fn().mockResolvedValue(null),
    };

    await expect(
      getGridMarketListing(port, {
        seasonId: 'season-1',
        listingId: ' ',
        viewerPlayerId: 'player-1',
        now: '2026-09-17T12:00:00.000Z',
      }),
    ).rejects.toThrow('listingId');

    expect(port.getListing).not.toHaveBeenCalled();
  });

  it('sanitizes private property names and hides the seller identity except to the seller', async () => {
    const listingOrder = vi.fn().mockResolvedValue({
      data: [{
        listing_id: 'listing-1',
        season_id: 'season-1',
        city_id: 'city-1',
        property_id: 'property-1',
        seller_player_id: 'seller-1',
        price_credits: 5000,
        created_at: '2026-09-17T10:00:00.000Z',
        expires_at: '2026-09-18T10:00:00.000Z',
      }],
      error: null,
    });
    const listingGt = vi.fn().mockReturnValue({ order: listingOrder });
    const listingLte = vi.fn().mockReturnValue({ gt: listingGt });
    const listingEqStatus = vi.fn().mockReturnValue({ lte: listingLte });
    const listingEqSeason = vi.fn().mockReturnValue({ eq: listingEqStatus });
    const listingSelect = vi.fn().mockReturnValue({ eq: listingEqSeason });

    const propertyIn = vi.fn().mockResolvedValue({
      data: [{
        id: 'property-1',
        slug: 'private-property',
        display_name: 'Private Name',
        public_name_safe: false,
      }],
      error: null,
    });
    const propertySelect = vi.fn().mockReturnValue({ in: propertyIn });

    const from = vi.fn((table: string) =>
      table === 'grid_market_fixed_price_listings'
        ? { select: listingSelect }
        : { select: propertySelect },
    );

    const port = createSupabaseGridMarketListingReadPort({ from } as any);

    const asBuyer = await port.listOpenListings({
      seasonId: 'season-1',
      viewerPlayerId: 'buyer-1',
      now: '2026-09-17T12:00:00.000Z',
    });
    expect(asBuyer).toEqual([{
      listingId: 'listing-1',
      seasonId: 'season-1',
      cityId: 'city-1',
      propertyId: 'property-1',
      propertySlug: 'private-property',
      propertyName: 'Grid Property',
      status: 'open',
      priceCredits: 5000,
      createdAt: '2026-09-17T10:00:00.000Z',
      expiresAt: '2026-09-18T10:00:00.000Z',
      viewerIsSeller: false,
    }]);
    expect(JSON.stringify(asBuyer)).not.toContain('seller-1');
    expect(JSON.stringify(asBuyer)).not.toContain('Private Name');

    const asSeller = await port.listOpenListings({
      seasonId: 'season-1',
      viewerPlayerId: 'seller-1',
      now: '2026-09-17T12:00:00.000Z',
    });
    expect(asSeller[0].viewerIsSeller).toBe(true);
  });
});
