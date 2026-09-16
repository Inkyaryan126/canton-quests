import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridContestRoundCommand,
  GridContestRoundCommandResult,
  GridContestRoundPort,
} from './contest-port';

function requireResult(data: unknown): GridContestRoundCommandResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Grid contest round returned an invalid result');
  }
  return data as GridContestRoundCommandResult;
}

export function createSupabaseGridContestRoundPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridContestRoundPort {
  if (!client) {
    throw new Error('Grid contest commands require Supabase service-role configuration');
  }

  return {
    async resolveRound(command: GridContestRoundCommand) {
      const { data, error } = await client.rpc('grid_resolve_contest_round', {
        p_season_id: command.seasonId,
        p_attacker_player_id: command.attackerPlayerId,
        p_defender_player_id: command.defenderPlayerId,
        p_source_territory_id: command.sourceTerritoryId,
        p_target_territory_id: command.targetTerritoryId,
        p_attacker_committed_influence: command.attackerCommittedInfluence,
        p_defender_committed_influence: command.defenderCommittedInfluence,
        p_attacker_rolls: command.attackerRolls,
        p_defender_rolls: command.defenderRolls,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });

      if (error) {
        throw new Error(`Failed to resolve Grid contest round: ${error.message}`);
      }
      return requireResult(data);
    },
  };
}
