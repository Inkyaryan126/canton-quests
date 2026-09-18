import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridNpcFactionPressureCommandResult,
  GridNpcStrongholdEventCommandResult,
  GridNpcStrongholdRuntimeCommandPort,
  GridNpcSurgeIntensityCommandResult,
} from './npc-stronghold-runtime-command-port';

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridNpcStrongholdRuntimeCommandPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridNpcStrongholdRuntimeCommandPort {
  if (!client) {
    throw new Error('Grid NPC runtime commands require Supabase service-role configuration');
  }

  return {
    async setSurgeIntensity(command) {
      const { data, error } = await client.rpc('grid_set_npc_surge_intensity', {
        p_season_id: command.seasonId,
        p_city_id: command.cityId,
        p_surge_intensity_bps: command.surgeIntensityBps,
        p_actor_player_id: command.actorPlayerId,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) throw new Error(`Failed to set Grid NPC Surge intensity: ${error.message}`);
      return requireObject<GridNpcSurgeIntensityCommandResult>(data, 'Grid NPC Surge command');
    },

    async setFactionPressure(command) {
      const { data, error } = await client.rpc('grid_set_npc_faction_pressure', {
        p_season_id: command.seasonId,
        p_city_id: command.cityId,
        p_faction_id: command.factionId,
        p_pressure_bps: command.pressureBps,
        p_actor_player_id: command.actorPlayerId,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) throw new Error(`Failed to set Grid NPC faction pressure: ${error.message}`);
      return requireObject<GridNpcFactionPressureCommandResult>(data, 'Grid NPC faction command');
    },

    async setStrongholdEvent(command) {
      const { data, error } = await client.rpc('grid_set_npc_stronghold_event_state', {
        p_season_id: command.seasonId,
        p_city_id: command.cityId,
        p_stronghold_id: command.strongholdId,
        p_active: command.active,
        p_actor_player_id: command.actorPlayerId,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) throw new Error(`Failed to set Grid NPC stronghold event state: ${error.message}`);
      return requireObject<GridNpcStrongholdEventCommandResult>(data, 'Grid NPC stronghold event command');
    },
  };
}
