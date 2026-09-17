import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridMarketCancelFixedPricePropertyListingResult,
  GridMarketOpenFixedPricePropertyListingResult,
  GridMarketSettlementPort,
  GridMarketSettlementResult,
} from './market-settlement-port';

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridMarketSettlementPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridMarketSettlementPort {
  if (!client) throw new Error('Grid market settlement requires Supabase service-role configuration');

  return {
    async openFixedPricePropertyListing(command) {
      const { data, error } = await client.rpc('grid_open_fixed_price_property_listing', {
        p_season_id: command.seasonId,
        p_listing_id: command.listingId,
        p_seller_player_id: command.sellerPlayerId,
        p_property_id: command.propertyId,
        p_price_credits: command.priceCredits,
        p_created_at: command.createdAt,
        p_expires_at: command.expiresAt,
        p_minimum_price_credits: command.minimumPriceCredits,
        p_maximum_price_credits: command.maximumPriceCredits,
        p_minimum_listing_duration_minutes: command.minimumListingDurationMinutes,
        p_maximum_listing_duration_minutes: command.maximumListingDurationMinutes,
        p_property_trade_cooldown_minutes: command.propertyTradeCooldownMinutes,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) throw new Error(`Failed to open Grid market listing: ${error.message}`);
      return requireObject<GridMarketOpenFixedPricePropertyListingResult>(data, 'Grid market listing open');
    },

    async cancelFixedPricePropertyListing(command) {
      const { data, error } = await client.rpc('grid_cancel_fixed_price_property_listing', {
        p_season_id: command.seasonId,
        p_listing_id: command.listingId,
        p_seller_player_id: command.sellerPlayerId,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) throw new Error(`Failed to cancel Grid market listing: ${error.message}`);
      return requireObject<GridMarketCancelFixedPricePropertyListingResult>(data, 'Grid market listing cancellation');
    },

    async settleTransaction(command) {
      const { data, error } = await client.rpc('grid_settle_market_transaction', {
        p_season_id: command.seasonId,
        p_transaction: command.transaction,
        p_transaction_tax_bps: command.transactionTaxBps,
        p_property_trade_cooldown_minutes: command.propertyTradeCooldownMinutes,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.transaction.occurredAt,
      });
      if (error) throw new Error(`Failed to settle Grid market transaction: ${error.message}`);
      return requireObject<GridMarketSettlementResult>(data, 'Grid market settlement');
    },
  };
}
