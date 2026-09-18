import { describe, expect, it, vi } from 'vitest';
import type {
  GridPveStrongholdReadContext,
  GridPveStrongholdReadPort,
} from '../lib/grid/server/pve-stronghold-read-port';
import {
  getGridPveStrongholdContestForPlayer,
  GridPveStrongholdReadError,
  listGridPveStrongholdContestsForPlayer,
} from '../lib/grid/server/pve-stronghold-read-service';

function row(overrides: Partial<GridPveStrongholdReadContext> = {}): GridPveStrongholdReadContext {
  return {
    contestId: 'contest-1',
    attackerPlayerId: 'player-1',
    strongholdId: 'fort-1',
    factionId: 'wardens',
    sourceTerritorySlug: 'source',
    targetTerritorySlug: 'target',
    objectiveKind: 'pve-territory',
    landmarkSlug: null,
    attackerCommittedInfluence: 70,
    garrisonCommittedInfluence: 60,
    attackerRemainingInfluence: 50,
    garrisonRemainingInfluence: 40,
    roundNumber: 2,
    status: 'active',
    startedAt: '2026-09-18T07:00:00.000Z',
    endedAt: null,
    ...overrides,
  };
}

function port(rows: GridPveStrongholdReadContext[] = [row()]): GridPveStrongholdReadPort {
  return {
    listActiveForPlayer: vi.fn().mockResolvedValue(rows),
    getById: vi.fn().mockImplementation(async (contestId: string) =>
      rows.find((candidate) => candidate.contestId === contestId) ?? null),
  };
}

describe('Grid PvE stronghold read service', () => {
  it('returns only the sanitized active contest view for the authenticated player', async () => {
    const p = port();
    await expect(listGridPveStrongholdContestsForPlayer(p, 'player-1')).resolves.toEqual([{
      contestId: 'contest-1',
      strongholdId: 'fort-1',
      factionId: 'wardens',
      sourceTerritorySlug: 'source',
      targetTerritorySlug: 'target',
      objectiveKind: 'pve-territory',
      landmarkSlug: null,
      attackerCommittedInfluence: 70,
      garrisonCommittedInfluence: 60,
      attackerRemainingInfluence: 50,
      garrisonRemainingInfluence: 40,
      roundNumber: 2,
      status: 'active',
      startedAt: '2026-09-18T07:00:00.000Z',
      endedAt: null,
    }]);
    expect(p.listActiveForPlayer).toHaveBeenCalledWith('player-1');
  });

  it('sorts active contests newest first with deterministic id tie-breaks', async () => {
    const rows = [
      row({ contestId: 'b', startedAt: '2026-09-18T07:00:00.000Z' }),
      row({ contestId: 'c', startedAt: '2026-09-18T08:00:00.000Z' }),
      row({ contestId: 'a', startedAt: '2026-09-18T07:00:00.000Z' }),
    ];
    const result = await listGridPveStrongholdContestsForPlayer(port(rows), 'player-1');
    expect(result.map((contest) => contest.contestId)).toEqual(['c', 'a', 'b']);
  });

  it('fails closed if the adapter returns another player or a resolved contest in active discovery', async () => {
    await expect(listGridPveStrongholdContestsForPlayer(
      port([row({ attackerPlayerId: 'player-2' })]), 'player-1',
    )).rejects.toThrow('another player contest');
    await expect(listGridPveStrongholdContestsForPlayer(
      port([row({ status: 'captured', endedAt: '2026-09-18T08:00:00.000Z' })]), 'player-1',
    )).rejects.toThrow('resolved contest');
  });

  it('returns contest detail only to its attacker', async () => {
    await expect(getGridPveStrongholdContestForPlayer(port(), {
      contestId: 'contest-1', viewerPlayerId: 'player-1',
    })).resolves.toMatchObject({ contestId: 'contest-1', status: 'active' });
  });

  it('uses the same not-found result for missing and other-player contest ids', async () => {
    for (const p of [
      port([]),
      port([row({ attackerPlayerId: 'player-2' })]),
    ]) {
      await expect(getGridPveStrongholdContestForPlayer(p, {
        contestId: 'contest-1', viewerPlayerId: 'player-1',
      })).rejects.toMatchObject<GridPveStrongholdReadError>({
        code: 'NOT_FOUND',
        message: 'Grid PvE stronghold contest was not found',
      });
    }
  });

  it('validates blank ids before persistence reads', async () => {
    const p = port();
    await expect(listGridPveStrongholdContestsForPlayer(p, ' ')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(getGridPveStrongholdContestForPlayer(p, {
      contestId: ' ', viewerPlayerId: 'player-1',
    })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(p.listActiveForPlayer).not.toHaveBeenCalled();
    expect(p.getById).not.toHaveBeenCalled();
  });
});
