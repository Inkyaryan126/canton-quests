import { describe, expect, it, vi } from 'vitest';
import type { GridContestConfig } from '../lib/grid/core/contest-types';
import type {
  GridContestSessionRoundPort,
  GridContestSessionRoundResult,
} from '../lib/grid/server/contest-session-round-port';
import { resolveGridContestSessionRound } from '../lib/grid/server/contest-session-round-service';
import { createSupabaseGridContestSessionRoundPort } from '../lib/grid/server/supabase-contest-session-round';

const config: GridContestConfig = {
  dieSides: 6,
  influenceLossPerComparison: 10,
  tiesFavorDefender: true,
  attacker: {
    maxDice: 3,
    bands: [
      { minCommittedInfluence: 10, dice: 1 },
      { minCommittedInfluence: 30, dice: 2 },
      { minCommittedInfluence: 60, dice: 3 },
    ],
  },
  defender: {
    maxDice: 2,
    bands: [
      { minCommittedInfluence: 10, dice: 1 },
      { minCommittedInfluence: 40, dice: 2 },
    ],
  },
};

const request = {
  contestId: '30000000-0000-4000-8000-000000000001',
  attackerPlayerId: '30000000-0000-4000-8000-000000000002',
  idempotencyKey: 'session:round:2',
  now: '2026-09-16T07:05:00.000Z',
};

const context = {
  contestId: request.contestId,
  seasonId: '30000000-0000-4000-8000-000000000003',
  attackerPlayerId: request.attackerPlayerId,
  attackerRemainingInfluence: 50,
  defenderRemainingInfluence: 30,
  status: 'active' as const,
};

const result: GridContestSessionRoundResult = {
  contestId: request.contestId,
  seasonId: context.seasonId,
  cityId: '30000000-0000-4000-8000-000000000004',
  roundNumber: 2,
  status: 'active',
  attackerRolls: [6, 4],
  defenderRolls: [5],
  comparisons: [{ attackerRoll: 6, defenderRoll: 5, winner: 'attacker' }],
  attackerInfluenceLost: 0,
  defenderInfluenceLost: 10,
  attackerRemainingInfluence: 50,
  defenderRemainingInfluence: 20,
  attackerRefundedInfluence: 0,
  defenderRefundedInfluence: 0,
  territoryCaptured: false,
  eventId: '30000000-0000-4000-8000-000000000005',
};

function roller(values: number[]) {
  let index = 0;
  return { roll: vi.fn(() => values[index++]) };
}

describe('resolveGridContestSessionRound', () => {
  it('uses current remaining reserve to determine Signal Dice', async () => {
    const port: GridContestSessionRoundPort = {
      getRoundContext: vi.fn().mockResolvedValue(context),
      resolveRound: vi.fn().mockResolvedValue(result),
    };
    const dice = roller([6, 4, 5]);

    await expect(
      resolveGridContestSessionRound(port, dice, config, request),
    ).resolves.toEqual(result);

    expect(port.resolveRound).toHaveBeenCalledWith({
      ...request,
      attackerRolls: [6, 4],
      defenderRolls: [5],
    });
    expect(dice.roll).toHaveBeenCalledTimes(3);
  });

  it('rejects inactive or wrong-attacker sessions before rolling', async () => {
    const dice = roller([6]);
    const inactive: GridContestSessionRoundPort = {
      getRoundContext: vi.fn().mockResolvedValue({ ...context, status: 'withdrawn' }),
      resolveRound: vi.fn(),
    };
    await expect(
      resolveGridContestSessionRound(inactive, dice, config, request),
    ).rejects.toThrow('active contest');

    const wrong: GridContestSessionRoundPort = {
      getRoundContext: vi.fn().mockResolvedValue({
        ...context,
        attackerPlayerId: 'other-player',
      }),
      resolveRound: vi.fn(),
    };
    await expect(
      resolveGridContestSessionRound(wrong, dice, config, request),
    ).rejects.toThrow('contest attacker');

    expect(dice.roll).not.toHaveBeenCalled();
  });

  it('rejects sessions whose remaining reserve can no longer unlock dice', async () => {
    const port: GridContestSessionRoundPort = {
      getRoundContext: vi.fn().mockResolvedValue({
        ...context,
        attackerRemainingInfluence: 9,
      }),
      resolveRound: vi.fn(),
    };

    await expect(
      resolveGridContestSessionRound(port, roller([6]), config, request),
    ).rejects.toThrow('attacker no longer has enough Influence');
  });
});

describe('Supabase persistent contest round adapter', () => {
  it('requires service-role configuration', () => {
    expect(() => createSupabaseGridContestSessionRoundPort(null as any)).toThrow(
      'Grid contest session rounds require Supabase service-role configuration',
    );
  });

  it('reads current reserve then calls only the atomic round RPC', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: context.contestId,
        season_id: context.seasonId,
        attacker_player_id: context.attackerPlayerId,
        attacker_remaining_influence: 50,
        defender_remaining_influence: 30,
        status: 'active',
      },
      error: null,
    });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
    const port = createSupabaseGridContestSessionRoundPort({ from, rpc } as any);

    await expect(port.getRoundContext(context.contestId)).resolves.toEqual(context);
    await expect(
      port.resolveRound({
        ...request,
        attackerRolls: [6, 4],
        defenderRolls: [5],
      }),
    ).resolves.toEqual(result);

    expect(from).toHaveBeenCalledWith('grid_contests');
    expect(rpc).toHaveBeenCalledWith('grid_resolve_contest_session_round', {
      p_contest_id: request.contestId,
      p_attacker_player_id: request.attackerPlayerId,
      p_attacker_rolls: [6, 4],
      p_defender_rolls: [5],
      p_idempotency_key: request.idempotencyKey,
      p_now: request.now,
    });
  });
});
