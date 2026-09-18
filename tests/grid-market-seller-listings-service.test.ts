import { describe, expect, it, vi } from 'vitest';
import { GRID_MARKET_LISTING_RULES } from '../lib/grid/server/market-listing-rules';
import type { GridMarketSettlementPort } from '../lib/grid/server/market-settlement-port';
import {
  cancelGridPlayerMarketListing,
  openGridPlayerMarketListing,
} from '../lib/grid/server/market-listing-action-service';

const now = '2026-09-18T06:00:00.000Z';

function settlementPort(): GridMarketSettlementPort {
  return {
    openFixedPricePropertyListing: vi.fn().mockResolvedValue({
      listingId: 'fixed:open-1',
      seasonId: 'season-1',
      cityId: 'city-1',
      sellerPlayerId: 'player-1',
      propertyId: 'property-id-1',
      priceCredits: 750,
      createdAt: now,
      expiresAt: '2026-09-19T06:00:00.000Z',
      status: 'open',
      eventId: 'event-1',
    }),
    cancelFixedPricePropertyListing: vi.fn().mockResolvedValue({
      listingId: 'fixed:open-1',
      seasonId: 'season-1',
      status: 'cancelled',
      cancelledAt: now,
      eventId: 'event-2',
    }),
    settleTransaction: vi.fn(),
  };
}

describe('Grid player market listing actions', () => {
  it('derives listing id and authoritative property target on the server', async () => {
    const targetPort = {
      resolveTarget: vi.fn().mockResolvedValue({
        seasonId: 'season-1',
        seasonStatus: 'active',
        propertyId: 'property-id-1',
      }),
    };
    const port = settlementPort();

    const result = await openGridPlayerMarketListing(targetPort, port, {
      sellerPlayerId: 'player-1',
      propertySlug: 'property-one',
      priceCredits: 750,
      durationMinutes: 1440,
      idempotencyKey: 'open-1',
      now,
    });

    expect(targetPort.resolveTarget).toHaveBeenCalledWith('property-one');
    expect(port.openFixedPricePropertyListing).toHaveBeenCalledWith({
      seasonId: 'season-1',
      listingId: 'fixed:open-1',
      sellerPlayerId: 'player-1',
      propertyId: 'property-id-1',
      priceCredits: 750,
      createdAt: now,
      expiresAt: '2026-09-19T06:00:00.000Z',
      minimumPriceCredits: GRID_MARKET_LISTING_RULES.minimumPriceCredits,
      maximumPriceCredits: GRID_MARKET_LISTING_RULES.maximumPriceCredits,
      minimumListingDurationMinutes:
        GRID_MARKET_LISTING_RULES.minimumListingDurationMinutes,
      maximumListingDurationMinutes:
        GRID_MARKET_LISTING_RULES.maximumListingDurationMinutes,
      propertyTradeCooldownMinutes:
        GRID_MARKET_LISTING_RULES.propertyTradeCooldownMinutes,
      idempotencyKey: 'open-1',
      now,
    });
    expect(result).toEqual({
      listingId: 'fixed:open-1',
      propertySlug: 'property-one',
      priceCredits: 750,
      createdAt: now,
      expiresAt: '2026-09-19T06:00:00.000Z',
      status: 'open',
    });
    expect(result).not.toHaveProperty('sellerPlayerId');
    expect(result).not.toHaveProperty('propertyId');
    expect(result).not.toHaveProperty('seasonId');
    expect(result).not.toHaveProperty('eventId');
  });

  it('rejects inactive seasons before opening a listing', async () => {
    const targetPort = {
      resolveTarget: vi.fn().mockResolvedValue({
        seasonId: 'season-1',
        seasonStatus: 'draft',
        propertyId: 'property-id-1',
      }),
    };
    const port = settlementPort();

    await expect(
      openGridPlayerMarketListing(targetPort, port, {
        sellerPlayerId: 'player-1',
        propertySlug: 'property-one',
        priceCredits: 750,
        durationMinutes: 1440,
        idempotencyKey: 'open-2',
        now,
      }),
    ).rejects.toThrow('active season and valid property');
    expect(port.openFixedPricePropertyListing).not.toHaveBeenCalled();
  });

  it('cancels through the seller-authorized atomic listing command', async () => {
    const port = settlementPort();
    const result = await cancelGridPlayerMarketListing(port, {
      seasonId: 'season-1',
      sellerPlayerId: 'player-1',
      listingId: 'fixed:open-1',
      idempotencyKey: 'cancel-1',
      now,
    });

    expect(port.cancelFixedPricePropertyListing).toHaveBeenCalledWith({
      seasonId: 'season-1',
      listingId: 'fixed:open-1',
      sellerPlayerId: 'player-1',
      idempotencyKey: 'cancel-1',
      now,
    });
    expect(result).toEqual({
      listingId: 'fixed:open-1',
      status: 'cancelled',
      cancelledAt: now,
    });
    expect(result).not.toHaveProperty('sellerPlayerId');
    expect(result).not.toHaveProperty('eventId');
  });
});
