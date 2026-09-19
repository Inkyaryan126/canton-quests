import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import { buildGridProgressionSnapshot } from '../core/progression';
import type { GridProgressionStats } from '../core/progression-types';
import type {
  GridSeasonArchiveCommitResult,
  GridSeasonArchivePort,
} from './season-archive-port';

const PAGE_SIZE = 500;

interface ProgressionRow {
  player_id: string;
  total_xp: number | string;
  stats: Partial<GridProgressionStats> | null;
}

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridSeasonArchivePort(
  client: SupabaseClient | null = supabaseAdmin,
): GridSeasonArchivePort {
  if (!client) {
    throw new Error(
      'Grid season archive requires Supabase service-role configuration',
    );
  }
  const db = client;

  return {
    async resolveScope(citySlug, seasonSlug) {
      const cityResult = await db
        .from('grid_cities')
        .select('id,slug')
        .eq('slug', citySlug)
        .maybeSingle();

      if (cityResult.error) {
        throw new Error(
          `Failed to resolve Grid archive city: ${cityResult.error.message}`,
        );
      }
      if (!cityResult.data) return null;

      const city = cityResult.data as { id: string; slug: string };
      const seasonResult = await db
        .from('grid_seasons')
        .select('id,slug,name,status,ends_at')
        .eq('city_id', city.id)
        .eq('slug', seasonSlug)
        .maybeSingle();

      if (seasonResult.error) {
        throw new Error(
          `Failed to resolve Grid archive season: ${seasonResult.error.message}`,
        );
      }
      if (!seasonResult.data) return null;

      const season = seasonResult.data as {
        id: string;
        slug: string;
        name: string;
        status: string;
        ends_at: string | null;
      };

      return {
        cityId: city.id,
        citySlug: city.slug,
        seasonId: season.id,
        seasonSlug: season.slug,
        seasonName: season.name,
        seasonStatus: season.status,
        endsAt: season.ends_at,
      };
    },

    async listCandidates(seasonId) {
      const playerIds: string[] = [];
      let stateOffset = 0;

      while (true) {
        const stateResult = await db
          .from('grid_player_season_state')
          .select('player_id')
          .eq('season_id', seasonId)
          .order('player_id', { ascending: true })
          .range(stateOffset, stateOffset + PAGE_SIZE - 1);

        if (stateResult.error) {
          throw new Error(
            `Failed to read Grid archive season players: ${stateResult.error.message}`,
          );
        }

        const page = (stateResult.data ?? []) as Array<{ player_id: string }>;
        playerIds.push(...page.map((row) => row.player_id));
        if (page.length < PAGE_SIZE) break;
        stateOffset += page.length;
      }

      const progressionByPlayerId = new Map<string, ProgressionRow>();
      let progressionOffset = 0;

      while (true) {
        const progressionResult = await db
          .from('grid_player_season_progression')
          .select('player_id,total_xp,stats')
          .eq('season_id', seasonId)
          .order('player_id', { ascending: true })
          .range(
            progressionOffset,
            progressionOffset + PAGE_SIZE - 1,
          );

        if (progressionResult.error) {
          throw new Error(
            `Failed to read Grid archive progression: ${progressionResult.error.message}`,
          );
        }

        const page = (progressionResult.data ?? []) as ProgressionRow[];
        for (const row of page) progressionByPlayerId.set(row.player_id, row);
        if (page.length < PAGE_SIZE) break;
        progressionOffset += page.length;
      }

      return playerIds.map((playerId) => {
        const row = progressionByPlayerId.get(playerId);
        return {
          playerId,
          snapshot: row
            ? buildGridProgressionSnapshot(
                row.stats ?? {},
                Number(row.total_xp),
              )
            : buildGridProgressionSnapshot({}, 0),
        };
      });
    },

    async archiveSeason(command) {
      const result = await db.rpc('grid_archive_season', {
        p_season_id: command.seasonId,
        p_standings: command.standings,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });

      if (result.error) {
        throw new Error(
          `Failed to archive Grid season: ${result.error.message}`,
        );
      }

      return requireObject<GridSeasonArchiveCommitResult>(
        result.data,
        'Grid season archive',
      );
    },
  };
}
