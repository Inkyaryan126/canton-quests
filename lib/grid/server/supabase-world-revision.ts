import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridWorldRevisionPort } from './world-revision-port';

export function createSupabaseGridWorldRevisionPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridWorldRevisionPort {
  if (!client) {
    throw new Error('Grid world revision requires Supabase service-role configuration');
  }

  return {
    async readRevisionState(citySlug, seasonSlug) {
      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', citySlug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(`Failed to read Grid revision city: ${cityResult.error.message}`);
      }
      if (!cityResult.data) return null;

      const cityId = (cityResult.data as { id: string }).id;
      const seasonResult = await client
        .from('grid_seasons')
        .select('id,status,updated_at')
        .eq('city_id', cityId)
        .eq('slug', seasonSlug)
        .maybeSingle();
      if (seasonResult.error) {
        throw new Error(`Failed to read Grid revision season: ${seasonResult.error.message}`);
      }
      if (!seasonResult.data) return null;

      const season = seasonResult.data as {
        id: string;
        status: string;
        updated_at: string;
      };
      const eventResult = await client
        .from('grid_game_events')
        .select('id,created_at')
        .eq('season_id', season.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (eventResult.error) {
        throw new Error(`Failed to read Grid revision event: ${eventResult.error.message}`);
      }

      const event = eventResult.data as { id: string; created_at: string } | null;
      return {
        seasonId: season.id,
        seasonStatus: season.status,
        seasonUpdatedAt: season.updated_at,
        latestEventId: event?.id ?? null,
        latestEventAt: event?.created_at ?? null,
      };
    },
  };
}
