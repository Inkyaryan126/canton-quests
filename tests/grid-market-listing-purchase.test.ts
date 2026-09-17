import { describe, expect, it, vi } from 'vitest';
import { purchaseGridMarketListing } from '../lib/grid/server/market-listing-purchase-service';
import type {
  GridMarketListingPurchaseContext,
  GridMarketListingPurchaseReadPort,
} from '../lib/grid/server/market-listing-purchase-port';
import type {
  GridMarketSettlementPort,
  GridMarketSettlementResult,
} from '../lib/grid/server/market-settlement-port';

const command = {
  seasonId: 'season-1',
  listingId: 'listing-1',
  buyerPlayerId: 'buyer-1',
  idempotencyKey: 'purchase:one',
  now: '2026-09-17T12:00:00.000Z',
};

function context(
  overrides: Partial<GridMarketListingPurchaseContext> = {},
): GridMarketListingPurchaseContext {
  return {
    listing: {
      listingId: 'listing-1',
      cityId: 'city-1',
      sellerPlayerId: 'seller-1',
      propertyId: 'property-1',
      priceCredits: 5000,
      createdAt: '2026-09-17T10:00:00.000Z',
      expiresAt: '2026-09-18T10:00:00.000Z',
      status: 'open',
    },
    property: {
      propertyId: 'property-1',
      cityId: 'city-1',
      ownerPlayerId: 'seller-1',
      tradable: true,
      majorLandmark: false,
      acquiredAt: '2026-09-01T00:00:00.000Z',
      baseValueCredits: 4000,
    },
    buyer: {
      playerId: 'buyer-1',
      cityId: 'city-1',
      creditBalance: 10_000,
    },
    ...overrides,
  };
}

function readPort(
  ctx: GridMarketListingPurchaseContext,
): GridMarketListingPurchaseReadPort {
  return { loadPurchaseContext: vi.fn().mockResolvedValue(ctx) };
}

const settlementResult: GridMarketSettlementResult = {
  transactionId: command.idempotencyKey,
  seasonId: command.seasonId,
  cityId: 'city-1',
  source: 'fixed-price',
  sourceId: 'listing-1',
  occurredAt: command.now,
  participantIds: ['buyer-1', 'seller-1'],
  creditsAfter: { 'buyer-1': 4750, 'seller-1': 5000 },
  propertyOwnerPlayerIds: { 'property-1': 'buyer-1' },
  totalTaxCredits: 250,
  eventId: 'event-1',
};

function settlementPort(): GridMarketSettlementPort {
  return {
    openFixedPricePropertyListing: vi.fn(),
    cancelFixedPricePropertyListing: vi.fn(),
    settleTransaction: vi.fn().mockResolvedValue(settlementResult),
  };
}

describe('Grid market listing purchase', () => {
  it('settles a purchasable listing through the canonical settlement port', async () => {
    const port = settlementPort();
    const outcome = await purchaseGridMarketListing(
      readPort(context()),
      port,
      command,
    );

    expect(outcome).toEqual({ purchased: true, settlement: settlementResult });
    expect(port.settleTransaction).toHaveBeenCalledTimes(1);
    const call = (port.settleTransaction as any).mock.calls[0][0];
    expect(call.seasonId).toBe('season-1');
    expect(call.idempotencyKey).toBe('purchase:one');
    expect(call.transaction.source).toBe('fixed-price');
    expect(call.transaction.sourceId).toBe('listing-1');
    expect(call.transaction.creditTransfers).toEqual([
      { fromPlayerId: 'buyer-1', toPlayerId: 'seller-1', amountCredits: 5000 },
    ]);
  });

  it('rejects when the listing no longer exists', async () => {
    const outcome = await purchaseGridMarketListing(
      readPort(context({ listing: null })),
      settlementPort(),
      command,
    );
    expect(outcome).toEqual({ purchased: false, reason: 'listing-not-found' });
  });

  it('rejects when the property snapshot is missing', async () => {
    const outcome = await purchaseGridMarketListing(
      readPort(context({ property: null })),
      settlementPort(),
      command,
    );
    expect(outcome).toEqual({ purchased: false, reason: 'property-not-found' });
  });

  it('rejects when the buyer has not joined the season', async () => {
    const outcome = await purchaseGridMarketListing(
      readPort(context({ buyer: null })),
      settlementPort(),
      command,
    );
    expect(outcome).toEqual({ purchased: false, reason: 'buyer-not-joined' });
  });

  it('rejects the buyer purchasing their own listing without calling settlement', async () => {
    const port = settlementPort();
    const outcome = await purchaseGridMarketListing(
      readPort(
        context({
          buyer: { playerId: 'seller-1', cityId: 'city-1', creditBalance: 10_000 },
        }),
      ),
      port,
      { ...command, buyerPlayerId: 'seller-1' },
    );
    expect(outcome).toEqual({ purchased: false, reason: 'seller-cannot-buy' });
    expect(port.settleTransaction).not.toHaveBeenCalled();
  });

  it('rejects a buyer without enough Credits without calling settlement', async () => {
    const port = settlementPort();
    const outcome = await purchaseGridMarketListing(
      readPort(
        context({
          buyer: { playerId: 'buyer-1', cityId: 'city-1', creditBalance: 100 },
        }),
      ),
      port,
      command,
    );
    expect(outcome).toEqual({ purchased: false, reason: 'insufficient-credits' });
    expect(port.settleTransaction).not.toHaveBeenCalled();
  });

  it('rejects a property still in its post-acquisition cooldown', async () => {
    const port = settlementPort();
    const outcome = await purchaseGridMarketListing(
      readPort(
        context({
          property: {
            propertyId: 'property-1',
            cityId: 'city-1',
            ownerPlayerId: 'seller-1',
            tradable: true,
            majorLandmark: false,
            acquiredAt: command.now,
            baseValueCredits: 4000,
          },
        }),
      ),
      port,
      command,
    );
    expect(outcome).toEqual({
      purchased: false,
      reason: 'property-cooldown-active',
    });
    expect(port.settleTransaction).not.toHaveBeenCalled();
  });
});
