import { describe, expect, it, vi } from 'vitest';
import type { GridContestConfig } from '../lib/grid/core/contest-types';
import type {
  GridContestRoundCommandResult,
  GridContestRoundPort,
} from '../lib/grid/server/contest-port';
import {
  resolveGridContestRound,
  type GridSignalDiceRoller,
} from '../lib/grid/server/contest-service';
import { createSupabaseGridContestRoundPort } from '../lib/grid/server/supabase-contest';

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
  seasonId: '00000000-0000-4000-8000-000000000001',
  attackerPlayerId: '00000000-0000-4000-8000-000000000002',
  defenderPlayerId: '00000000-0000-4000-8000-000000000003',
  sourceTerritoryId: '00000000-0000-4000-8000-000000000004',
  targetTerritoryId: '00000000-0000-4000-8000-000000000005',
  attackerCommittedInfluence: 60,
  defenderCommittedInfluence: 40,
  idempotencyKey: 'contest:round:one',
  now: '2026-09-16T04:45:00.000Z',
};

const result: GridContestRoundCommandResult = {
  ...request,
  cityId: '00000000-0000-4000-8000-000000000006',
  attackerRolls: [6, 5, 4],
  defenderRolls: [3, 2],
  comparisons: [
    { attackerRoll: 6, defenderRoll: 3, winner: 'attacker' },
    { attackerRoll: 5, defenderRoll: 2, winner: 'attacker' },
  ],
  attackerInfluenceLost: 0,
  defenderInfluenceLost: 20,
  attackerRemainingInfluence: 60,
  defenderRemainingInfluence: 20,
  eventId: '00000000-0000-4000-8000-000000000007',
};

function queuedRoller(values: number[]): GridSignalDiceRoller {
  let index = 0;
  return {
    roll: vi.fn(() => values[index++]),
  };
}

describe('resolveGridContestRound', () => {
  it('generates the allowed Signal Dice on the trusted server before forwarding', async () => {
    const port: GridContestRoundPort = {
      resolveRound: vi.fn().mockResolvedValue(result),
    };
    const roller = queuedRoller([6, 5, 4, 3, 2]);

    await expect(resolveGridContestRound(port, roller, config, request)).resolves.toEqual(result);
    expect(port.resolveRound).toHaveBeenCalledWith({
      ...request,
      attackerRolls: [6, 5, 4],
      defenderRolls: [3, 2],
    });
    expect(roller.roll).toHaveBeenCalledTimes(5);
  });

  it('rejects malformed requests before rolling or reaching persistence', async () => {
    const port: GridContestRoundPort = { resolveRound: vi.fn() };
    const roller = queuedRoller([6]);

    await expect(
      resolveGridContestRound(port, roller, config, { ...request, idempotencyKey: ' ' }),
    ).rejects.toThrow('non-empty idempotency key');
    await expect(
      resolveGridContestRound(port, roller, config, {
        ...request,
        attackerCommittedInfluence: 0,
      }),
    ).rejects.toThrow('positive integer attackerCommittedInfluence');
    await expect(
      resolveGridContestRound(port, roller, config, {
        ...request,
        attackerPlayerId: request.defenderPlayerId,
      }),
    ).rejects.toThrow('attacker and defender must differ');

    expect(roller.roll).not.toHaveBeenCalled();
    expect(port.resolveRound).not.toHaveBeenCalled();
  });

  it('rejects a broken trusted roller instead of persisting invalid dice', async () => {
    const port: GridContestRoundPort = { resolveRound: vi.fn() };
    const roller = queuedRoller([7]);

    await expect(resolveGridContestRound(port, roller, config, request)).rejects.toThrow(
      'invalid d6 result: 7',
    );
    expect(port.resolveRound).not.toHaveBeenCalled();
  });
});

describe('Supabase Grid contest adapter', () => {
  it('requires service-role Supabase configuration', () => {
    expect(() => createSupabaseGridContestRoundPort(null as any)).toThrow(
      'Grid contest commands require Supabase service-role configuration',
    );
  });

  it('calls only the atomic contest RPC with server-generated rolls', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
    const port = createSupabaseGridContestRoundPort({ rpc } as any);
    const command = {
      ...request,
      attackerRolls: [6, 5, 4],
      defenderRolls: [3, 2],
    };

    await expect(port.resolveRound(command)).resolves.toEqual(result);
    expect(rpc).toHaveBeenCalledWith('grid_resolve_contest_round', {
      p_season_id: request.seasonId,
      p_attacker_player_id: request.attackerPlayerId,
      p_defender_player_id: request.defenderPlayerId,
      p_source_territory_id: request.sourceTerritoryId,
      p_target_territory_id: request.targetTerritoryId,
      p_attacker_committed_influence: 60,
      p_defender_committed_influence: 40,
      p_attacker_rolls: [6, 5, 4],
      p_defender_rolls: [3, 2],
      p_idempotency_key: request.idempotencyKey,
      p_now: request.now,
    });
  });
});
