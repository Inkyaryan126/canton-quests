import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridPassportCityEntryResult,
  GridPassportPersistencePort,
} from './passport-port';

function requireResult(data: unknown): GridPassportCityEntryResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Grid Passport city entry returned an invalid result');
  }
  return data as GridPassportCityEntryResult;
}

export function createSupabaseGridPassportPersistencePort(
  client: SupabaseClient | null = supabaseAdmin,
): GridPassportPersistencePort {
  if (!client) {
    throw new Error('Grid Passport persistence requires Supabase service-role configuration');
  }

  return {
    async recordCityEntry(command) {
      const { data, error } = await client.rpc('grid_record_passport_city_entry', {
        p_player_id: command.playerId,
        p_city_id: command.cityId,
        p_idempotency_key: command.idempotencyKey,
        p_entered_at: command.enteredAt,
      });
      if (error) {
        throw new Error(`Failed to record Grid Passport city entry: ${error.message}`);
      }
      return requireResult(data);
    },
  };
}
