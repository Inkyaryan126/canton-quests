import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import { validateOfflineDefensePolicy } from '../core/offline-defense';
import type {
  GridOfflineDefensePolicy,
  GridOfflineDefensePriorityRule,
} from '../core/offline-defense-types';
import type {
  GridOfflineDefensePolicyPort,
  GridOfflineDefensePolicyState,
  GridSetOfflineDefensePolicyCommand,
  GridSetOfflineDefensePolicyResult,
} from './offline-defense-port';

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

interface GridOfflineDefensePolicyRow {
  season_id: string;
  player_id: string;
  doctrine_id: string;
  reserve_influence: number;
  max_commit_per_contest: number;
  default_commit_bps: number;
  auto_retreat_below_influence: number;
  auto_retreat_after_losses: number;
  default_tactic: GridOfflineDefensePolicy['defaultTactic'];
  priority_rules: GridOfflineDefensePriorityRule[];
  updated_at: string;
}

function policyFromRow(
  row: GridOfflineDefensePolicyRow,
): GridOfflineDefensePolicyState {
  const policy: GridOfflineDefensePolicy = {
    doctrineId: row.doctrine_id,
    reserveInfluence: Number(row.reserve_influence),
    maxCommitPerContest: Number(row.max_commit_per_contest),
    defaultCommitBps: Number(row.default_commit_bps),
    autoRetreatBelowInfluence: Number(row.auto_retreat_below_influence),
    autoRetreatAfterLosses: Number(row.auto_retreat_after_losses),
    defaultTactic: row.default_tactic,
    priorityRules: row.priority_rules ?? [],
  };
  validateOfflineDefensePolicy(policy);

  return {
    seasonId: row.season_id,
    playerId: row.player_id,
    policy,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseGridOfflineDefensePolicyPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridOfflineDefensePolicyPort {
  if (!client) {
    throw new Error(
      'Grid offline defense requires Supabase service-role configuration',
    );
  }

  return {
    async getPolicy(seasonId: string, playerId: string) {
      const { data, error } = await client
        .from('grid_offline_defense_policies')
        .select(
          'season_id,player_id,doctrine_id,reserve_influence,max_commit_per_contest,default_commit_bps,auto_retreat_below_influence,auto_retreat_after_losses,default_tactic,priority_rules,updated_at',
        )
        .eq('season_id', seasonId)
        .eq('player_id', playerId)
        .maybeSingle();

      if (error) {
        throw new Error(
          `Failed to read Grid offline defense policy: ${error.message}`,
        );
      }
      if (!data) return null;

      return policyFromRow(data as GridOfflineDefensePolicyRow);
    },

    async setPolicy(command: GridSetOfflineDefensePolicyCommand) {
      const { data, error } = await client.rpc(
        'grid_set_offline_defense_policy',
        {
          p_season_id: command.seasonId,
          p_player_id: command.playerId,
          p_doctrine_id: command.policy.doctrineId,
          p_reserve_influence: command.policy.reserveInfluence,
          p_max_commit_per_contest: command.policy.maxCommitPerContest,
          p_default_commit_bps: command.policy.defaultCommitBps,
          p_auto_retreat_below_influence:
            command.policy.autoRetreatBelowInfluence,
          p_auto_retreat_after_losses:
            command.policy.autoRetreatAfterLosses,
          p_default_tactic: command.policy.defaultTactic,
          p_priority_rules: command.policy.priorityRules,
          p_idempotency_key: command.idempotencyKey,
          p_now: command.now,
        },
      );

      if (error) {
        throw new Error(
          `Failed to set Grid offline defense policy: ${error.message}`,
        );
      }

      return requireObject<GridSetOfflineDefensePolicyResult>(
        data,
        'Grid offline defense policy',
      );
    },
  };
}
