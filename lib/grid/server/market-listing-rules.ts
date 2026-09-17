import type { GridFixedPriceListingRules } from '../core/market-listing-types';

/**
 * Grid-wide fixed-price listing rules. City/season-specific tuning does not
 * exist yet anywhere in the Grid economy config, so this is an explicit,
 * documented interim default shared by every city until that config exists.
 * The same object must govern both listing creation and purchase settlement
 * so the tax baked into a transaction always matches what settlement
 * recomputes.
 */
export const GRID_MARKET_LISTING_RULES: GridFixedPriceListingRules = {
  transactionTaxBps: 500,
  propertyTradeCooldownMinutes: 60,
  minimumPriceCredits: 1,
  maximumPriceCredits: 10_000_000,
  minimumListingDurationMinutes: 30,
  maximumListingDurationMinutes: 60 * 24 * 7,
};
