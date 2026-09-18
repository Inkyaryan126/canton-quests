import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridTerritoryActionPort,
  GridTerritoryActionTarget,
} from './territory-action-port';

export function createSupabaseGridTerritoryActionPort(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): GridTerritoryActionPort {
  if (!client) {
    throw new Error('Grid territory actions require Supabase service-role configuration');
  }

  return {
    async resolveTarget(territorySlug): Promise<GridTerritoryActionTarget | null> {
      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', pkg.city.slug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(`Failed to resolve Grid territory action city: ${cityResult.error.message}`);
      }
      if (!cityResult.data) return null;

      const cityId = (cityResult.data as { id: string }).id;
      const [seasonResult, territoryResult] = await Promise.all([
        client
          .from('grid_seasons')
          .select('id,status')
          .eq('city_id', cityId)
          .eq('slug', pkg.seasonTemplate.slug)
          .maybeSingle(),
        client
          .from('grid_territories')
          .select('id')
          .eq('city_id', cityId)
          .eq('slug', territorySlug)
          .maybeSingle(),
      ]);
      if (seasonResult.error) {
        throw new Error(`Failed to resolve Grid territory action season: ${seasonResult.error.message}`);
      }
      if (territoryResult.error) {
        throw new Error(`Failed to resolve Grid territory action target: ${territoryResult.error.message}`);
      }
      if (!seasonResult.data || !territoryResult.data) return null;

      const season = seasonResult.data as { id: string; status: string };
      return {
        seasonId: season.id,
        seasonStatus: season.status,
        territoryId: (territoryResult.data as { id: string }).id,
      };
    },
  };
}
