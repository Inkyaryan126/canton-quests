import { describe, expect, it } from 'vitest';
import {
  calculateGridFixedPriceListingTax,
  cancelGridFixedPriceListing,
  openGridFixedPriceListing,
  planGridFixedPricePurchase,
  projectGridFixedPriceListingStatus,
  validateGridFixedPriceListingRules,
} from '../lib/grid/core/market-listings';
import type {
  GridFixedPriceListingRequest,
  GridFixedPriceListingRules,
  GridMarketAssetSnapshot,
  GridMarketBuyerSnapshot,
} from '../lib/grid/core/market-listing-types';

const rules: GridFixedPriceListingRules = {
  transactionTaxBps: 500,
  propertyTradeCooldownMinutes: 60,
  minimumPriceCredits: 100,
  maximumPriceCredits: 100_000,
  minimumListingDurationMinutes: 30,
  maximumListingDurationMinutes: 7 * 24 * 60,
};

const asset = (
  overrides: Partial<GridMarketAssetSnapshot> = {},
): GridMarketAssetSnapshot => ({
  assetId: 'property-1',
  kind: 'property',
  cityId: 'canton',
  ownerPlayerId: 'seller',
  tradable: true,
  majorLandmark: false,
  acquiredAt: '2026-09-16T18:00:00.000Z',
  ...overrides,
});

const request = (
  overrides: Partial<GridFixedPriceListingRequest> = {},
): GridFixedPriceListingRequest => ({
  listingId: 'listing-1',
  cityId: 'canton',
  sellerPlayerId: 'seller',
  sellerCityId: 'canton',
  assetId: 'property-1',
  priceCredits: 1_000,
  createdAt: '2026-09-16T20:00:00.000Z',
  expiresAt: '2026-09-17T20:00:00.000Z',
  ...overrides,
});

const buyer = (
  overrides: Partial<GridMarketBuyerSnapshot> = {},
): GridMarketBuyerSnapshot => ({
  playerId: 'buyer',
  cityId: 'canton',
  creditBalance: 2_000,
  ...overrides,
});

function openedListing() {
  const result = openGridFixedPriceListing(request(), asset(), rules);
  if (!result.accepted || !result.listing) {
    throw new Error('test listing failed to open');
  }
  return result.listing;
}

describe('Grid fixed-price market listings', () => {
  it('opens a valid property listing without mutating ownership', () => {
    const result = openGridFixedPriceListing(request(), asset(), rules);

    expect(result.accepted).toBe(true);
    expect(result.listing).toEqual({
      listingId: 'listing-1',
      cityId: 'canton',
      sellerPlayerId: 'seller',
      assetId: 'property-1',
      assetKind: 'property',
      priceCredits: 1_000,
      createdAt: '2026-09-16T20:00:00.000Z',
      expiresAt: '2026-09-17T20:00:00.000Z',
      status: 'open',
    });
  });

  it('projects scheduled, open, expired, sold, and cancelled states deterministically', () => {
    const listing = openedListing();

    expect(
      projectGridFixedPriceListingStatus(
        listing,
        '2026-09-16T19:00:00.000Z',
      ),
    ).toBe('scheduled');
    expect(
      projectGridFixedPriceListingStatus(
        listing,
        '2026-09-16T21:00:00.000Z',
      ),
    ).toBe('open');
    expect(
      projectGridFixedPriceListingStatus(
        listing,
        '2026-09-17T20:00:00.000Z',
      ),
    ).toBe('expired');
    expect(
      projectGridFixedPriceListingStatus(
        { ...listing, status: 'sold' },
        '2026-09-18T20:00:00.000Z',
      ),
    ).toBe('sold');
    expect(
      projectGridFixedPriceListingStatus(
        { ...listing, status: 'cancelled' },
        '2026-09-18T20:00:00.000Z',
      ),
    ).toBe('cancelled');
  });

  it('plans an atomic purchase with buyer-paid tax and seller proceeds', () => {
    const result = planGridFixedPricePurchase(
      openedListing(),
      buyer(),
      asset(),
      rules,
      '2026-09-16T21:00:00.000Z',
    );

    expect(result).toMatchObject({
      purchasable: true,
      listingId: 'listing-1',
      buyerPlayerId: 'buyer',
      sellerPlayerId: 'seller',
      priceCredits: 1_000,
      taxCredits: 50,
      buyerTotalDebitCredits: 1_050,
      buyerCreditDelta: -1_050,
      sellerCreditDelta: 1_000,
      assetTransfer: {
        assetId: 'property-1',
        kind: 'property',
        fromPlayerId: 'seller',
        toPlayerId: 'buyer',
      },
      nextListing: {
        status: 'sold',
        buyerPlayerId: 'buyer',
        soldAt: '2026-09-16T21:00:00.000Z',
      },
    });
  });

  it('calculates transaction tax with deterministic integer flooring', () => {
    expect(calculateGridFixedPriceListingTax(999, rules)).toBe(49);
    expect(calculateGridFixedPriceListingTax(1_000, rules)).toBe(50);
  });

  it('keeps sellers, buyers, listings, and assets inside one city economy', () => {
    expect(
      openGridFixedPriceListing(
        request({ sellerCityId: 'cleveland' }),
        asset(),
        rules,
      ).reason,
    ).toBe('city-mismatch');

    expect(
      planGridFixedPricePurchase(
        openedListing(),
        buyer({ cityId: 'cleveland' }),
        asset(),
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('city-mismatch');

    expect(
      planGridFixedPricePurchase(
        openedListing(),
        buyer(),
        asset({ cityId: 'cleveland' }),
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('city-mismatch');
  });

  it('requires seller ownership both when listing and when buying', () => {
    expect(
      openGridFixedPriceListing(
        request(),
        asset({ ownerPlayerId: 'someone-else' }),
        rules,
      ).reason,
    ).toBe('asset-owner-mismatch');

    expect(
      planGridFixedPricePurchase(
        openedListing(),
        buyer(),
        asset({ ownerPlayerId: 'someone-else' }),
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('asset-owner-mismatch');
  });

  it('blocks non-tradable assets and major landmarks at listing and purchase time', () => {
    expect(
      openGridFixedPriceListing(
        request(),
        asset({ tradable: false }),
        rules,
      ).reason,
    ).toBe('asset-not-tradable');

    expect(
      openGridFixedPriceListing(
        request(),
        asset({ majorLandmark: true }),
        rules,
      ).reason,
    ).toBe('major-landmark');

    expect(
      planGridFixedPricePurchase(
        openedListing(),
        buyer(),
        asset({ majorLandmark: true }),
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('major-landmark');
  });

  it('enforces post-capture cooldown when opening and re-checks it at purchase time', () => {
    const recent = asset({
      acquiredAt: '2026-09-16T19:30:00.000Z',
    });

    expect(
      openGridFixedPriceListing(request(), recent, rules).reason,
    ).toBe('property-cooldown-active');

    const listing = openedListing();
    const changedAcquisition = asset({
      acquiredAt: '2026-09-16T20:30:00.000Z',
    });

    expect(
      planGridFixedPricePurchase(
        listing,
        buyer(),
        changedAcquisition,
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('property-cooldown-active');

    expect(
      openGridFixedPriceListing(
        request(),
        asset({ acquiredAt: null }),
        rules,
      ).reason,
    ).toBe('property-cooldown-unverifiable');
  });

  it('enforces configured price and duration bounds', () => {
    expect(
      openGridFixedPriceListing(
        request({ priceCredits: 99 }),
        asset(),
        rules,
      ).reason,
    ).toBe('price-out-of-range');

    expect(
      openGridFixedPriceListing(
        request({ priceCredits: 100_001 }),
        asset(),
        rules,
      ).reason,
    ).toBe('price-out-of-range');

    expect(
      openGridFixedPriceListing(
        request({
          expiresAt: '2026-09-16T20:29:59.999Z',
        }),
        asset(),
        rules,
      ).reason,
    ).toBe('duration-out-of-range');
  });

  it('rejects self-purchases, expired purchases, and already closed listings', () => {
    const listing = openedListing();

    expect(
      planGridFixedPricePurchase(
        listing,
        buyer({ playerId: 'seller' }),
        asset(),
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('seller-cannot-buy');

    expect(
      planGridFixedPricePurchase(
        listing,
        buyer(),
        asset(),
        rules,
        '2026-09-17T20:00:00.000Z',
      ).reason,
    ).toBe('outside-listing-window');

    expect(
      planGridFixedPricePurchase(
        { ...listing, status: 'cancelled' },
        buyer(),
        asset(),
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('listing-not-open');
  });

  it('requires the buyer to cover price plus tax without using future sale proceeds', () => {
    const result = planGridFixedPricePurchase(
      openedListing(),
      buyer({ creditBalance: 1_049 }),
      asset(),
      rules,
      '2026-09-16T21:00:00.000Z',
    );

    expect(result).toMatchObject({
      purchasable: false,
      reason: 'insufficient-credits',
    });
  });

  it('allows only the seller to cancel an active listing', () => {
    const listing = openedListing();

    expect(
      cancelGridFixedPriceListing(
        listing,
        'buyer',
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('seller-only');

    const cancelled = cancelGridFixedPriceListing(
      listing,
      'seller',
      '2026-09-16T21:00:00.000Z',
    );
    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.nextListing).toMatchObject({
      status: 'cancelled',
      cancelledAt: '2026-09-16T21:00:00.000Z',
    });

    expect(
      cancelGridFixedPriceListing(
        listing,
        'seller',
        '2026-09-17T20:00:00.000Z',
      ).reason,
    ).toBe('outside-listing-window');
  });

  it('validates rule configuration and malformed timestamps', () => {
    expect(() =>
      validateGridFixedPriceListingRules({
        ...rules,
        transactionTaxBps: 10_001,
      }),
    ).toThrow(/cannot exceed 10000/);

    expect(() =>
      validateGridFixedPriceListingRules({
        ...rules,
        maximumPriceCredits: 99,
      }),
    ).toThrow(/at least minimumPriceCredits/);

    expect(() =>
      validateGridFixedPriceListingRules({
        ...rules,
        maximumListingDurationMinutes: 29,
      }),
    ).toThrow(/at least minimumListingDurationMinutes/);

    expect(() =>
      openGridFixedPriceListing(
        request({
          expiresAt: '2026-09-16T19:00:00.000Z',
        }),
        asset(),
        rules,
      ),
    ).toThrow(/expiresAt must be after createdAt/);
  });

  it('guards tax-added purchase totals against unsafe integer overflow', () => {
    const overflowRules: GridFixedPriceListingRules = {
      ...rules,
      transactionTaxBps: 10_000,
      minimumPriceCredits: 1,
      maximumPriceCredits: Number.MAX_SAFE_INTEGER,
    };
    const listing = openGridFixedPriceListing(
      request({
        priceCredits: Number.MAX_SAFE_INTEGER,
      }),
      asset(),
      overflowRules,
    );

    expect(listing.accepted).toBe(true);
    expect(() =>
      planGridFixedPricePurchase(
        listing.listing!,
        buyer({ creditBalance: Number.MAX_SAFE_INTEGER }),
        asset(),
        overflowRules,
        '2026-09-16T21:00:00.000Z',
      ),
    ).toThrow(/buyerTotalDebitCredits exceeds safe integer range/);
  });
});
