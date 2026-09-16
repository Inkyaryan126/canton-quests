import { describe, expect, it, vi } from 'vitest';
import type {
  GridContestSessionPort,
  GridStartContestResult,
  GridWithdrawContestResult,
} from '../lib/grid/server/contest-session-port';
import {
  startGridContest,
  withdrawGridContest,
} from '../lib/grid/server/contest-session-service';
import { createSupabaseGridContestSessionPort } from '../lib/grid/server/supabase-contest-session';

const startCommand = {
  seasonId: '10000000-0000-4000-8000-000000000001',
  attackerPlayerId: '10000000-0000-4000-8000-000000000002',
  defenderPlayerId: '10000000-0000-4000-8000-000000000003',
  sourceTerritoryId: '10000000-0000-4000-8000-000000000004',
  targetTerritoryId: '10000000-0000-4000-8000-000000000005',
  attackerCommittedInfluence: 60,
  defenderCommittedInfluence: 40,
  idempotencyKey: 'contest:start:one',
  now: '2026-09-16T06:45:00.000Z',
};

const started: GridStartContestResult = {
  contestId: '10000000-0000-4000-8000-000000000006',
  cityId: '10000000-0000-4000-8000-000000000007',
  ...startCommand,
  status: 'active',
  startedAt: startCommand.now,
  eventId: '10000000-0000-4000-8000-000000000008',
};

const withdrawCommand = {
  contestId: started.contestId,
  attackerPlayerId: startCommand.attackerPlayerId,
  idempotencyKey: 'contest:withdraw:one',
  now: '2026-09-16T06:50:00.000Z',
};

const withdrawn: GridWithdrawContestResult = {
  contestId: started.contestId,
  seasonId: started.seasonId,
  cityId: started.cityId,
  status: 'withdrawn',
  attackerRefundedInfluence: 50,
  defenderRefundedInfluence: 30,
  endedAt: withdrawCommand.now,
  eventId: '10000000-0000-4000-8000-000000000009',
};

describe('Grid contest session services', () => {
  it('validates and forwards contest start commands', async () => {
    const port: GridContestSessionPort = {
      startContest: vi.fn().mockResolvedValue(started),
      withdrawContest: vi.fn(),
    };

    await expect(startGridContest(port, startCommand)).resolves.toEqual(started);
    expect(port.startContest).toHaveBeenCalledWith(startCommand);
  });

  it('rejects invalid contest starts before reaching persistence', async () => {
    const port: GridContestSessionPort = {
      startContest: vi.fn(),
      withdrawContest: vi.fn(),
    };

    await expect(
      startGridContest(port, { ...startCommand, attackerCommittedInfluence: 0 }),
    ).rejects.toThrow('positive integer attackerCommittedInfluence');
    await expect(
      startGridContest(port, {
        ...startCommand,
        defenderPlayerId: startCommand.attackerPlayerId,
      }),
    ).rejects.toThrow('attacker and defender must differ');
    await expect(
      startGridContest(port, { ...startCommand, idempotencyKey: ' ' }),
    ).rejects.toThrow('non-empty idempotency key');

    expect(port.startContest).not.toHaveBeenCalled();
  });

  it('validates and forwards attacker withdrawal', async () => {
    const port: GridContestSessionPort = {
      startContest: vi.fn(),
      withdrawContest: vi.fn().mockResolvedValue(withdrawn),
    };

    await expect(withdrawGridContest(port, withdrawCommand)).resolves.toEqual(withdrawn);
    expect(port.withdrawContest).toHaveBeenCalledWith(withdrawCommand);
  });
});

describe('Supabase Grid contest session adapter', () => {
  it('requires service-role configuration', () => {
    expect(() => createSupabaseGridContestSessionPort(null as any)).toThrow(
      'Grid contest sessions require Supabase service-role configuration',
    );
  });

  it('calls the atomic start and withdraw RPCs only', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: started, error: null })
      .mockResolvedValueOnce({ data: withdrawn, error: null });
    const port = createSupabaseGridContestSessionPort({ rpc } as any);

    await expect(port.startContest(startCommand)).resolves.toEqual(started);
    await expect(port.withdrawContest(withdrawCommand)).resolves.toEqual(withdrawn);

    expect(rpc).toHaveBeenNthCalledWith(1, 'grid_start_contest', {
      p_season_id: startCommand.seasonId,
      p_attacker_player_id: startCommand.attackerPlayerId,
      p_defender_player_id: startCommand.defenderPlayerId,
      p_source_territory_id: startCommand.sourceTerritoryId,
      p_target_territory_id: startCommand.targetTerritoryId,
      p_attacker_committed_influence: 60,
      p_defender_committed_influence: 40,
      p_idempotency_key: startCommand.idempotencyKey,
      p_now: startCommand.now,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'grid_withdraw_contest', {
      p_contest_id: withdrawCommand.contestId,
      p_attacker_player_id: withdrawCommand.attackerPlayerId,
      p_idempotency_key: withdrawCommand.idempotencyKey,
      p_now: withdrawCommand.now,
    });
  });
});
