import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridPveStrongholdReadContext,
  GridPveStrongholdReadPort,
} from './pve-stronghold-read-port';

interface GridPveStrongholdReadRow {
  id: string;
  attacker_player_id: string;
  stronghold_id: string;
  faction_id: string;
  source_territory_id: string;
  target_territory_id: string;
  objective_kind: 'pve-territory' | 'pve-landmark';
  landmark_slug: string | null;
  attacker_committed_influence: number;
  garrison_committed_influence: number;
  attacker_remaining_influence: number;
  garrison_remaining_influence: number;
  round_number: number;
  status: GridPveStrongholdReadContext['status'];
  started_at: string;
  ended_at: string | null;
}

interface GridTerritorySlugRow {
  id: string;
  slug: string;
}

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export interface SupabaseGridPveStrongholdReadOptions {
  client?: SupabaseClient | null;
  citySlug: string;
  seasonSlug: string;
}

export function createSupabaseGridPveStrongholdReadPort(
  options: SupabaseGridPveStrongholdReadOptions,
): GridPveStrongholdReadPort {
  const client = options.client === undefined ? supabaseAdmin : options.client;
  if (!client) {
    throw new Error('Grid PvE stronghold reads require Supabase service-role configuration');
  }
  const db = client;
  if (!options.citySlug.trim() || !options.seasonSlug.trim()) {
    throw new Error('Grid PvE stronghold reads require city and season slugs');
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
          throw new Error(`Failed to resolve Grid PvE read city: ${cityResult.error.message}`);
        }
        const city = requireObject<{ id: string }>(cityResult.data, 'Grid PvE read city');
        const seasonResult = await db
          .from('grid_seasons')
          .select('id')
          .eq('city_id', city.id)
          .eq('slug', options.seasonSlug)
          .single();
        if (seasonResult.error) {
          throw new Error(`Failed to resolve Grid PvE read season: ${seasonResult.error.message}`);
        }
        const season = requireObject<{ id: string }>(seasonResult.data, 'Grid PvE read season');
        return { cityId: city.id, seasonId: season.id };
      })();
    }
    return scopePromise;
  }

  async function hydrate(rows: GridPveStrongholdReadRow[]): Promise<GridPveStrongholdReadContext[]> {
    if (rows.length === 0) return [];
    const territoryIds = [...new Set(rows.flatMap((row) => [
      row.source_territory_id,
      row.target_territory_id,
    ]))];
    const { data, error } = await db
      .from('grid_territories')
      .select('id,slug')
      .in('id', territoryIds);
    if (error) {
      throw new Error(`Failed to resolve Grid PvE contest territories: ${error.message}`);
    }
    const byId = new Map(
      ((data ?? []) as GridTerritorySlugRow[]).map((row) => [row.id, row.slug] as const),
    );
    return rows.map((row) => {
      const sourceTerritorySlug = byId.get(row.source_territory_id);
      const targetTerritorySlug = byId.get(row.target_territory_id);
      if (!sourceTerritorySlug || !targetTerritorySlug) {
        throw new Error(`Grid PvE contest ${row.id} has unresolved territory identity`);
      }
      return {
        contestId: row.id,
        attackerPlayerId: row.attacker_player_id,
        strongholdId: row.stronghold_id,
        factionId: row.faction_id,
        sourceTerritorySlug,
        targetTerritorySlug,
        objectiveKind: row.objective_kind,
        landmarkSlug: row.landmark_slug,
        attackerCommittedInfluence: row.attacker_committed_influence,
        garrisonCommittedInfluence: row.garrison_committed_influence,
        attackerRemainingInfluence: row.attacker_remaining_influence,
        garrisonRemainingInfluence: row.garrison_remaining_influence,
        roundNumber: row.round_number,
        status: row.status,
        startedAt: row.started_at,
        endedAt: row.ended_at,
      };
    });
  }

  const selectColumns = [
    'id',
    'attacker_player_id',
    'stronghold_id',
    'faction_id',
    'source_territory_id',
    'target_territory_id',
    'objective_kind',
    'landmark_slug',
    'attacker_committed_influence',
    'garrison_committed_influence',
    'attacker_remaining_influence',
    'garrison_remaining_influence',
    'round_number',
    'status',
    'started_at',
    'ended_at',
  ].join(',');

  return {
    async listActiveForPlayer(playerId) {
      const scope = await getScope();
      const { data, error } = await db
        .from('grid_pve_stronghold_contests')
        .select(selectColumns)
        .eq('season_id', scope.seasonId)
        .eq('city_id', scope.cityId)
        .eq('attacker_player_id', playerId)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .order('id', { ascending: true });
      if (error) {
        throw new Error(`Failed to list Grid PvE stronghold contests: ${error.message}`);
      }
      return hydrate((data ?? []) as unknown as GridPveStrongholdReadRow[]);
    },

    async getById(contestId) {
      const scope = await getScope();
      const { data, error } = await db
        .from('grid_pve_stronghold_contests')
        .select(selectColumns)
        .eq('season_id', scope.seasonId)
        .eq('city_id', scope.cityId)
        .eq('id', contestId)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to read Grid PvE stronghold contest: ${error.message}`);
      }
      if (!data) return null;
      const hydrated = await hydrate([data as unknown as GridPveStrongholdReadRow]);
      return hydrated[0] ?? null;
    },
  };
}
