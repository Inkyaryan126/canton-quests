import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridContestAttackContext,
  GridContestAttackContextRequest,
  GridContestAttackPort,
  GridContestAutoRetreatCommand,
  GridContestAutoRetreatResult,
} from './contest-attack-port';

function requireClient(
  client: SupabaseClient | null,
): asserts client is SupabaseClient {
  if (!client) {
    throw new Error('Grid attacks require Supabase service-role configuration');
  }
}

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridContestAttackPort(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): GridContestAttackPort {
  requireClient(client);

  return {
    async getAttackContext(
      request: GridContestAttackContextRequest,
    ): Promise<GridContestAttackContext> {
      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', pkg.city.slug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(`Failed to resolve Grid attack city: ${cityResult.error.message}`);
      }
      if (!cityResult.data) throw new Error('GRID_CITY_NOT_IMPORTED');

      const cityId = (cityResult.data as { id: string }).id;
      const seasonResult = await client
        .from('grid_seasons')
        .select('id,status')
        .eq('city_id', cityId)
        .eq('slug', pkg.seasonTemplate.slug)
        .maybeSingle();
      if (seasonResult.error) {
        throw new Error(`Failed to resolve Grid attack season: ${seasonResult.error.message}`);
      }
      if (!seasonResult.data) throw new Error('GRID_SEASON_NOT_IMPORTED');

      const season = seasonResult.data as { id: string; status: string };
      if (!['active', 'surge'].includes(season.status)) {
        throw new Error('SEASON_NOT_ACTIVE');
      }

      const territoryResult = await client
        .from('grid_territories')
        .select('id,city_id,slug')
        .in('id', [request.sourceTerritoryId, request.targetTerritoryId]);
      if (territoryResult.error) {
        throw new Error(`Failed to resolve Grid attack territories: ${territoryResult.error.message}`);
      }

      const territories = (territoryResult.data ?? []) as Array<{
        id: string;
        city_id: string;
        slug: string;
      }>;
      const source = territories.find((row) => row.id === request.sourceTerritoryId);
      const target = territories.find((row) => row.id === request.targetTerritoryId);
      if (!source) throw new Error('SOURCE_TERRITORY_NOT_FOUND');
      if (!target) throw new Error('TARGET_TERRITORY_NOT_FOUND');
      if (source.city_id !== cityId || target.city_id !== cityId) {
        throw new Error('CONTEST_TERRITORY_WRONG_CITY');
      }

      const stateResult = await client
        .from('grid_season_territory_state')
        .select('territory_id,owner_player_id')
        .eq('season_id', season.id)
        .in('territory_id', [source.id, target.id]);
      if (stateResult.error) {
        throw new Error(`Failed to resolve Grid attack ownership: ${stateResult.error.message}`);
      }

      const states = (stateResult.data ?? []) as Array<{
        territory_id: string;
        owner_player_id: string | null;
      }>;
      const sourceState = states.find((row) => row.territory_id === source.id);
      const targetState = states.find((row) => row.territory_id === target.id);

      if (sourceState?.owner_player_id !== request.attackerPlayerId) {
        throw new Error('SOURCE_TERRITORY_NOT_OWNED_BY_ATTACKER');
      }
      if (!targetState?.owner_player_id) {
        throw new Error('TARGET_TERRITORY_NOT_OCCUPIED');
      }
      if (targetState.owner_player_id === request.attackerPlayerId) {
        throw new Error('TARGET_TERRITORY_OWNED_BY_ATTACKER');
      }

      const defenderPlayerId = targetState.owner_player_id;

      return {
        seasonId: season.id,
        cityId,
        attackerPlayerId: request.attackerPlayerId,
        defenderPlayerId,
        sourceTerritoryId: source.id,
        targetTerritoryId: target.id,
        targetTerritorySlug: target.slug,
      };
    },

    async captureByAutoRetreat(command: GridContestAutoRetreatCommand) {
      const { data, error } = await client.rpc(
        'grid_capture_territory_by_auto_retreat',
        {
          p_season_id: command.seasonId,
          p_attacker_player_id: command.attackerPlayerId,
          p_defender_player_id: command.defenderPlayerId,
          p_source_territory_id: command.sourceTerritoryId,
          p_target_territory_id: command.targetTerritoryId,
          p_defense_doctrine_id: command.defenseDoctrineId,
          p_defense_reason: command.defenseReason,
          p_defense_tactic: command.defenseTactic,
          p_idempotency_key: command.idempotencyKey,
          p_now: command.now,
        },
      );
      if (error) {
        throw new Error(`Failed to capture Grid territory by retreat: ${error.message}`);
      }
      return requireObject<GridContestAutoRetreatResult>(
        data,
        'Grid auto-retreat capture',
      );
    },
  };
}
