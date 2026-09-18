import type { GridDirectDealRules } from '../core/direct-deal-types';
import { GRID_MARKET_LISTING_RULES } from './market-listing-rules';

export const GRID_DIRECT_DEAL_RULES: GridDirectDealRules = {
  transactionTaxBps: GRID_MARKET_LISTING_RULES.transactionTaxBps,
  propertyTradeCooldownMinutes:
    GRID_MARKET_LISTING_RULES.propertyTradeCooldownMinutes,
  maxAssetsPerSide: 4,
};

export const GRID_DIRECT_DEAL_MIN_DURATION_MINUTES =
  GRID_MARKET_LISTING_RULES.minimumListingDurationMinutes;
export const GRID_DIRECT_DEAL_MAX_DURATION_MINUTES =
  GRID_MARKET_LISTING_RULES.maximumListingDurationMinutes;
