import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridEconomyCommand,
  GridEconomyCommandPort,
  GridPlayerSeasonState,
} from './economy-port';

function requireState(data: unknown, label: string): GridPlayerSeasonState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid Grid player season state`);
  }
  return data as GridPlayerSeasonState;
}

function rpcArgs(command: GridEconomyCommand) {
  return {
    p_season_id: command.seasonId,
    p_player_id: command.playerId,
    p_idempotency_key: command.idempotencyKey,
    p_now: command.now,
  };
}

export function createSupabaseGridEconomyCommandPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridEconomyCommandPort {
  if (!client) {
    throw new Error('Grid economy commands require Supabase service-role configuration');
  }

  return {
    async joinSeason(command) {
      const { data, error } = await client.rpc('grid_join_season', rpcArgs(command));
      if (error) {
        throw new Error(`Failed to join Grid season: ${error.message}`);
      }
      return requireState(data, 'Grid season join');
    },

    async settleResources(command) {
      const { data, error } = await client.rpc(
        'grid_settle_player_resources',
        rpcArgs(command),
      );
      if (error) {
        throw new Error(`Failed to settle Grid resources: ${error.message}`);
      }
      return requireState(data, 'Grid resource settlement');
    },
  };
}
