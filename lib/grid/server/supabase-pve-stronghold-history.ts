import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import {
  GRID_PVE_STRONGHOLD_HISTORY_EVENT_TYPES,
  type GridPveStrongholdHistoryContext,
  type GridPveStrongholdHistoryEvent,
  type GridPveStrongholdHistoryEventType,
  type GridPveStrongholdHistoryPort,
} from './pve-stronghold-history-port';

interface GridPveHistoryEventRow {
  id: string;
  event_type: GridPveStrongholdHistoryEventType;
  payload: unknown;
  created_at: string;
}

function payloadObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Grid PvE stronghold history event payload is invalid');
  }
  return payload as Record<string, unknown>;
}

export interface SupabaseGridPveStrongholdHistoryOptions {
  client?: SupabaseClient | null;
  citySlug: string;
  seasonSlug: string;
}

export function createSupabaseGridPveStrongholdHistoryPort(
  options: SupabaseGridPveStrongholdHistoryOptions,
): GridPveStrongholdHistoryPort {
  const client = options.client === undefined ? supabaseAdmin : options.client;
  if (!client) {
    throw new Error('Grid PvE stronghold history requires Supabase service-role configuration');
  }
  const db = client;
  if (!options.citySlug.trim() || !options.seasonSlug.trim()) {
    throw new Error('Grid PvE stronghold history requires city and season slugs');
  }

  let scopePromise: Promise<{ cityId: string; seasonId: string }> | null = null;
  async function getScope() {
    if (!scopePromise) {
      scopePromise = (async () => {
        const cityResult = await db
          .from('grid_cities')
          .select('id')
          .eq('slug', options.citySlug)
          .single();
        if (cityResult.error) {
          throw new Error(`Failed to resolve Grid PvE history city: ${cityResult.error.message}`);
        }
        const city = cityResult.data as { id: string } | null;
        if (!city?.id) throw new Error('Grid PvE history city returned an invalid result');

        const seasonResult = await db
          .from('grid_seasons')
          .select('id')
          .eq('city_id', city.id)
          .eq('slug', options.seasonSlug)
          .single();
        if (seasonResult.error) {
          throw new Error(`Failed to resolve Grid PvE history season: ${seasonResult.error.message}`);
        }
        const season = seasonResult.data as { id: string } | null;
        if (!season?.id) throw new Error('Grid PvE history season returned an invalid result');
        return { cityId: city.id, seasonId: season.id };
      })();
    }
    return scopePromise;
  }

  return {
    async getContestContext(contestId) {
      const scope = await getScope();
      const { data, error } = await db
        .from('grid_pve_stronghold_contests')
        .select('id,season_id,attacker_player_id')
        .eq('city_id', scope.cityId)
        .eq('season_id', scope.seasonId)
        .eq('id', contestId)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to read Grid PvE stronghold history context: ${error.message}`);
      }
      if (!data) return null;
      const row = data as unknown as {
        id: string;
        season_id: string;
        attacker_player_id: string;
      };
      return {
        contestId: row.id,
        seasonId: row.season_id,
        attackerPlayerId: row.attacker_player_id,
      } satisfies GridPveStrongholdHistoryContext;
    },

    async listContestEvents(contestId, seasonId) {
      const { data, error } = await db
        .from('grid_game_events')
        .select('id,event_type,payload,created_at')
        .eq('season_id', seasonId)
        .eq('entity_type', 'pve_stronghold_contest')
        .eq('entity_id', contestId)
        .in('event_type', [...GRID_PVE_STRONGHOLD_HISTORY_EVENT_TYPES])
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      if (error) {
        throw new Error(`Failed to read Grid PvE stronghold history events: ${error.message}`);
      }
      return (data ?? []).map((item) => {
        const row = item as unknown as GridPveHistoryEventRow;
        return {
          eventId: row.id,
          eventType: row.event_type,
          payload: payloadObject(row.payload),
          createdAt: row.created_at,
        } satisfies GridPveStrongholdHistoryEvent;
      });
    },
  };
}
