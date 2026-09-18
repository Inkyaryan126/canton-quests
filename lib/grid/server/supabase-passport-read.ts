import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridPassportReadPort } from './passport-read-port';

export function createSupabaseGridPassportReadPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridPassportReadPort {
  if (!client) throw new Error('Grid Passport read requires Supabase service-role configuration');

  return {
    async getProfile(playerId) {
      const { data, error } = await client
        .from('grid_player_profiles')
        .select('home_city_id,global_reputation,passport')
        .eq('player_id', playerId)
        .maybeSingle();
      if (error) throw new Error(`Failed to read Grid Passport: ${error.message}`);
      if (!data) return null;

      const row = data as {
        home_city_id: string | null;
        global_reputation: number | string;
        passport: unknown;
      };
      return {
        homeCityId: row.home_city_id,
        globalReputation: Number(row.global_reputation),
        passport: row.passport,
      };
    },
  };
}
