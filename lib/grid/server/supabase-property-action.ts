import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridPropertyActionPort,
  GridPropertyActionTarget,
} from './property-action-port';

export function createSupabaseGridPropertyActionPort(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): GridPropertyActionPort {
  if (!client) {
    throw new Error(
      'Grid property actions require Supabase service-role configuration',
    );
  }

  return {
    async resolveTarget(propertySlug): Promise<GridPropertyActionTarget | null> {
      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', pkg.city.slug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(
          `Failed to resolve Grid property action city: ${cityResult.error.message}`,
        );
      }
      if (!cityResult.data) return null;

      const cityId = (cityResult.data as { id: string }).id;
      const [seasonResult, propertyResult] = await Promise.all([
        client
          .from('grid_seasons')
          .select('id,status')
          .eq('city_id', cityId)
          .eq('slug', pkg.seasonTemplate.slug)
          .maybeSingle(),
        client
          .from('grid_properties')
          .select('id')
          .eq('city_id', cityId)
          .eq('slug', propertySlug)
          .maybeSingle(),
      ]);
      if (seasonResult.error) {
        throw new Error(
          `Failed to resolve Grid property action season: ${seasonResult.error.message}`,
        );
      }
      if (propertyResult.error) {
        throw new Error(
          `Failed to resolve Grid property action target: ${propertyResult.error.message}`,
        );
      }
      if (!seasonResult.data || !propertyResult.data) return null;

      const season = seasonResult.data as { id: string; status: string };
      return {
        seasonId: season.id,
        seasonStatus: season.status,
        propertyId: (propertyResult.data as { id: string }).id,
      };
    },
  };
}
