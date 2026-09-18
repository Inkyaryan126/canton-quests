import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';

export interface GridResolvedSeason {
  cityId: string;
  seasonId: string;
  status: string;
}

export async function resolveSupabaseGridSeason(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): Promise<GridResolvedSeason | null> {
  if (!client) return null;

  const cityResult = await client
    .from('grid_cities')
    .select('id')
    .eq('slug', pkg.city.slug)
    .maybeSingle();
  if (cityResult.error) {
    throw new Error(`Failed to resolve Grid city: ${cityResult.error.message}`);
  }
  const city = cityResult.data as { id: string } | null;
  if (!city) return null;

  const seasonResult = await client
    .from('grid_seasons')
    .select('id,status')
    .eq('city_id', city.id)
    .eq('slug', pkg.seasonTemplate.slug)
    .maybeSingle();
  if (seasonResult.error) {
    throw new Error(`Failed to resolve Grid season: ${seasonResult.error.message}`);
  }
  const season = seasonResult.data as { id: string; status: string } | null;
  return season
    ? { cityId: city.id, seasonId: season.id, status: season.status }
    : null;
}
