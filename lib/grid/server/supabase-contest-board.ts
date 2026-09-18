import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridContestBoardPort,
  GridContestBoardTerritoryIds,
} from './contest-board-port';

export function createSupabaseGridContestBoardPort(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): GridContestBoardPort {
  if (!client) {
    throw new Error(
      'Grid contest board actions require Supabase service-role configuration',
    );
  }

  return {
    async resolveTerritoryIds(
      sourceTerritorySlug,
      targetTerritorySlug,
    ): Promise<GridContestBoardTerritoryIds | null> {
      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', pkg.city.slug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(
          `Failed to resolve Grid contest board city: ${cityResult.error.message}`,
        );
      }
      if (!cityResult.data) return null;

      const cityId = (cityResult.data as { id: string }).id;
      const territoryResult = await client
        .from('grid_territories')
        .select('id,slug')
        .eq('city_id', cityId)
        .in('slug', [sourceTerritorySlug, targetTerritorySlug]);
      if (territoryResult.error) {
        throw new Error(
          `Failed to resolve Grid contest board territories: ${territoryResult.error.message}`,
        );
      }

      const rows = (territoryResult.data ?? []) as Array<{
        id: string;
        slug: string;
      }>;
      const source = rows.find((row) => row.slug === sourceTerritorySlug);
      const target = rows.find((row) => row.slug === targetTerritorySlug);
      if (!source || !target) return null;

      return {
        sourceTerritoryId: source.id,
        targetTerritoryId: target.id,
      };
    },
  };
}
