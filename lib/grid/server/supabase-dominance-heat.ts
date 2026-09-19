import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridDominanceHeatAllianceContext,
  GridDominanceHeatLivePort,
} from './dominance-heat-live-port';

function exactCount(
  result: { count: number | null; error: { message: string } | null },
  label: string,
): number {
  if (result.error) {
    throw new Error(`Failed to read Grid Dominance Heat ${label}: ${result.error.message}`);
  }
  if (!Number.isSafeInteger(result.count) || (result.count ?? -1) < 0) {
    throw new Error(`Grid Dominance Heat ${label} returned an invalid count`);
  }
  return result.count!;
}

export function createSupabaseGridDominanceHeatLivePort(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): GridDominanceHeatLivePort {
  if (!client) {
    throw new Error(
      'Grid Dominance Heat requires Supabase service-role configuration',
    );
  }

  return {
    async readContext(playerId) {
      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', pkg.city.slug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(
          `Failed to resolve Grid Dominance Heat city: ${cityResult.error.message}`,
        );
      }
      if (!cityResult.data) return null;
      const cityId = (cityResult.data as { id: string }).id;

      const seasonResult = await client
        .from('grid_seasons')
        .select('id,status')
        .eq('city_id', cityId)
        .eq('slug', pkg.seasonTemplate.slug)
        .maybeSingle();
      if (seasonResult.error) {
        throw new Error(
          `Failed to resolve Grid Dominance Heat season: ${seasonResult.error.message}`,
        );
      }
      if (!seasonResult.data) return null;

      const season = seasonResult.data as { id: string; status: string };
      const [joinedResult, eligibleResult, playerTerritoryResult] =
        await Promise.all([
          client
            .from('grid_player_season_state')
            .select('id')
            .eq('season_id', season.id)
            .eq('player_id', playerId)
            .maybeSingle(),
          client
            .from('grid_territories')
            .select('id', { count: 'exact', head: true })
            .eq('city_id', cityId),
          client
            .from('grid_season_territory_state')
            .select('id', { count: 'exact', head: true })
            .eq('season_id', season.id)
            .eq('owner_player_id', playerId),
        ]);

      if (joinedResult.error) {
        throw new Error(
          `Failed to read Grid Dominance Heat player state: ${joinedResult.error.message}`,
        );
      }

      const eligibleTerritories = exactCount(
        eligibleResult,
        'eligible territories',
      );
      const playerControlledTerritories = exactCount(
        playerTerritoryResult,
        'player territories',
      );

      if (!joinedResult.data) {
        return {
          seasonId: season.id,
          seasonStatus: season.status,
          joined: false,
          eligibleTerritories,
          playerControlledTerritories,
          alliance: null,
        };
      }

      const membershipResult = await client
        .from('grid_alliance_memberships')
        .select('alliance_id')
        .eq('season_id', season.id)
        .eq('player_id', playerId)
        .is('left_at', null)
        .maybeSingle();
      if (membershipResult.error) {
        throw new Error(
          `Failed to read Grid Dominance Heat alliance membership: ${membershipResult.error.message}`,
        );
      }

      let alliance: GridDominanceHeatAllianceContext | null = null;

      if (membershipResult.data) {
        const allianceId = (
          membershipResult.data as { alliance_id: string }
        ).alliance_id;

        const [allianceResult, membersResult] = await Promise.all([
          client
            .from('grid_alliances')
            .select('id,name,status')
            .eq('id', allianceId)
            .eq('season_id', season.id)
            .maybeSingle(),
          client
            .from('grid_alliance_memberships')
            .select('player_id')
            .eq('season_id', season.id)
            .eq('alliance_id', allianceId)
            .is('left_at', null),
        ]);

        if (allianceResult.error) {
          throw new Error(
            `Failed to read Grid Dominance Heat alliance: ${allianceResult.error.message}`,
          );
        }
        if (membersResult.error) {
          throw new Error(
            `Failed to read Grid Dominance Heat alliance members: ${membersResult.error.message}`,
          );
        }
        if (!allianceResult.data) {
          throw new Error(
            'Grid Dominance Heat active membership references a missing alliance',
          );
        }

        const allianceRow = allianceResult.data as {
          id: string;
          name: string;
          status: string;
        };
        if (allianceRow.status !== 'active') {
          throw new Error(
            'Grid Dominance Heat active membership references a non-active alliance',
          );
        }

        const memberIds = (
          (membersResult.data ?? []) as Array<{ player_id: string }>
        ).map((row) => row.player_id);

        if (memberIds.length === 0) {
          throw new Error(
            'Grid Dominance Heat active alliance has no active members',
          );
        }

        const allianceTerritoryResult = await client
          .from('grid_season_territory_state')
          .select('id', { count: 'exact', head: true })
          .eq('season_id', season.id)
          .in('owner_player_id', memberIds);

        alliance = {
          allianceId: allianceRow.id,
          name: allianceRow.name,
          controlledTerritories: exactCount(
            allianceTerritoryResult,
            'alliance territories',
          ),
        };
      }

      return {
        seasonId: season.id,
        seasonStatus: season.status,
        joined: true,
        eligibleTerritories,
        playerControlledTerritories,
        alliance,
      };
    },
  };
}
