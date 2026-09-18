import { describe, expect, it } from 'vitest';
import { createSupabaseGridContractPersistence } from '../lib/grid/server/supabase-contract-persistence';

const scope = {
  cityId: 'city-1',
  seasonId: 'season-1',
  playerId: 'player-1',
  contractId: 'contract-1',
};

describe('Grid contract Supabase persistence boundary', () => {
  it('uses one server-authoritative RPC and does not send reward or completion claims', async () => {
    const rpc = async (name: string, args: Record<string, unknown>) => {
      expect(name).toBe('grid_commit_contract_progress');
      expect(args).toMatchObject({
        p_city_id: scope.cityId,
        p_season_id: scope.seasonId,
        p_player_id: scope.playerId,
        p_contract_id: scope.contractId,
        p_objective_id: 'objective-1',
        p_amount: 1,
        p_now_ms: 2_000,
        p_idempotency_key: 'event-1',
        p_expected_version: 3,
      });
      expect(args).not.toHaveProperty('p_reward_intent');
      expect(args).not.toHaveProperty('p_completed');
      return {
        data: {
          outcome: 'applied',
          stored: {
            instance: {
              contractId: scope.contractId,
              playerId: scope.playerId,
              status: 'completed',
              acceptedAtMs: 1_000,
              expiresAtMs: null,
              completedAtMs: 2_000,
              locationEnhanced: true,
              progress: { 'objective-1': 1 },
            },
            version: 4,
          },
        },
        error: null,
      };
    };

    const port = createSupabaseGridContractPersistence({ rpc } as never);
    const result = await port.commit({
      ...scope,
      objectiveId: 'objective-1',
      amount: 1,
      nowMs: 2_000,
      locationEnhanced: true,
      idempotencyKey: 'event-1',
      expectedVersion: 3,
      nextInstance: {} as never,
      rewardIntent: { credits: 999, influence: 999, commandPoints: 999 },
      locationBonusIntent: { credits: 999, influence: 999, commandPoints: 999 },
    });

    expect(result.outcome).toBe('applied');
    expect(result.stored.version).toBe(4);
  });

  it('rejects a missing service-role client and propagates atomic RPC failures', async () => {
    expect(() => createSupabaseGridContractPersistence(null)).toThrow(/service-role/i);

    const port = createSupabaseGridContractPersistence({
      rpc: async () => ({ data: null, error: { message: 'CONTRACT_REWARD_OUTBOX_FAILED' } }),
    } as never);

    await expect(port.commit({
      ...scope,
      objectiveId: 'objective-1',
      amount: 1,
      nowMs: 2_000,
      idempotencyKey: 'event-1',
      expectedVersion: 3,
      nextInstance: {} as never,
      rewardIntent: null,
      locationBonusIntent: null,
    })).rejects.toThrow(/CONTRACT_REWARD_OUTBOX_FAILED/);
  });
});
