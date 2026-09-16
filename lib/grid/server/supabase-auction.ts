import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridAuctionBidResult,
  GridAuctionCommandPort,
  GridAuctionCommandResult,
  GridAuctionSettlementResult,
  GridPlaceAuctionBidCommand,
  GridScheduleAuctionCommand,
  GridSettleAuctionCommand,
} from './auction-port';

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridAuctionCommandPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridAuctionCommandPort {
  if (!client) {
    throw new Error('Grid auctions require Supabase service-role configuration');
  }

  return {
    async scheduleAuction(command: GridScheduleAuctionCommand) {
      const { data, error } = await client.rpc('grid_schedule_property_auction', {
        p_season_id: command.seasonId,
        p_property_id: command.propertyId,
        p_reserve_credits: command.reserveCredits,
        p_minimum_bid_increment_credits:
          command.minimumBidIncrementCredits,
        p_starts_at: command.startsAt,
        p_ends_at: command.endsAt,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });

      if (error) {
        throw new Error(`Failed to schedule Grid auction: ${error.message}`);
      }

      return requireObject<GridAuctionCommandResult>(
        data,
        'Grid auction schedule',
      );
    },

    async placeBid(command: GridPlaceAuctionBidCommand) {
      const { data, error } = await client.rpc('grid_place_property_auction_bid', {
        p_auction_id: command.auctionId,
        p_player_id: command.bidderPlayerId,
        p_amount_credits: command.amountCredits,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });

      if (error) {
        throw new Error(`Failed to place Grid auction bid: ${error.message}`);
      }

      return requireObject<GridAuctionBidResult>(
        data,
        'Grid auction bid',
      );
    },

    async settleAuction(command: GridSettleAuctionCommand) {
      const { data, error } = await client.rpc(
        'grid_settle_property_auction',
        {
          p_auction_id: command.auctionId,
          p_idempotency_key: command.idempotencyKey,
          p_now: command.now,
        },
      );

      if (error) {
        throw new Error(`Failed to settle Grid auction: ${error.message}`);
      }

      return requireObject<GridAuctionSettlementResult>(
        data,
        'Grid auction settlement',
      );
    },
  };
}
