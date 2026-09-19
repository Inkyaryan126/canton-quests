import { describe, expect, it, vi } from 'vitest';
import type { GridContractRewardSettlementPort } from '../lib/grid/server/contract-reward-settlement-port';
import { settlePendingGridContractRewards } from '../lib/grid/server/contract-reward-settlement-service';

const now = '2026-09-19T04:00:00.000Z';

function result(
  outboxId: string,
  outcome: 'applied' | 'duplicate' = 'applied',
) {
  return {
    outboxId,
    seasonId: 'season-1',
    playerId: 'player-1',
    contractId: 'contract-1',
    rewardKind: 'contract' as const,
    outcome,
    creditsGranted: outcome === 'applied' ? 100 : 0,
    influenceGranted: outcome === 'applied' ? 5 : 0,
    commandPointsGranted: outcome === 'applied' ? 1 : 0,
    credits: 500,
    influence: 25,
    commandPoints: 8,
    processedAt: now,
    eventId: 'event-' + outboxId,
  };
}

function port(): GridContractRewardSettlementPort {
  return {
    listPendingRewardIds: vi
      .fn()
      .mockResolvedValue(['outbox-1', 'outbox-2', 'outbox-3']),
    settleReward: vi
      .fn()
      .mockResolvedValueOnce(result('outbox-1'))
      .mockResolvedValueOnce(result('outbox-2', 'duplicate'))
      .mockRejectedValueOnce(new Error('BROKEN_REWARD')),
  };
}

describe('Grid Contract reward settlement batch', () => {
  it('settles a bounded pending batch and keeps failures isolated', async () => {
    const source = port();
    const batch = await settlePendingGridContractRewards(source, {
      now,
      limit: 25,
    });

    expect(source.listPendingRewardIds).toHaveBeenCalledWith(25);
    expect(source.settleReward).toHaveBeenNthCalledWith(1, {
      outboxId: 'outbox-1',
      now,
    });
    expect(source.settleReward).toHaveBeenNthCalledWith(2, {
      outboxId: 'outbox-2',
      now,
    });
    expect(source.settleReward).toHaveBeenNthCalledWith(3, {
      outboxId: 'outbox-3',
      now,
    });
    expect(batch).toMatchObject({
      discovered: 3,
      applied: 1,
      duplicates: 1,
      failed: 1,
    });
    expect(batch.failures).toEqual([
      { outboxId: 'outbox-3', error: 'BROKEN_REWARD' },
    ]);
    expect(batch.results).toHaveLength(2);
  });

  it('uses one server timestamp for every reward in the batch', async () => {
    const source = port();
    await settlePendingGridContractRewards(source, { now });

    for (const call of vi.mocked(source.settleReward).mock.calls) {
      expect(call[0].now).toBe(now);
    }
  });

  it('fails before discovery for invalid limits or time', async () => {
    const source = port();

    await expect(
      settlePendingGridContractRewards(source, { now, limit: 101 }),
    ).rejects.toThrow('between 1 and 100');
    await expect(
      settlePendingGridContractRewards(source, { now: 'not-a-time' }),
    ).rejects.toThrow('valid now timestamp');

    expect(source.listPendingRewardIds).not.toHaveBeenCalled();
  });

  it('does not attempt to settle an empty discovered identifier', async () => {
    const source = port();
    vi.mocked(source.listPendingRewardIds).mockResolvedValue(['']);

    const batch = await settlePendingGridContractRewards(source, { now });

    expect(source.settleReward).not.toHaveBeenCalled();
    expect(batch.failed).toBe(1);
    expect(batch.applied).toBe(0);
  });
});
