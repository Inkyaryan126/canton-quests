import { describe, expect, it, vi } from 'vitest';
import { listGridActiveAuctions } from '../lib/grid/server/auction-read-service';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import {
  createSupabaseGridAuctionReadPort,
  resolveSupabaseGridAuctionSeasonId,
} from '../lib/grid/server/supabase-auction-read';
import type { GridAuctionReadPort } from '../lib/grid/server/auction-read-port';

describe('Grid auction discovery', () => {
  it('validates season, viewer, and server time before reading', async () => {
    const port: GridAuctionReadPort = {
      listActiveAuctions: vi.fn().mockResolvedValue([]),
    };

    await expect(
      listGridActiveAuctions(port, {
        seasonId: ' ',
        viewerPlayerId: 'player-1',
        now: '2026-09-16T12:00:00.000Z',
      }),
    ).rejects.toThrow('seasonId');

    await expect(
      listGridActiveAuctions(port, {
        seasonId: 'season-1',
        viewerPlayerId: ' ',
        now: '2026-09-16T12:00:00.000Z',
      }),
    ).rejects.toThrow('viewerPlayerId');

    await expect(
      listGridActiveAuctions(port, {
        seasonId: 'season-1',
        viewerPlayerId: 'player-1',
        now: 'bad-time',
      }),
    ).rejects.toThrow('valid now timestamp');
  });



  it('resolves the runtime season from trusted city package slugs', async () => {
    const cityMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'city-1' },
      error: null,
    });
    const cityEq = vi.fn().mockReturnValue({ maybeSingle: cityMaybeSingle });
    const citySelect = vi.fn().mockReturnValue({ eq: cityEq });

    const seasonMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'season-1' },
      error: null,
    });
    const seasonSlugEq = vi.fn().mockReturnValue({
      maybeSingle: seasonMaybeSingle,
    });
    const seasonCityEq = vi.fn().mockReturnValue({ eq: seasonSlugEq });
    const seasonSelect = vi.fn().mockReturnValue({ eq: seasonCityEq });
    const from = vi.fn((table: string) =>
      table === 'grid_cities'
        ? { select: citySelect }
        : { select: seasonSelect },
    );

    await expect(
      resolveSupabaseGridAuctionSeasonId(
        cantonFoundingSeasonPackage,
        { from } as any,
      ),
    ).resolves.toBe('season-1');

    expect(cityEq).toHaveBeenCalledWith(
      'slug',
      cantonFoundingSeasonPackage.city.slug,
    );
    expect(seasonCityEq).toHaveBeenCalledWith('city_id', 'city-1');
    expect(seasonSlugEq).toHaveBeenCalledWith(
      'slug',
      cantonFoundingSeasonPackage.seasonTemplate.slug,
    );
  });

  it('sanitizes private property names and hides leader identity', async () => {
    const auctionOrder = vi.fn().mockResolvedValue({
      data: [{
        id: 'auction-1',
        season_id: 'season-1',
        city_id: 'city-1',
        property_id: 'property-1',
        status: 'scheduled',
        reserve_credits: 1500,
        minimum_bid_increment_credits: 100,
        starts_at: '2026-09-16T11:00:00.000Z',
        ends_at: '2026-09-17T12:00:00.000Z',
        leading_bidder_player_id: 'player-1',
        leading_bid_credits: 1800,
      }],
      error: null,
    });
    const auctionGt = vi.fn().mockReturnValue({ order: auctionOrder });
    const auctionIn = vi.fn().mockReturnValue({ gt: auctionGt });
    const auctionEq = vi.fn().mockReturnValue({ in: auctionIn });
    const auctionSelect = vi.fn().mockReturnValue({ eq: auctionEq });

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
      table === 'grid_property_auctions'
        ? { select: auctionSelect }
        : { select: propertySelect },
    );

    const port = createSupabaseGridAuctionReadPort({ from } as any);
    const rows = await port.listActiveAuctions({
      seasonId: 'season-1',
      viewerPlayerId: 'player-1',
      now: '2026-09-16T12:00:00.000Z',
    });

    expect(rows).toEqual([{
      auctionId: 'auction-1',
      seasonId: 'season-1',
      cityId: 'city-1',
      propertyId: 'property-1',
      propertySlug: 'private-property',
      propertyName: 'Grid Property',
      status: 'open',
      reserveCredits: 1500,
      minimumBidIncrementCredits: 100,
      startsAt: '2026-09-16T11:00:00.000Z',
      endsAt: '2026-09-17T12:00:00.000Z',
      leadingBidCredits: 1800,
      minimumNextBidCredits: 1900,
      viewerIsLeadingBidder: true,
    }]);

    expect(JSON.stringify(rows)).not.toContain('leading_bidder_player_id');
    expect(JSON.stringify(rows)).not.toContain('Private Name');
  });
});
