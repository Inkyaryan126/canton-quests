import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import { buildGridProgressionSnapshot } from '../core/progression';
import type { GridProgressionStats } from '../core/progression-types';
import type {
  GridProgressionLeaderboardEntry,
  GridProgressionReadPort,
} from './progression-port';

type ProgressionRow = {
  player_id: string;
  total_xp: number | string;
  stats: Partial<GridProgressionStats> | null;
};

function snapshotFromRow(row: ProgressionRow) {
  return buildGridProgressionSnapshot(row.stats ?? {}, Number(row.total_xp));
}

export function createSupabaseGridProgressionReadPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridProgressionReadPort {
  if (!client) throw new Error('Grid progression reads require Supabase service-role configuration');

  return {
    async getSeasonPlayer(seasonId, playerId) {
      const { data, error } = await client
        .from('grid_player_season_progression')
        .select('player_id,total_xp,stats')
        .eq('season_id', seasonId)
        .eq('player_id', playerId)
        .maybeSingle();
      if (error) throw new Error(`Failed to read Grid season progression: ${error.message}`);
      return data ? snapshotFromRow(data as ProgressionRow) : null;
    },

    async getLifetimePlayer(playerId) {
      const { data, error } = await client
        .from('grid_player_lifetime_progression')
        .select('player_id,total_xp,stats')
        .eq('player_id', playerId)
        .maybeSingle();
      if (error) throw new Error(`Failed to read Grid lifetime progression: ${error.message}`);
      return data ? snapshotFromRow(data as ProgressionRow) : null;
    },

    async getSeasonLeaderboard(seasonId, limit = 100) {
      const safeLimit = Math.max(1, Math.min(250, Math.floor(limit)));
      const { data, error } = await client
        .from('grid_player_season_progression')
        .select('player_id,total_xp,stats,grid_rating,level,primary_title')
        .eq('season_id', seasonId)
        .order('grid_rating', { ascending: false })
        .order('total_xp', { ascending: false })
        .limit(safeLimit);
      if (error) throw new Error(`Failed to read Grid season leaderboard: ${error.message}`);

      return ((data ?? []) as Array<ProgressionRow & {
        grid_rating: number;
        level: number;
        primary_title: string | null;
      }>).map((row): GridProgressionLeaderboardEntry => ({
        playerId: row.player_id,
        gridRating: Number(row.grid_rating),
        level: Number(row.level),
        primaryTitle: row.primary_title,
        snapshot: snapshotFromRow(row),
      }));
    },
  };
}
