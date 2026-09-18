import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridAuctionSettlementSweepPort } from './auction-settlement-sweep-port';

export function createSupabaseGridAuctionSettlementSweepPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridAuctionSettlementSweepPort {
  if (!client) {
    throw new Error(
      'Grid auction settlement sweep requires Supabase configuration',
    );
  }

  return {
    async listExpiredAuctionIds(seasonId, now, limit) {
      const result = await client
        .from('grid_property_auctions')
        .select('id')
        .eq('season_id', seasonId)
        .in('status', ['scheduled', 'open'])
        .lte('ends_at', now)
        .order('ends_at', { ascending: true })
        .limit(limit);

      if (result.error) {
        throw new Error(
          `Failed to discover expired Grid auctions: ${result.error.message}`,
        );
      }

      return ((result.data ?? []) as Array<{ id: string }>).map(
        (row) => row.id,
      );
    },
  };
}
