import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridNpcStrongholdRuntimeAdminScopePort } from './npc-stronghold-runtime-admin-service';

export interface SupabaseGridNpcStrongholdRuntimeAdminOptions {
  client?: SupabaseClient | null;
  citySlug: string;
  seasonSlug: string;
}

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridNpcStrongholdRuntimeAdminScopePort(
  options: SupabaseGridNpcStrongholdRuntimeAdminOptions,
): GridNpcStrongholdRuntimeAdminScopePort {
  const client = options.client === undefined ? supabaseAdmin : options.client;
  if (!client) {
    throw new Error('Grid NPC runtime admin requires Supabase service-role configuration');
  }
  const db = client;
  if (!options.citySlug.trim() || !options.seasonSlug.trim()) {
    throw new Error('Grid NPC runtime admin requires city and season slugs');
  }

  return {
    async resolveScope() {
      const cityResult = await db
        .from('grid_cities')
        .select('id')
        .eq('slug', options.citySlug)
        .single();
      if (cityResult.error) {
        throw new Error(`Failed to resolve Grid NPC runtime admin city: ${cityResult.error.message}`);
      }
      const city = requireObject<{ id: string }>(
        cityResult.data,
        'Grid NPC runtime admin city',
      );

      const seasonResult = await db
        .from('grid_seasons')
        .select('id,city_id')
        .eq('city_id', city.id)
        .eq('slug', options.seasonSlug)
        .single();
      if (seasonResult.error) {
        throw new Error(`Failed to resolve Grid NPC runtime admin season: ${seasonResult.error.message}`);
      }
      const season = requireObject<{ id: string; city_id: string }>(
        seasonResult.data,
        'Grid NPC runtime admin season',
      );
      if (season.city_id !== city.id) {
        throw new Error('Grid NPC runtime admin season belongs to the wrong city');
      }
      return { cityId: city.id, seasonId: season.id };
    },
  };
}
