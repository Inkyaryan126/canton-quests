import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import { buildGridProgressionSnapshot } from '../core/progression';
import type { GridProgressionStats } from '../core/progression-types';
import type {
  GridProgressionLeaderboardCandidate,
  GridProgressionLeaderboardDataPort,
  GridPublicPlayerProfile,
} from './progression-leaderboard-port';

const PROGRESSION_PAGE_SIZE = 500;
const PROFILE_CHUNK_SIZE = 200;

type ProgressionRow = {
  player_id: string;
  total_xp: number | string;
  stats: Partial<GridProgressionStats> | null;
};

type PlayerRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

async function getSeasonCandidates(
  client: SupabaseClient,
  seasonId: string,
): Promise<GridProgressionLeaderboardCandidate[]> {
  const candidates: GridProgressionLeaderboardCandidate[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from('grid_player_season_progression')
      .select('player_id,total_xp,stats')
      .eq('season_id', seasonId)
      .order('player_id', { ascending: true })
      .range(offset, offset + PROGRESSION_PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Failed to read Grid progression leaderboard candidates: ${error.message}`);
    }

    const page = (data ?? []) as ProgressionRow[];
    candidates.push(
      ...page.map((row) => ({
        playerId: row.player_id,
        snapshot: buildGridProgressionSnapshot(row.stats ?? {}, Number(row.total_xp)),
      })),
    );
    if (page.length < PROGRESSION_PAGE_SIZE) break;
    offset += page.length;
  }

  return candidates;
}

async function getPublicProfiles(
  client: SupabaseClient,
  playerIds: string[],
): Promise<GridPublicPlayerProfile[]> {
  const uniqueIds = [...new Set(playerIds)].sort();
  const profiles: GridPublicPlayerProfile[] = [];

  for (let offset = 0; offset < uniqueIds.length; offset += PROFILE_CHUNK_SIZE) {
    const ids = uniqueIds.slice(offset, offset + PROFILE_CHUNK_SIZE);
    if (ids.length === 0) continue;
    const { data, error } = await client
      .from('players')
      .select('id,display_name,avatar_url')
      .in('id', ids);
    if (error) {
      throw new Error(`Failed to read Grid public player profiles: ${error.message}`);
    }
    profiles.push(
      ...((data ?? []) as PlayerRow[]).map((row) => ({
        playerId: row.id,
        callsign: row.display_name,
        avatarUrl: row.avatar_url,
      })),
    );
  }

  return profiles;
}

export function createSupabaseGridProgressionLeaderboardDataPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridProgressionLeaderboardDataPort {
  if (!client) {
    throw new Error('Grid progression leaderboard requires Supabase service-role configuration');
  }
  return {
    getSeasonCandidates(seasonId) {
      return getSeasonCandidates(client, seasonId);
    },
    getPublicProfiles(playerIds) {
      return getPublicProfiles(client, playerIds);
    },
  };
}
