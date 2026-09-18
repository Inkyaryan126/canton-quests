import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridIncomeActionPort,
  GridIncomeActionSeason,
} from './income-action-port';

export function createSupabaseGridIncomeActionPort(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): GridIncomeActionPort {
  if (!client) {
    throw new Error(
      'Grid income actions require Supabase service-role configuration',
    );
  }

  return {
    async getCurrentSeason(): Promise<GridIncomeActionSeason | null> {
      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', pkg.city.slug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(
          `Failed to resolve Grid income city: ${cityResult.error.message}`,
        );
      }
      if (!cityResult.data) return null;

      const cityId = (cityResult.data as { id: string }).id;
      const seasonResult = await client
        .from('grid_seasons')
        .select('id,status')
        .eq('city_id', cityId)
        .eq('slug', pkg.seasonTemplate.slug)
        .maybeSingle();
      if (seasonResult.error) {
        throw new Error(
          `Failed to resolve Grid income season: ${seasonResult.error.message}`,
        );
      }
      if (!seasonResult.data) return null;

      const season = seasonResult.data as { id: string; status: string };
      return {
        seasonId: season.id,
        seasonStatus: season.status,
      };
    },
  };
}
