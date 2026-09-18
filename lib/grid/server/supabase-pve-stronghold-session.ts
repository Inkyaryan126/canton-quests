import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridNpcStrongholdProjection } from '../core/npc-stronghold-types';
import type {
  GridPveStrongholdRoundContext,
  GridPveStrongholdSessionPort,
  GridResolvePveStrongholdRoundResult,
  GridStartPveStrongholdSessionResult,
} from './pve-stronghold-session-port';

export interface GridPveStrongholdResolverRequest {
  strongholdId: string;
  now: string;
}

export type GridPveStrongholdResolver = (
  request: GridPveStrongholdResolverRequest,
) => Promise<GridNpcStrongholdProjection | null> | GridNpcStrongholdProjection | null;

export interface SupabaseGridPveStrongholdSessionOptions {
  client?: SupabaseClient | null;
  citySlug: string;
  seasonSlug: string;
  resolveStronghold: GridPveStrongholdResolver;
}

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridPveStrongholdSessionPort(
  options: SupabaseGridPveStrongholdSessionOptions,
): GridPveStrongholdSessionPort {
  const client = options.client === undefined ? supabaseAdmin : options.client;
  if (!client) {
    throw new Error('Grid PvE stronghold sessions require Supabase service-role configuration');
  }
  if (!options.citySlug.trim() || !options.seasonSlug.trim()) {
    throw new Error('Grid PvE stronghold sessions require city and season slugs');
  }

  return {
    async getStartContext(request) {
      const stronghold = await options.resolveStronghold({
        strongholdId: request.strongholdId,
        now: request.now,
      });
      if (!stronghold) {
        throw new Error('Grid PvE stronghold is not available');
      }

      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', options.citySlug)
        .single();
      if (cityResult.error) {
        throw new Error(`Failed to resolve Grid PvE city: ${cityResult.error.message}`);
      }
      const city = requireObject<{ id: string }>(cityResult.data, 'Grid PvE city');

      const seasonResult = await client
        .from('grid_seasons')
        .select('id,city_id')
        .eq('city_id', city.id)
        .eq('slug', options.seasonSlug)
        .single();
      if (seasonResult.error) {
        throw new Error(`Failed to resolve Grid PvE season: ${seasonResult.error.message}`);
      }
      const season = requireObject<{ id: string; city_id: string }>(
        seasonResult.data,
        'Grid PvE season',
      );

      const [sourceResult, targetResult] = await Promise.all([
        client
          .from('grid_territories')
          .select('id')
          .eq('id', request.sourceTerritoryId)
          .eq('city_id', city.id)
          .single(),
        client
          .from('grid_territories')
          .select('id')
          .eq('slug', stronghold.objective.territorySlug)
          .eq('city_id', city.id)
          .single(),
      ]);
      if (sourceResult.error) {
        throw new Error(`Failed to resolve Grid PvE source territory: ${sourceResult.error.message}`);
      }
      if (targetResult.error) {
        throw new Error(`Failed to resolve Grid PvE target territory: ${targetResult.error.message}`);
      }
      const source = requireObject<{ id: string }>(sourceResult.data, 'Grid PvE source territory');
      const target = requireObject<{ id: string }>(targetResult.data, 'Grid PvE target territory');

      return {
        seasonId: season.id,
        cityId: season.city_id,
        attackerPlayerId: request.attackerPlayerId,
        sourceTerritoryId: source.id,
        targetTerritoryId: target.id,
        stronghold,
      };
    },

    async startContest(command) {
      const { data, error } = await client.rpc('grid_start_pve_stronghold_contest', {
        p_season_id: command.seasonId,
        p_city_id: command.cityId,
        p_stronghold_id: command.strongholdId,
        p_faction_id: command.factionId,
        p_attacker_player_id: command.attackerPlayerId,
        p_source_territory_id: command.sourceTerritoryId,
        p_target_territory_id: command.targetTerritoryId,
        p_objective_kind: command.objectiveKind,
        p_landmark_slug: command.landmarkSlug,
        p_attacker_committed_influence: command.attackerCommittedInfluence,
        p_garrison_committed_influence: command.garrisonCommittedInfluence,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) {
        throw new Error(`Failed to start Grid PvE stronghold contest: ${error.message}`);
      }
      return requireObject<GridStartPveStrongholdSessionResult>(data, 'Grid PvE stronghold start');
    },

    async getRoundContext(contestId) {
      const { data, error } = await client
        .from('grid_pve_stronghold_contests')
        .select('id,attacker_player_id,status,attacker_remaining_influence,garrison_remaining_influence')
        .eq('id', contestId)
        .single();
      if (error) {
        throw new Error(`Failed to read Grid PvE stronghold contest: ${error.message}`);
      }
      const row = requireObject<{
        id: string;
        attacker_player_id: string;
        status: GridPveStrongholdRoundContext['status'];
        attacker_remaining_influence: number;
        garrison_remaining_influence: number;
      }>(data, 'Grid PvE stronghold contest');
      return {
        contestId: row.id,
        attackerPlayerId: row.attacker_player_id,
        status: row.status,
        attackerRemainingInfluence: row.attacker_remaining_influence,
        garrisonRemainingInfluence: row.garrison_remaining_influence,
      };
    },

    async resolveRound(command) {
      const { data, error } = await client.rpc('grid_resolve_pve_stronghold_round', {
        p_contest_id: command.contestId,
        p_attacker_player_id: command.attackerPlayerId,
        p_attacker_rolls: command.attackerRolls,
        p_garrison_rolls: command.garrisonRolls,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) {
        throw new Error(`Failed to resolve Grid PvE stronghold round: ${error.message}`);
      }
      return requireObject<GridResolvePveStrongholdRoundResult>(data, 'Grid PvE stronghold round');
    },
  };
}
