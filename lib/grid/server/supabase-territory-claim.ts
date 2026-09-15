import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridTerritoryClaimCommand,
  GridTerritoryClaimPort,
  GridTerritoryClaimResult,
} from './territory-claim-port';

function requireResult(data: unknown): GridTerritoryClaimResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Grid territory claim returned an invalid result');
  }
  return data as GridTerritoryClaimResult;
}

export function createSupabaseGridTerritoryClaimPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridTerritoryClaimPort {
  if (!client) {
    throw new Error('Grid territory claims require Supabase service-role configuration');
  }

  return {
    async claimNeutralTerritory(command: GridTerritoryClaimCommand) {
      const { data, error } = await client.rpc('grid_claim_neutral_territory', {
        p_season_id: command.seasonId,
        p_player_id: command.playerId,
        p_territory_id: command.territoryId,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) {
        throw new Error(`Failed to claim Grid territory: ${error.message}`);
      }
      return requireResult(data);
    },
  };
}
