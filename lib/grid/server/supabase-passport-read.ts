import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridPassportCacheRow,
  GridPassportReadPort,
} from './passport-read-port';

export function createSupabaseGridPassportReadPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridPassportReadPort {
  if (!client) {
    throw new Error('Grid Passport read requires Supabase service-role configuration');
  }

  return {
    async readCache(playerId): Promise<GridPassportCacheRow | null> {
      const result = await client
        .from('grid_player_profiles')
        .select('passport,global_reputation')
        .eq('player_id', playerId)
        .maybeSingle();

      if (result.error) {
        throw new Error(
          'Failed to read Grid Passport cache: ' + result.error.message,
        );
      }
      if (!result.data) return null;

      const row = result.data as {
        passport: unknown;
        global_reputation: number;
      };

      return {
        passport: row.passport,
        globalReputation: Number(row.global_reputation),
      };
    },
  };
}
