import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridSeasonHistoryArchiveRecord,
  GridSeasonHistoryPort,
  GridSeasonHistoryProfile,
  GridSeasonHistoryStandingRecord,
} from './season-history-port';

const PROFILE_CHUNK_SIZE = 200;

export function createSupabaseGridSeasonHistoryPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridSeasonHistoryPort {
  if (!client) {
    throw new Error(
      'Grid season history requires Supabase service-role configuration',
    );
  }

  return {
    async readArchive(citySlug, seasonSlug) {
      const cityResult = await client
        .from('grid_cities')
        .select('id,slug')
        .eq('slug', citySlug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(
          'Failed to resolve Grid season history city: ' +
            cityResult.error.message,
        );
      }
      if (!cityResult.data) return null;

      const city = cityResult.data as { id: string; slug: string };
      const seasonResult = await client
        .from('grid_seasons')
        .select('id,slug,name,status')
        .eq('city_id', city.id)
        .eq('slug', seasonSlug)
        .maybeSingle();
      if (seasonResult.error) {
        throw new Error(
          'Failed to resolve Grid season history season: ' +
            seasonResult.error.message,
        );
      }
      if (!seasonResult.data) return null;

      const season = seasonResult.data as {
        id: string;
        slug: string;
        name: string;
        status: string;
      };
      if (season.status !== 'archived') return null;

      const archiveResult = await client
        .from('grid_season_archives')
        .select(
          'season_id,archived_at,champion_player_id,standings_count',
        )
        .eq('season_id', season.id)
        .maybeSingle();
      if (archiveResult.error) {
        throw new Error(
          'Failed to read Grid season archive: ' +
            archiveResult.error.message,
        );
      }
      if (!archiveResult.data) {
        throw new Error(
          'Grid archived season is missing its permanent archive record',
        );
      }

      const row = archiveResult.data as {
        season_id: string;
        archived_at: string;
        champion_player_id: string | null;
        standings_count: number;
      };
      return {
        seasonId: row.season_id,
        citySlug: city.slug,
        seasonSlug: season.slug,
        seasonName: season.name,
        archivedAt: row.archived_at,
        championPlayerId: row.champion_player_id,
        standingsCount: Number(row.standings_count),
      } satisfies GridSeasonHistoryArchiveRecord;
    },

    async readStandings(seasonId) {
      const result = await client
        .from('grid_season_final_standings')
        .select(
          'player_id,final_rank,city_power_bps,grid_rating,total_xp',
        )
        .eq('season_id', seasonId)
        .order('final_rank', { ascending: true });
      if (result.error) {
        throw new Error(
          'Failed to read Grid season final standings: ' +
            result.error.message,
        );
      }

      return (result.data ?? []).map((row) => {
        const value = row as {
          player_id: string;
          final_rank: number;
          city_power_bps: number;
          grid_rating: number;
          total_xp: number | string;
        };
        return {
          playerId: value.player_id,
          finalRank: Number(value.final_rank),
          cityPowerBps: Number(value.city_power_bps),
          gridRating: Number(value.grid_rating),
          totalXp: Number(value.total_xp),
        } satisfies GridSeasonHistoryStandingRecord;
      });
    },

    async readProfiles(playerIds) {
      const uniqueIds = [...new Set(playerIds)].sort();
      const profiles: GridSeasonHistoryProfile[] = [];

      for (
        let offset = 0;
        offset < uniqueIds.length;
        offset += PROFILE_CHUNK_SIZE
      ) {
        const ids = uniqueIds.slice(offset, offset + PROFILE_CHUNK_SIZE);
        if (ids.length === 0) continue;

        const result = await client
          .from('players')
          .select('id,display_name,avatar_url')
          .in('id', ids);
        if (result.error) {
          throw new Error(
            'Failed to read Grid season history player labels: ' +
              result.error.message,
          );
        }

        profiles.push(
          ...(result.data ?? []).map((row) => {
            const value = row as {
              id: string;
              display_name: string;
              avatar_url: string | null;
            };
            return {
              playerId: value.id,
              callsign: value.display_name,
              avatarUrl: value.avatar_url,
            };
          }),
        );
      }

      return profiles;
    },
  };
}
