import { describe, expect, it, vi } from 'vitest';
import type { GridDirectDealSettlementPlan } from '../lib/grid/core/direct-deal-types';
import type { GridFixedPricePurchasePlan } from '../lib/grid/core/market-listing-types';
import type {
  GridMarketSettlementPort,
  GridMarketSettlementResult,
} from '../lib/grid/server/market-settlement-port';
import {
  cancelGridFixedPricePropertyListing,
  openGridFixedPricePropertyListing,
  settleGridDirectDeal,
  settleGridFixedPricePurchase,
} from '../lib/grid/server/market-settlement-service';
import { createSupabaseGridMarketSettlementPort } from '../lib/grid/server/supabase-market-settlement';

const seasonId = '10000000-0000-4000-8000-000000000001';
const cityId = '10000000-0000-4000-8000-000000000002';
const proposerId = '10000000-0000-4000-8000-000000000003';
const counterpartyId = '10000000-0000-4000-8000-000000000004';
const propertyId = '10000000-0000-4000-8000-000000000005';
const listingId = 'listing-one';
const occurredAt = '2026-09-17T18:00:00.000Z';

const settlementResult: GridMarketSettlementResult = {
  transactionId: 'tx-one',
  seasonId,
  cityId,
  source: 'direct-deal',
  sourceId: 'deal-one',
  occurredAt,
  participantIds: [counterpartyId, proposerId].sort() as [string, string],
  creditsAfter: { [proposerId]: 890, [counterpartyId]: 600 },
  propertyOwnerPlayerIds: { [propertyId]: proposerId },
  totalTaxCredits: 10,
  eventId: '10000000-0000-4000-8000-000000000006',
};

function port(): GridMarketSettlementPort {
  return {
    openFixedPricePropertyListing: vi.fn().mockResolvedValue({
      listingId,
      seasonId,
      cityId,
      sellerPlayerId: proposerId,
      propertyId,
      priceCredits: 200,
      createdAt: occurredAt,
      expiresAt: '2026-09-18T18:00:00.000Z',
      status: 'open',
      eventId: '10000000-0000-4000-8000-000000000007',
    }),
    cancelFixedPricePropertyListing: vi.fn().mockResolvedValue({
      listingId,
      seasonId,
      status: 'cancelled',
      cancelledAt: occurredAt,
      eventId: '10000000-0000-4000-8000-000000000008',
    }),
    settleTransaction: vi.fn().mockResolvedValue(settlementResult),
  };
}

const directPlan: GridDirectDealSettlementPlan = {
  settleable: true,
  cityId,
  settledAt: occurredAt,
  proposerTotalDebitCredits: 110,
  counterpartyTotalDebitCredits: 0,
  creditTransfers: [
    { fromPlayerId: proposerId, toPlayerId: counterpartyId, amountCredits: 100 },
  ],
  assetTransfers: [
    { assetId: propertyId, kind: 'property', fromPlayerId: counterpartyId, toPlayerId: proposerId },
  ],
  taxCharges: [{ playerId: proposerId, amountCredits: 10 }],
  playerCreditDeltas: { [proposerId]: -110, [counterpartyId]: 100 },
  audit: {
    grossCreditsTransferred: 100,
    totalTaxCredits: 10,
    propertyTransfers: 1,
    otherAssetTransfers: 0,
    zeroCreditDeal: false,
    reciprocalCreditFlow: false,
  },
};

const fixedPlan: GridFixedPricePurchasePlan = {
  purchasable: true,
  listingId,
  purchasedAt: occurredAt,
  buyerPlayerId: counterpartyId,
  sellerPlayerId: proposerId,
  priceCredits: 200,
  taxCredits: 20,
  buyerTotalDebitCredits: 220,
  buyerCreditDelta: -220,
  sellerCreditDelta: 200,
  assetTransfer: {
    assetId: propertyId,
    kind: 'property',
    fromPlayerId: proposerId,
    toPlayerId: counterpartyId,
  },
  nextListing: {
    listingId,
    cityId,
    sellerPlayerId: proposerId,
    assetId: propertyId,
    assetKind: 'property',
    priceCredits: 200,
    createdAt: '2026-09-17T17:00:00.000Z',
    expiresAt: '2026-09-18T17:00:00.000Z',
    status: 'sold',
    buyerPlayerId: counterpartyId,
    soldAt: occurredAt,
  },
};

describe('Grid market settlement service', () => {
  it('normalizes a direct property deal into the canonical transaction before persistence', async () => {
    const adapter = port();
    await settleGridDirectDeal(adapter, {
      seasonId,
      idempotencyKey: 'market:deal:one',
      transactionId: 'tx-one',
      sourceId: 'deal-one',
      plan: directPlan,
      estimatedAssetValueCreditsById: { [propertyId]: 500 },
      transactionTaxBps: 1000,
      propertyTradeCooldownMinutes: 60,
    });
    expect(adapter.settleTransaction).toHaveBeenCalledWith(expect.objectContaining({
      seasonId,
      idempotencyKey: 'market:deal:one',
      transactionTaxBps: 1000,
      propertyTradeCooldownMinutes: 60,
      transaction: expect.objectContaining({
        transactionId: 'tx-one',
        source: 'direct-deal',
        sourceId: 'deal-one',
        cityId,
      }),
    }));
  });

  it('normalizes a fixed-price property purchase into the same settlement port', async () => {
    const adapter = port();
    await settleGridFixedPricePurchase(adapter, {
      seasonId,
      idempotencyKey: 'market:listing:buy:one',
      transactionId: 'tx-fixed',
      cityId,
      plan: fixedPlan,
      estimatedAssetValueCredits: 200,
      transactionTaxBps: 1000,
      propertyTradeCooldownMinutes: 60,
    });
    expect(adapter.settleTransaction).toHaveBeenCalledWith(expect.objectContaining({
      transaction: expect.objectContaining({
        transactionId: 'tx-fixed',
        source: 'fixed-price',
        sourceId: listingId,
      }),
    }));
  });

  it('rejects generic assets until authoritative inventory ownership exists', async () => {
    const adapter = port();
    const plan: GridDirectDealSettlementPlan = {
      ...directPlan,
      creditTransfers: [],
      taxCharges: [],
      proposerTotalDebitCredits: 0,
      playerCreditDeltas: { [proposerId]: 0, [counterpartyId]: 0 },
      assetTransfers: [
        { assetId: 'asset-one', kind: 'asset', fromPlayerId: counterpartyId, toPlayerId: proposerId },
      ],
      audit: {
        grossCreditsTransferred: 0,
        totalTaxCredits: 0,
        propertyTransfers: 0,
        otherAssetTransfers: 1,
        zeroCreditDeal: true,
        reciprocalCreditFlow: false,
      },
    };
    await expect(settleGridDirectDeal(adapter, {
      seasonId,
      idempotencyKey: 'market:asset:unsupported',
      transactionId: 'tx-asset',
      sourceId: 'deal-asset',
      plan,
      estimatedAssetValueCreditsById: { 'asset-one': 50 },
      transactionTaxBps: 0,
      propertyTradeCooldownMinutes: 0,
    })).rejects.toThrow('authoritative inventory');
    expect(adapter.settleTransaction).not.toHaveBeenCalled();
  });

  it('validates listing commands before persistence', async () => {
    const adapter = port();
    const command = {
      seasonId,
      listingId,
      sellerPlayerId: proposerId,
      propertyId,
      priceCredits: 200,
      createdAt: occurredAt,
      expiresAt: '2026-09-18T18:00:00.000Z',
      minimumPriceCredits: 10,
      maximumPriceCredits: 10_000,
      minimumListingDurationMinutes: 60,
      maximumListingDurationMinutes: 10_080,
      propertyTradeCooldownMinutes: 60,
      idempotencyKey: 'market:listing:open:one',
      now: occurredAt,
    };
    await openGridFixedPricePropertyListing(adapter, command);
    expect(adapter.openFixedPricePropertyListing).toHaveBeenCalledWith(command);
    await expect(openGridFixedPricePropertyListing(adapter, { ...command, priceCredits: 0 })).rejects.toThrow('priceCredits');
    expect(adapter.openFixedPricePropertyListing).toHaveBeenCalledTimes(1);
  });

  it('rejects cooldowns that cannot be represented by the database interval guard', async () => {
    const adapter = port();
    await expect(settleGridDirectDeal(adapter, {
      seasonId,
      idempotencyKey: 'market:cooldown:overflow',
      transactionId: 'tx-cooldown',
      sourceId: 'deal-cooldown',
      plan: directPlan,
      estimatedAssetValueCreditsById: { [propertyId]: 500 },
      transactionTaxBps: 1000,
      propertyTradeCooldownMinutes: 2_147_483_648,
    })).rejects.toThrow('propertyTradeCooldownMinutes is too large');
    expect(adapter.settleTransaction).not.toHaveBeenCalled();
  });

  it('validates cancellation identity and idempotency', async () => {
    const adapter = port();
    const command = {
      seasonId,
      listingId,
      sellerPlayerId: proposerId,
      idempotencyKey: 'market:listing:cancel:one',
      now: occurredAt,
    };
    await cancelGridFixedPricePropertyListing(adapter, command);
    expect(adapter.cancelFixedPricePropertyListing).toHaveBeenCalledWith(command);
    await expect(cancelGridFixedPricePropertyListing(adapter, { ...command, sellerPlayerId: ' ' })).rejects.toThrow('sellerPlayerId');
  });
});

describe('Supabase Grid market settlement adapter', () => {
  it('requires service-role configuration', () => {
    expect(() => createSupabaseGridMarketSettlementPort(null as any)).toThrow('service-role');
  });

  it('uses only server-authoritative market RPCs', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({ data: settlementResult, error: null });
    const adapter = createSupabaseGridMarketSettlementPort({ rpc } as any);
    const openCommand = {
      seasonId, listingId, sellerPlayerId: proposerId, propertyId,
      priceCredits: 200, createdAt: occurredAt, expiresAt: '2026-09-18T18:00:00.000Z',
      minimumPriceCredits: 10, maximumPriceCredits: 10_000,
      minimumListingDurationMinutes: 60, maximumListingDurationMinutes: 10_080,
      propertyTradeCooldownMinutes: 60, idempotencyKey: 'market:listing:open:one', now: occurredAt,
    };
    await adapter.openFixedPricePropertyListing(openCommand);
    await adapter.cancelFixedPricePropertyListing({
      seasonId, listingId, sellerPlayerId: proposerId,
      idempotencyKey: 'market:listing:cancel:one', now: occurredAt,
    });
    await adapter.settleTransaction({
      seasonId,
      idempotencyKey: 'market:deal:one',
      transactionTaxBps: 1000,
      propertyTradeCooldownMinutes: 60,
      transaction: {
        version: 1,
        transactionId: 'tx-one', source: 'direct-deal', sourceId: 'deal-one', cityId, occurredAt,
        participantIds: [counterpartyId, proposerId].sort() as [string, string],
        creditTransfers: [{ fromPlayerId: proposerId, toPlayerId: counterpartyId, amountCredits: 100 }],
        assetTransfers: [{ assetId: propertyId, kind: 'property', fromPlayerId: counterpartyId, toPlayerId: proposerId, estimatedValueCredits: 500 }],
        taxCharges: [{ playerId: proposerId, amountCredits: 10 }],
        facts: { grossCreditsTransferred: 100, grossEstimatedAssetValue: 500, grossEstimatedValue: 600, totalTaxCredits: 10, propertyTransfers: 1, otherAssetTransfers: 0, zeroCreditTransaction: false, reciprocalCreditFlow: false },
      },
    });
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      'grid_open_fixed_price_property_listing',
      'grid_cancel_fixed_price_property_listing',
      'grid_settle_market_transaction',
    ]);
    expect(rpc.mock.calls[2][1]).toEqual(expect.objectContaining({
      p_season_id: seasonId,
      p_idempotency_key: 'market:deal:one',
      p_transaction_tax_bps: 1000,
      p_property_trade_cooldown_minutes: 60,
    }));
  });
});
