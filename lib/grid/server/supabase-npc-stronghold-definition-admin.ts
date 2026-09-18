import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridNpcStrongholdActivation } from '../core/npc-stronghold-types';
import type {
  GridNpcStrongholdDefinitionAdminPort,
  GridNpcStrongholdDefinitionAdminView,
  GridNpcStrongholdDefinitionMutationResult,
} from './npc-stronghold-definition-admin-port';

export interface SupabaseGridNpcStrongholdDefinitionAdminOptions {
  client?: SupabaseClient | null;
  citySlug: string;
  seasonSlug: string;
}

interface DefinitionRow {
  stronghold_id: string;
  faction_id: string;
  territory_id: string;
  landmark_id: string | null;
  activation: GridNpcStrongholdActivation;
  base_garrison_influence: number;
  max_garrison_influence: number;
  pressure_reinforcement_bps: number;
  surge_reinforcement_bps: number;
  enabled: boolean;
  updated_at: string;
}

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridNpcStrongholdDefinitionAdminPort(
  options: SupabaseGridNpcStrongholdDefinitionAdminOptions,
): GridNpcStrongholdDefinitionAdminPort {
  const client = options.client === undefined ? supabaseAdmin : options.client;
  if (!client) {
    throw new Error('Grid NPC stronghold definition admin requires Supabase service-role configuration');
  }
  const db = client;
  if (!options.citySlug.trim() || !options.seasonSlug.trim()) {
    throw new Error('Grid NPC stronghold definition admin requires city and season slugs');
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
          throw new Error(`Failed to resolve Grid stronghold admin city: ${cityResult.error.message}`);
        }
        const city = requireObject<{ id: string }>(cityResult.data, 'Grid stronghold admin city');
        const seasonResult = await db
          .from('grid_seasons')
          .select('id')
          .eq('city_id', city.id)
          .eq('slug', options.seasonSlug)
          .single();
        if (seasonResult.error) {
          throw new Error(`Failed to resolve Grid stronghold admin season: ${seasonResult.error.message}`);
        }
        const season = requireObject<{ id: string }>(seasonResult.data, 'Grid stronghold admin season');
        return { cityId: city.id, seasonId: season.id };
      })();
    }
    return scopePromise;
  }

  async function resolveTerritoryId(cityId: string, slug: string): Promise<string> {
    const { data, error } = await db
      .from('grid_territories')
      .select('id')
      .eq('city_id', cityId)
      .eq('slug', slug)
      .single();
    if (error) {
      throw new Error(`Failed to resolve Grid stronghold territory: ${error.message}`);
    }
    return requireObject<{ id: string }>(data, 'Grid stronghold territory').id;
  }

  async function resolveLandmarkId(
    cityId: string,
    territoryId: string,
    slug: string | null,
  ): Promise<string | null> {
    if (slug === null) return null;
    const { data, error } = await db
      .from('grid_landmarks')
      .select('id,territory_id')
      .eq('city_id', cityId)
      .eq('slug', slug)
      .single();
    if (error) {
      throw new Error(`Failed to resolve Grid stronghold landmark: ${error.message}`);
    }
    const landmark = requireObject<{ id: string; territory_id: string | null }>(
      data,
      'Grid stronghold landmark',
    );
    if (landmark.territory_id !== territoryId) {
      throw new Error('Grid stronghold landmark does not belong to the selected territory');
    }
    return landmark.id;
  }

  async function mutationResult(data: unknown, label: string) {
    return requireObject<GridNpcStrongholdDefinitionMutationResult>(data, label);
  }

  return {
    async listDefinitions() {
      const scope = await getScope();
      const { data, error } = await db
        .from('grid_npc_stronghold_definitions')
        .select(
          'stronghold_id,faction_id,territory_id,landmark_id,activation,base_garrison_influence,max_garrison_influence,pressure_reinforcement_bps,surge_reinforcement_bps,enabled,updated_at',
        )
        .eq('season_id', scope.seasonId)
        .eq('city_id', scope.cityId)
        .order('stronghold_id', { ascending: true });
      if (error) {
        throw new Error(`Failed to list Grid stronghold definitions: ${error.message}`);
      }
      const definitions = (data ?? []) as unknown as DefinitionRow[];
      if (definitions.length === 0) return [];

      const territoryIds = [...new Set(definitions.map((row) => row.territory_id))];
      const landmarkIds = [...new Set(definitions.flatMap((row) => row.landmark_id ? [row.landmark_id] : []))];
      const strongholdIds = definitions.map((row) => row.stronghold_id);
      const [territoryResult, landmarkResult, contestResult] = await Promise.all([
        db.from('grid_territories').select('id,slug').in('id', territoryIds),
        landmarkIds.length === 0
          ? Promise.resolve({ data: [], error: null })
          : db.from('grid_landmarks').select('id,slug').in('id', landmarkIds),
        db
          .from('grid_pve_stronghold_contests')
          .select('stronghold_id,status')
          .eq('season_id', scope.seasonId)
          .in('stronghold_id', strongholdIds),
      ]);
      if (territoryResult.error) {
        throw new Error(`Failed to read Grid stronghold admin territories: ${territoryResult.error.message}`);
      }
      if (landmarkResult.error) {
        throw new Error(`Failed to read Grid stronghold admin landmarks: ${landmarkResult.error.message}`);
      }
      if (contestResult.error) {
        throw new Error(`Failed to read Grid stronghold admin contest history: ${contestResult.error.message}`);
      }

      const territorySlugs = new Map(
        ((territoryResult.data ?? []) as Array<{ id: string; slug: string }>).map((row) => [row.id, row.slug] as const),
      );
      const landmarkSlugs = new Map(
        ((landmarkResult.data ?? []) as Array<{ id: string; slug: string }>).map((row) => [row.id, row.slug] as const),
      );
      const history = new Set<string>();
      const active = new Set<string>();
      for (const row of (contestResult.data ?? []) as Array<{ stronghold_id: string; status: string }>) {
        history.add(row.stronghold_id);
        if (row.status === 'active') active.add(row.stronghold_id);
      }

      return definitions.map((row) => {
        const territorySlug = territorySlugs.get(row.territory_id);
        if (!territorySlug) {
          throw new Error(`Grid stronghold ${row.stronghold_id} has unresolved territory identity`);
        }
        const landmarkSlug = row.landmark_id ? landmarkSlugs.get(row.landmark_id) : null;
        if (row.landmark_id && !landmarkSlug) {
          throw new Error(`Grid stronghold ${row.stronghold_id} has unresolved landmark identity`);
        }
        return {
          strongholdId: row.stronghold_id,
          factionId: row.faction_id,
          territorySlug,
          landmarkSlug: landmarkSlug ?? null,
          activation: row.activation,
          baseGarrisonInfluence: row.base_garrison_influence,
          maxGarrisonInfluence: row.max_garrison_influence,
          pressureReinforcementBps: row.pressure_reinforcement_bps,
          surgeReinforcementBps: row.surge_reinforcement_bps,
          enabled: row.enabled,
          hasContestHistory: history.has(row.stronghold_id),
          activeContest: active.has(row.stronghold_id),
          updatedAt: row.updated_at,
        } satisfies GridNpcStrongholdDefinitionAdminView;
      });
    },

    async upsertDefinition(command) {
      const scope = await getScope();
      const territoryId = await resolveTerritoryId(scope.cityId, command.territorySlug);
      const landmarkId = await resolveLandmarkId(
        scope.cityId,
        territoryId,
        command.landmarkSlug,
      );
      const { data, error } = await db.rpc('grid_upsert_npc_stronghold_definition', {
        p_season_id: scope.seasonId,
        p_city_id: scope.cityId,
        p_stronghold_id: command.strongholdId,
        p_faction_id: command.factionId,
        p_territory_id: territoryId,
        p_landmark_id: landmarkId,
        p_activation: command.activation,
        p_base_garrison_influence: command.baseGarrisonInfluence,
        p_max_garrison_influence: command.maxGarrisonInfluence,
        p_pressure_reinforcement_bps: command.pressureReinforcementBps,
        p_surge_reinforcement_bps: command.surgeReinforcementBps,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) {
        throw new Error(`Failed to upsert Grid stronghold definition: ${error.message}`);
      }
      return mutationResult(data, 'Grid stronghold definition upsert');
    },

    async setDefinitionEnabled(command) {
      const scope = await getScope();
      const { data, error } = await db.rpc(
        'grid_set_npc_stronghold_definition_enabled',
        {
          p_season_id: scope.seasonId,
          p_city_id: scope.cityId,
          p_stronghold_id: command.strongholdId,
          p_enabled: command.enabled,
          p_idempotency_key: command.idempotencyKey,
          p_now: command.now,
        },
      );
      if (error) {
        throw new Error(`Failed to set Grid stronghold enabled state: ${error.message}`);
      }
      return mutationResult(data, 'Grid stronghold definition enabled state');
    },
  };
}
