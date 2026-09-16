import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridActiveContest,
  GridActiveContestPort,
  GridActiveContestQuery,
} from './active-contest-port';

interface GridActiveContestRow {
  id: string;
  season_id: string;
  city_id: string;
  source_territory_id: string;
  target_territory_id: string;
  attacker_player_id: string;
  defender_player_id: string;
  attacker_remaining_influence: number;
  defender_remaining_influence: number;
  round_number: number;
  started_at: string;
}

function mapActiveContest(row: GridActiveContestRow): GridActiveContest {
  return {
    contestId: row.id,
    seasonId: row.season_id,
    cityId: row.city_id,
    sourceTerritoryId: row.source_territory_id,
    targetTerritoryId: row.target_territory_id,
    attackerPlayerId: row.attacker_player_id,
    defenderPlayerId: row.defender_player_id,
    attackerRemainingInfluence: row.attacker_remaining_influence,
    defenderRemainingInfluence: row.defender_remaining_influence,
    roundNumber: row.round_number,
    startedAt: row.started_at,
  };
}

export function createSupabaseGridActiveContestPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridActiveContestPort {
  if (!client) {
    throw new Error(
      'Grid active contest discovery requires Supabase service-role configuration',
    );
  }

  return {
    async listActiveContests(query: GridActiveContestQuery) {
      let request = client
        .from('grid_contests')
        .select(
          [
            'id',
            'season_id',
            'city_id',
            'source_territory_id',
            'target_territory_id',
            'attacker_player_id',
            'defender_player_id',
            'attacker_remaining_influence',
            'defender_remaining_influence',
            'round_number',
            'started_at',
          ].join(','),
        )
        .eq('season_id', query.seasonId)
        .eq('status', 'active');

      if (query.playerId) {
        request = request.or(
          `attacker_player_id.eq.${query.playerId},defender_player_id.eq.${query.playerId}`,
        );
      }
      if (query.territoryId) {
        request = request.or(
          `source_territory_id.eq.${query.territoryId},target_territory_id.eq.${query.territoryId}`,
        );
      }

      const { data, error } = await request
        .order('started_at', { ascending: false })
        .order('id', { ascending: true });

      if (error) {
        throw new Error(`Failed to read active Grid contests: ${error.message}`);
      }

      return (data ?? []).map((row) =>
        mapActiveContest(row as unknown as GridActiveContestRow),
      );
    },
  };
}
