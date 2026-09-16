import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridStarterTerritoryContext,
  GridStarterTerritoryPort,
} from './starter-territory-port';

export function createSupabaseGridStarterTerritoryPort(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): GridStarterTerritoryPort {
  if (!client) {
    throw new Error(
      'Grid starter territory selection requires Supabase service-role configuration',
    );
  }

  return {
    async getContext(playerId): Promise<GridStarterTerritoryContext> {
      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', pkg.city.slug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(
          `Failed to read Grid starter city: ${cityResult.error.message}`,
        );
      }

      if (!cityResult.data) {
        return {
          seasonPlayable: false,
          joined: false,
          credits: 0,
          commandPoints: 0,
          ownsAnyTerritory: false,
          territories: [],
        };
      }

      const cityId = (cityResult.data as { id: string }).id;
      const seasonResult = await client
        .from('grid_seasons')
        .select('id,status')
        .eq('city_id', cityId)
        .eq('slug', pkg.seasonTemplate.slug)
        .maybeSingle();
      if (seasonResult.error) {
        throw new Error(
          `Failed to read Grid starter season: ${seasonResult.error.message}`,
        );
      }

      if (!seasonResult.data) {
        return {
          seasonPlayable: false,
          joined: false,
          credits: 0,
          commandPoints: 0,
          ownsAnyTerritory: false,
          territories: [],
        };
      }

      const season = seasonResult.data as { id: string; status: string };
      const seasonPlayable = season.status === 'active' || season.status === 'surge';

      const playerResult = await client
        .from('grid_player_season_state')
        .select('credits,command_points')
        .eq('season_id', season.id)
        .eq('player_id', playerId)
        .maybeSingle();
      if (playerResult.error) {
        throw new Error(
          `Failed to read Grid starter wallet: ${playerResult.error.message}`,
        );
      }

      if (!playerResult.data) {
        return {
          seasonPlayable,
          joined: false,
          credits: 0,
          commandPoints: 0,
          ownsAnyTerritory: false,
          territories: [],
        };
      }

      const wallet = playerResult.data as {
        credits: number;
        command_points: number;
      };

      const ownedResult = await client
        .from('grid_season_territory_state')
        .select('territory_id')
        .eq('season_id', season.id)
        .eq('owner_player_id', playerId)
        .limit(1);
      if (ownedResult.error) {
        throw new Error(
          `Failed to read Grid starter ownership: ${ownedResult.error.message}`,
        );
      }

      const ownsAnyTerritory = (ownedResult.data ?? []).length > 0;
      if (ownsAnyTerritory) {
        return {
          seasonPlayable,
          joined: true,
          credits: Number(wallet.credits),
          commandPoints: Number(wallet.command_points),
          ownsAnyTerritory: true,
          territories: [],
        };
      }

      const starterSlugs =
        pkg.seasonTemplate.economy?.neutralClaims.starterTerritorySlugs ?? [];
      if (starterSlugs.length === 0) {
        return {
          seasonPlayable,
          joined: true,
          credits: Number(wallet.credits),
          commandPoints: Number(wallet.command_points),
          ownsAnyTerritory: false,
          territories: [],
        };
      }

      const territoryResult = await client
        .from('grid_territories')
        .select('id,slug')
        .eq('city_id', cityId)
        .in('slug', starterSlugs);
      if (territoryResult.error) {
        throw new Error(
          `Failed to read Grid starter territories: ${territoryResult.error.message}`,
        );
      }

      const territoryRows = (territoryResult.data ?? []) as Array<{
        id: string;
        slug: string;
      }>;
      const territoryIds = territoryRows.map((row) => row.id);

      const ownershipByTerritoryId = new Map<string, boolean>();
      if (territoryIds.length > 0) {
        const stateResult = await client
          .from('grid_season_territory_state')
          .select('territory_id,owner_player_id')
          .eq('season_id', season.id)
          .in('territory_id', territoryIds);
        if (stateResult.error) {
          throw new Error(
            `Failed to read Grid starter availability: ${stateResult.error.message}`,
          );
        }

        for (const row of (stateResult.data ?? []) as Array<{
          territory_id: string;
          owner_player_id: string | null;
        }>) {
          ownershipByTerritoryId.set(
            row.territory_id,
            Boolean(row.owner_player_id),
          );
        }
      }

      return {
        seasonPlayable,
        joined: true,
        credits: Number(wallet.credits),
        commandPoints: Number(wallet.command_points),
        ownsAnyTerritory: false,
        territories: territoryRows.map((row) => ({
          territoryId: row.id,
          territorySlug: row.slug,
          occupied: ownershipByTerritoryId.get(row.id) ?? false,
        })),
      };
    },
  };
}
