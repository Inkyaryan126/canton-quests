import { describe, expect, it } from 'vitest';
import {
  buildGridMarketTransactionFromDirectDeal,
  buildGridMarketTransactionFromFixedPricePurchase,
  toGridTradeIntegrityTransaction,
  validateGridMarketTransactionRecord,
} from '../lib/grid/core/market-transactions';
import type { GridDirectDealSettlementPlan } from '../lib/grid/core/direct-deal-types';
import type { GridFixedPricePurchasePlan } from '../lib/grid/core/market-listing-types';

function directPlan(
  overrides: Partial<GridDirectDealSettlementPlan> = {},
): GridDirectDealSettlementPlan {
  return {
    settleable: true,
    cityId: 'canton',
    settledAt: '2026-09-17T14:00:00.000Z',
    proposerTotalDebitCredits: 105,
    counterpartyTotalDebitCredits: 210,
    creditTransfers: [
      { fromPlayerId: 'zeta', toPlayerId: 'alpha', amountCredits: 100 },
      { fromPlayerId: 'alpha', toPlayerId: 'zeta', amountCredits: 200 },
    ],
    assetTransfers: [
      {
        assetId: 'property-9',
        kind: 'property',
        fromPlayerId: 'zeta',
        toPlayerId: 'alpha',
      },
    ],
    taxCharges: [
      { playerId: 'zeta', amountCredits: 5 },
      { playerId: 'alpha', amountCredits: 10 },
    ],
    playerCreditDeltas: { zeta: 95, alpha: -110 },
    audit: {
      grossCreditsTransferred: 300,
      totalTaxCredits: 15,
      propertyTransfers: 1,
      otherAssetTransfers: 0,
      zeroCreditDeal: false,
      reciprocalCreditFlow: true,
    },
    ...overrides,
  };
}

function purchasePlan(
  overrides: Partial<GridFixedPricePurchasePlan> = {},
): GridFixedPricePurchasePlan {
  return {
    purchasable: true,
    listingId: 'listing-1',
    purchasedAt: '2026-09-17T14:05:00.000Z',
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
      listingId: 'listing-1',
      cityId: 'canton',
      sellerPlayerId: 'seller',
      assetId: 'property-1',
      assetKind: 'property',
      priceCredits: 1_000,
      createdAt: '2026-09-17T13:00:00.000Z',
      expiresAt: '2026-09-18T13:00:00.000Z',
      status: 'sold',
      buyerPlayerId: 'buyer',
      soldAt: '2026-09-17T14:05:00.000Z',
    },
    ...overrides,
  };
}

describe('Grid market transaction log core', () => {
  it('normalizes Direct Deal movements into one canonical transaction record', () => {
    const record = buildGridMarketTransactionFromDirectDeal({
      transactionId: 'tx-1',
      sourceId: 'deal-1',
      plan: directPlan(),
      estimatedAssetValueCreditsById: { 'property-9': 800 },
    });

    expect(record.participantIds).toEqual(['alpha', 'zeta']);
    expect(record).toMatchObject({
      version: 1,
      source: 'direct-deal',
      sourceId: 'deal-1',
      cityId: 'canton',
      occurredAt: '2026-09-17T14:00:00.000Z',
    });
    expect(record.facts).toEqual({
      grossCreditsTransferred: 300,
      grossEstimatedAssetValue: 800,
      grossEstimatedValue: 1_100,
      totalTaxCredits: 15,
      propertyTransfers: 1,
      otherAssetTransfers: 0,
      zeroCreditTransaction: false,
      reciprocalCreditFlow: true,
    });
  });

  it('normalizes a fixed-price purchase and adapts it losslessly for Trade Integrity', () => {
    const record = buildGridMarketTransactionFromFixedPricePurchase({
      transactionId: 'tx-2',
      cityId: 'canton',
      estimatedAssetValueCredits: 1_200,
      plan: purchasePlan(),
    });
    const integrity = toGridTradeIntegrityTransaction(record);

    expect(record.source).toBe('fixed-price');
    expect(record.sourceId).toBe('listing-1');
    expect(integrity).toEqual({
      transactionId: 'tx-2',
      cityId: 'canton',
      occurredAt: '2026-09-17T14:05:00.000Z',
      participantAId: 'buyer',
      participantBId: 'seller',
      creditsToA: 0,
      creditsToB: 1_000,
      estimatedAssetValueToA: 1_200,
      estimatedAssetValueToB: 0,
      assetTransfers: 1,
      taxCredits: 50,
    });
  });

  it('fails closed for a Direct Deal that was not approved for settlement', () => {
    expect(() =>
      buildGridMarketTransactionFromDirectDeal({
        transactionId: 'bad',
        sourceId: 'deal-bad',
        plan: directPlan({ settleable: false, reason: 'insufficient-credits' }),
        estimatedAssetValueCreditsById: { 'property-9': 800 },
      }),
    ).toThrow(/must be settleable/);
  });

  it('rejects an inconsistent fixed-price settlement plan before logging it', () => {
    expect(() =>
      buildGridMarketTransactionFromFixedPricePurchase({
        transactionId: 'tx-bad',
        cityId: 'canton',
        estimatedAssetValueCredits: 500,
        plan: purchasePlan({
          buyerTotalDebitCredits: 999,
          buyerCreditDelta: -999,
          sellerCreditDelta: 900,
          nextListing: {
            ...purchasePlan().nextListing,
            cityId: 'cleveland',
            status: 'open',
            buyerPlayerId: undefined,
            soldAt: undefined,
          },
        }),
      }),
    ).toThrow(/purchase plan/);
  });

  it('rejects forged Direct Deal player deltas that disagree with transfers and taxes', () => {
    expect(() =>
      buildGridMarketTransactionFromDirectDeal({
        transactionId: 'tx-forged',
        sourceId: 'deal-forged',
        plan: directPlan({
          creditTransfers: [
            { fromPlayerId: 'alpha', toPlayerId: 'zeta', amountCredits: 100 },
          ],
          assetTransfers: [],
          taxCharges: [{ playerId: 'alpha', amountCredits: 5 }],
          playerCreditDeltas: { alpha: -5, zeta: 5 },
          audit: {
            grossCreditsTransferred: 100,
            totalTaxCredits: 5,
            propertyTransfers: 0,
            otherAssetTransfers: 0,
            zeroCreditDeal: false,
            reciprocalCreditFlow: false,
          },
        }),
        estimatedAssetValueCreditsById: {},
      }),
    ).toThrow(/credit deltas/);
  });

  it('validates derived facts by semantic value rather than object property order', () => {
    const record = buildGridMarketTransactionFromFixedPricePurchase({
      transactionId: 'tx-order',
      cityId: 'canton',
      estimatedAssetValueCredits: 400,
      plan: purchasePlan({
        listingId: 'listing-order',
        priceCredits: 500,
        taxCredits: 25,
        buyerTotalDebitCredits: 525,
        buyerCreditDelta: -525,
        sellerCreditDelta: 500,
        assetTransfer: {
          assetId: 'asset-order',
          kind: 'asset',
          fromPlayerId: 'seller',
          toPlayerId: 'buyer',
        },
        nextListing: {
          ...purchasePlan().nextListing,
          listingId: 'listing-order',
          assetId: 'asset-order',
          assetKind: 'asset',
          priceCredits: 500,
        },
      }),
    });

    record.facts = {
      reciprocalCreditFlow: false,
      zeroCreditTransaction: false,
      otherAssetTransfers: 1,
      propertyTransfers: 0,
      totalTaxCredits: 25,
      grossEstimatedValue: 900,
      grossEstimatedAssetValue: 400,
      grossCreditsTransferred: 500,
    };

    expect(() => validateGridMarketTransactionRecord(record)).not.toThrow();
  });
});
