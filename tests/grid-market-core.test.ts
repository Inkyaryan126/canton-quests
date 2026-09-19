import { describe, expect, it } from 'vitest';
import {
  quoteGridMarketTax,
  settleGridFixedPriceTrade,
  validateGridMarketConfig,
} from '../lib/grid/core/market';
import type { GridMarketConfig, GridMarketItem } from '../lib/grid/core/market-types';

const config: GridMarketConfig = {
  transactionTaxBps: 500,
  postCaptureTradeCooldownSeconds: 3600,
};

const property: GridMarketItem = {
  itemType: 'property',
  itemId: 'property-1',
  ownerPlayerId: 'seller-1',
  acquiredAtMs: 1_000_000,
  tradable: true,
  majorLandmark: false,
};

describe('GRID Market core', () => {
  it('validates explicit city/season market tuning without inventing defaults', () => {
    expect(() => validateGridMarketConfig(config)).not.toThrow();
    expect(() => validateGridMarketConfig({ ...config, transactionTaxBps: -1 })).toThrow();
    expect(() => validateGridMarketConfig({ ...config, transactionTaxBps: 10_001 })).toThrow();
    expect(() => validateGridMarketConfig({ ...config, postCaptureTradeCooldownSeconds: -1 })).toThrow();
  });

  it('quotes an integer Credits tax sink deterministically', () => {
    expect(quoteGridMarketTax(101, config)).toEqual({
      grossCredits: 101,
      taxCredits: 5,
      sellerNetCredits: 96,
    });
  });

  it('atomically models a fixed-price Credits-for-property settlement', () => {
    const result = settleGridFixedPriceTrade({
      sellerPlayerId: 'seller-1',
      buyerPlayerId: 'buyer-1',
      sellerCredits: 200,
      buyerCredits: 900,
      priceCredits: 400,
      item: property,
      nowMs: property.acquiredAtMs + 3_600_000,
    }, config);

    expect(result).toEqual({
      sellerCreditsAfter: 580,
      buyerCreditsAfter: 500,
      grossCredits: 400,
      taxCredits: 20,
      sellerNetCredits: 380,
      itemOwnerPlayerIdAfter: 'buyer-1',
    });
  });

  it('rejects insufficient Credits and self-dealing', () => {
    expect(() => settleGridFixedPriceTrade({
      sellerPlayerId: 'seller-1', buyerPlayerId: 'buyer-1', sellerCredits: 0,
      buyerCredits: 399, priceCredits: 400, item: property,
      nowMs: property.acquiredAtMs + 3_600_000,
    }, config)).toThrow('buyer does not have enough Credits');

    expect(() => settleGridFixedPriceTrade({
      sellerPlayerId: 'seller-1', buyerPlayerId: 'seller-1', sellerCredits: 0,
      buyerCredits: 900, priceCredits: 400, item: property,
      nowMs: property.acquiredAtMs + 3_600_000,
    }, config)).toThrow('buyer and seller must be different players');
  });

  it('rejects ownership mismatch, locked items, major landmarks, and capture cooldown bypass', () => {
    const base = {
      sellerPlayerId: 'seller-1', buyerPlayerId: 'buyer-1', sellerCredits: 0,
      buyerCredits: 900, priceCredits: 400, nowMs: property.acquiredAtMs + 3_600_000,
    };
    expect(() => settleGridFixedPriceTrade({ ...base, item: { ...property, ownerPlayerId: 'other' } }, config)).toThrow('seller does not own');
    expect(() => settleGridFixedPriceTrade({ ...base, item: { ...property, tradable: false } }, config)).toThrow('not eligible for trade');
    expect(() => settleGridFixedPriceTrade({ ...base, item: { ...property, majorLandmark: true } }, config)).toThrow('major landmarks cannot be freely traded');
    expect(() => settleGridFixedPriceTrade({ ...base, item: property, nowMs: property.acquiredAtMs + 3_599_999 }, config)).toThrow('post-capture trade cooldown');
  });

  it('supports eligible assets through the same Credits-only settlement contract', () => {
    const asset: GridMarketItem = {
      ...property,
      itemType: 'asset',
      itemId: 'asset-1',
      majorLandmark: false,
    };
    expect(settleGridFixedPriceTrade({
      sellerPlayerId: 'seller-1', buyerPlayerId: 'buyer-1', sellerCredits: 0,
      buyerCredits: 500, priceCredits: 100, item: asset,
      nowMs: asset.acquiredAtMs + 3_600_000,
    }, config).itemOwnerPlayerIdAfter).toBe('buyer-1');
  });
});
