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

    async getCities(cityIds) {
      if (cityIds.length === 0) return [];
      const { data, error } = await client
        .from('grid_cities')
        .select('id,slug,name,region_code,country_code')
        .in('id', [...cityIds]);
      if (error) throw new Error(`Failed to read Grid Passport city directory: ${error.message}`);

      return ((data ?? []) as Array<{
        id: string;
        slug: string;
        name: string;
        region_code: string;
        country_code: string;
      }>).map((row) => ({
        cityId: row.id,
        slug: row.slug,
        name: row.name,
        regionCode: row.region_code,
        countryCode: row.country_code,
      }));
    },
  };
}
