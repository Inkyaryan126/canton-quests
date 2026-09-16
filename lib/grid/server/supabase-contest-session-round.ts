import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridContestSessionRoundCommand,
  GridContestSessionRoundContext,
  GridContestSessionRoundPort,
  GridContestSessionRoundResult,
} from './contest-session-round-port';

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridContestSessionRoundPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridContestSessionRoundPort {
  if (!client) {
    throw new Error(
      'Grid contest session rounds require Supabase service-role configuration',
    );
  }

  return {
    async getRoundContext(contestId: string) {
      const { data, error } = await client
        .from('grid_contests')
        .select(
          'id,season_id,attacker_player_id,attacker_remaining_influence,defender_remaining_influence,status',
        )
        .eq('id', contestId)
        .single();

      if (error) {
        throw new Error(`Failed to read Grid contest session: ${error.message}`);
      }

      const row = requireObject<{
        id: string;
        season_id: string;
        attacker_player_id: string;
        attacker_remaining_influence: number;
        defender_remaining_influence: number;
        status: GridContestSessionRoundContext['status'];
      }>(data, 'Grid contest session');

      return {
        contestId: row.id,
        seasonId: row.season_id,
        attackerPlayerId: row.attacker_player_id,
        attackerRemainingInfluence: row.attacker_remaining_influence,
        defenderRemainingInfluence: row.defender_remaining_influence,
        status: row.status,
      };
    },

    async resolveRound(command: GridContestSessionRoundCommand) {
      const { data, error } = await client.rpc(
        'grid_resolve_contest_session_round',
        {
          p_contest_id: command.contestId,
          p_attacker_player_id: command.attackerPlayerId,
          p_attacker_rolls: command.attackerRolls,
          p_defender_rolls: command.defenderRolls,
          p_idempotency_key: command.idempotencyKey,
          p_now: command.now,
        },
      );

      if (error) {
        throw new Error(
          `Failed to resolve Grid contest session round: ${error.message}`,
        );
      }
      return requireObject<GridContestSessionRoundResult>(
        data,
        'Grid contest session round',
      );
    },
  };
}
