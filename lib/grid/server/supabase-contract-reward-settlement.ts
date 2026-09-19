import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridContractRewardSettlementPort,
  GridContractRewardSettlementResult,
} from './contract-reward-settlement-port';

function safeInteger(value: unknown, label: string): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(
      `Grid Contract reward settlement returned invalid ${label}`,
    );
  }
  return parsed;
}

function resultFrom(value: unknown): GridContractRewardSettlementResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      'Grid Contract reward settlement returned an invalid result',
    );
  }

  const row = value as Record<string, unknown>;
  const rewardKind = row.rewardKind;
  const outcome = row.outcome;
  if (
    typeof row.outboxId !== 'string' ||
    typeof row.seasonId !== 'string' ||
    typeof row.playerId !== 'string' ||
    typeof row.contractId !== 'string' ||
    (rewardKind !== 'contract' && rewardKind !== 'location-bonus') ||
    (outcome !== 'applied' && outcome !== 'duplicate') ||
    typeof row.processedAt !== 'string' ||
    typeof row.eventId !== 'string'
  ) {
    throw new Error(
      'Grid Contract reward settlement returned an invalid result',
    );
  }

  return {
    outboxId: row.outboxId,
    seasonId: row.seasonId,
    playerId: row.playerId,
    contractId: row.contractId,
    rewardKind,
    outcome,
    creditsGranted: safeInteger(row.creditsGranted, 'creditsGranted'),
    influenceGranted: safeInteger(row.influenceGranted, 'influenceGranted'),
    commandPointsGranted: safeInteger(
      row.commandPointsGranted,
      'commandPointsGranted',
    ),
    credits: safeInteger(row.credits, 'credits'),
    influence: safeInteger(row.influence, 'influence'),
    commandPoints: safeInteger(row.commandPoints, 'commandPoints'),
    processedAt: row.processedAt,
    eventId: row.eventId,
  };
}

export function createSupabaseGridContractRewardSettlementPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridContractRewardSettlementPort {
  if (!client) {
    throw new Error(
      'Grid Contract reward settlement requires Supabase service-role configuration',
    );
  }

  return {
    async listPendingRewardIds(limit) {
      const result = await client
        .from('grid_contract_reward_outbox')
        .select('id')
        .is('processed_at', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit);

      if (result.error) {
        throw new Error(
          'Failed to discover pending Grid Contract rewards: ' +
            result.error.message,
        );
      }

      return ((result.data ?? []) as Array<{ id: string }>).map(
        (row) => row.id,
      );
    },

    async settleReward(input) {
      const result = await client.rpc('grid_settle_contract_reward', {
        p_outbox_id: input.outboxId,
        p_now: input.now,
      });
      if (result.error) {
        throw new Error(
          'Failed to settle Grid Contract reward: ' + result.error.message,
        );
      }
      return resultFrom(result.data);
    },
  };
}
