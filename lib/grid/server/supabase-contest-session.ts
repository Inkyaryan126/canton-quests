import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridContestSessionPort,
  GridStartContestCommand,
  GridStartContestResult,
  GridWithdrawContestCommand,
  GridWithdrawContestResult,
} from './contest-session-port';

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridContestSessionPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridContestSessionPort {
  if (!client) {
    throw new Error('Grid contest sessions require Supabase service-role configuration');
  }

  return {
    async startContest(command: GridStartContestCommand) {
      const { data, error } = await client.rpc('grid_start_contest', {
        p_season_id: command.seasonId,
        p_attacker_player_id: command.attackerPlayerId,
        p_defender_player_id: command.defenderPlayerId,
        p_source_territory_id: command.sourceTerritoryId,
        p_target_territory_id: command.targetTerritoryId,
        p_attacker_committed_influence: command.attackerCommittedInfluence,
        p_defender_committed_influence: command.defenderCommittedInfluence,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });

      if (error) {
        throw new Error(`Failed to start Grid contest: ${error.message}`);
      }
      return requireObject<GridStartContestResult>(data, 'Grid contest start');
    },

    async withdrawContest(command: GridWithdrawContestCommand) {
      const { data, error } = await client.rpc('grid_withdraw_contest', {
        p_contest_id: command.contestId,
        p_attacker_player_id: command.attackerPlayerId,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });

      if (error) {
        throw new Error(`Failed to withdraw Grid contest: ${error.message}`);
      }
      return requireObject<GridWithdrawContestResult>(
        data,
        'Grid contest withdrawal',
      );
    },
  };
}
