import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridAcquirePropertyCommand,
  GridDevelopPropertyCommand,
  GridPropertyAcquisitionResult,
  GridPropertyCommandPort,
  GridPropertyDevelopmentResult,
} from './property-port';

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Grid ${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridPropertyCommandPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridPropertyCommandPort {
  if (!client) {
    throw new Error('Grid property commands require Supabase service-role configuration');
  }

  return {
    async acquireProperty(command: GridAcquirePropertyCommand) {
      const { data, error } = await client.rpc('grid_acquire_property', {
        p_season_id: command.seasonId,
        p_player_id: command.playerId,
        p_property_id: command.propertyId,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) {
        throw new Error(`Failed to acquire Grid property: ${error.message}`);
      }
      return requireObject<GridPropertyAcquisitionResult>(data, 'property acquisition');
    },

    async developProperty(command: GridDevelopPropertyCommand) {
      const { data, error } = await client.rpc('grid_develop_property', {
        p_season_id: command.seasonId,
        p_player_id: command.playerId,
        p_property_id: command.propertyId,
        p_branch: command.branch,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) {
        throw new Error(`Failed to develop Grid property: ${error.message}`);
      }
      return requireObject<GridPropertyDevelopmentResult>(data, 'property development');
    },
  };
}