import { describe, expect, it, vi } from 'vitest';
import type { GridContestConfig } from '../lib/grid/core/contest-types';
import type { GridSignalDiceRoller } from '../lib/grid/server/contest-service';
import type { GridPveStrongholdSessionPort } from '../lib/grid/server/pve-stronghold-session-port';
import {
  launchGridPveStrongholdSession,
  resolveGridPveStrongholdSessionRound,
} from '../lib/grid/server/pve-stronghold-session-service';

const now = '2026-09-18T06:50:00.000Z';
const config: GridContestConfig = {
  dieSides: 6,
  influenceLossPerComparison: 10,
  tiesFavorDefender: true,
  attacker: {
    maxDice: 3,
    bands: [
      { minCommittedInfluence: 1, dice: 1 },
      { minCommittedInfluence: 30, dice: 2 },
      { minCommittedInfluence: 60, dice: 3 },
    ],
  },
  defender: {
    maxDice: 2,
    bands: [
      { minCommittedInfluence: 1, dice: 1 },
      { minCommittedInfluence: 30, dice: 2 },
    ],
  },
};

function port(): GridPveStrongholdSessionPort {
  return {
    getStartContext: vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      cityId: 'city-1',
      attackerPlayerId: 'player-1',
      sourceTerritoryId: 'source-1',
      sourceTerritorySlug: 'source-slug',
      targetTerritoryId: 'target-1',
      stronghold: {
        strongholdId: 'stronghold-1',
        status: 'active',
        activationReason: 'season',
        contestable: true,
        baseGarrisonInfluence: 40,
        reinforcementInfluence: 20,
        garrisonInfluence: 60,
        objective: {
          kind: 'pve-landmark',
          factionId: 'ash-wardens',
          territorySlug: 'target-slug',
          landmarkSlug: 'landmark-1',
        },
      },
    }),
    startContest: vi.fn().mockResolvedValue({
      contestId: 'contest-1',
      seasonId: 'season-1',
      cityId: 'city-1',
      strongholdId: 'stronghold-1',
      factionId: 'ash-wardens',
      attackerPlayerId: 'player-1',
      sourceTerritoryId: 'source-1',
      targetTerritoryId: 'target-1',
      status: 'active',
      attackerCommittedInfluence: 70,
      garrisonCommittedInfluence: 60,
      startedAt: now,
      eventId: 'event-start',
    }),
    getRoundContext: vi.fn().mockResolvedValue({
      contestId: 'contest-1',
      attackerPlayerId: 'player-1',
      status: 'active',
      attackerRemainingInfluence: 70,
      garrisonRemainingInfluence: 60,
    }),
    resolveRound: vi.fn().mockResolvedValue({
      contestId: 'contest-1',
      seasonId: 'season-1',
      cityId: 'city-1',
      strongholdId: 'stronghold-1',
      roundNumber: 1,
      status: 'active',
      attackerRolls: [6, 5, 4],
      garrisonRolls: [3, 2],
      attackerInfluenceLost: 0,
      garrisonInfluenceLost: 20,
      attackerRemainingInfluence: 70,
      garrisonRemainingInfluence: 40,
      attackerRefundedInfluence: 0,
      territoryCaptured: false,
      eventId: 'event-round',
    }),
  };
}

function roller(values: number[]): GridSignalDiceRoller {
  let index = 0;
  return { roll: vi.fn(() => values[index++] ?? 1) };
}

describe('Grid PvE stronghold session service', () => {
  it('resolves stronghold/garrison from the trusted port before starting persistence', async () => {
    const p = port();
    await launchGridPveStrongholdSession(p, {
      attackerPlayerId: 'player-1',
      sourceTerritorySlug: 'source-slug',
      strongholdId: 'stronghold-1',
      attackerCommittedInfluence: 70,
      idempotencyKey: 'pve:start:1',
      now,
    });

    expect(p.getStartContext).toHaveBeenCalledWith({
      attackerPlayerId: 'player-1',
      sourceTerritorySlug: 'source-slug',
      strongholdId: 'stronghold-1',
      now,
    });
    expect(p.startContest).toHaveBeenCalledWith({
      seasonId: 'season-1',
      cityId: 'city-1',
      strongholdId: 'stronghold-1',
      factionId: 'ash-wardens',
      attackerPlayerId: 'player-1',
      sourceTerritoryId: 'source-1',
      targetTerritoryId: 'target-1',
      objectiveKind: 'pve-landmark',
      landmarkSlug: 'landmark-1',
      attackerCommittedInfluence: 70,
      garrisonCommittedInfluence: 60,
      idempotencyKey: 'pve:start:1',
      now,
    });
  });

  it('rejects a trusted-context identity mismatch instead of persisting it', async () => {
    const p = port();
    vi.mocked(p.getStartContext).mockResolvedValueOnce({
      ...(await p.getStartContext({
        attackerPlayerId: 'player-1', sourceTerritorySlug: 'source-slug', strongholdId: 'stronghold-1', now,
      })),
      attackerPlayerId: 'different-player',
    });

    await expect(launchGridPveStrongholdSession(p, {
      attackerPlayerId: 'player-1', sourceTerritorySlug: 'source-slug', strongholdId: 'stronghold-1',
      attackerCommittedInfluence: 70, idempotencyKey: 'pve:start:1', now,
    })).rejects.toThrow('context identity mismatch');
    expect(p.startContest).not.toHaveBeenCalled();
  });

  it('generates all round dice on the server from persisted remaining Influence', async () => {
    const p = port();
    const r = roller([6, 5, 4, 3, 2]);
    await resolveGridPveStrongholdSessionRound(p, r, config, {
      contestId: 'contest-1', attackerPlayerId: 'player-1', idempotencyKey: 'pve:round:1', now,
    });

    expect(r.roll).toHaveBeenCalledTimes(5);
    expect(p.resolveRound).toHaveBeenCalledWith({
      contestId: 'contest-1',
      attackerPlayerId: 'player-1',
      attackerRolls: [6, 5, 4],
      garrisonRolls: [3, 2],
      idempotencyKey: 'pve:round:1',
      now,
    });
  });

  it('rejects non-attackers and resolved sessions before rolling dice', async () => {
    const p = port();
    const r = roller([6]);
    vi.mocked(p.getRoundContext).mockResolvedValueOnce({
      contestId: 'contest-1', attackerPlayerId: 'other-player', status: 'active',
      attackerRemainingInfluence: 70, garrisonRemainingInfluence: 60,
    });
    await expect(resolveGridPveStrongholdSessionRound(p, r, config, {
      contestId: 'contest-1', attackerPlayerId: 'player-1', idempotencyKey: 'round', now,
    })).rejects.toThrow('requires the contest attacker');
    expect(r.roll).not.toHaveBeenCalled();

    vi.mocked(p.getRoundContext).mockResolvedValueOnce({
      contestId: 'contest-1', attackerPlayerId: 'player-1', status: 'captured',
      attackerRemainingInfluence: 20, garrisonRemainingInfluence: 0,
    });
    await expect(resolveGridPveStrongholdSessionRound(p, r, config, {
      contestId: 'contest-1', attackerPlayerId: 'player-1', idempotencyKey: 'round', now,
    })).rejects.toThrow('requires an active contest');
    expect(r.roll).not.toHaveBeenCalled();
  });

  it('rejects invalid server roller output before persistence', async () => {
    const p = port();
    await expect(resolveGridPveStrongholdSessionRound(p, roller([7]), config, {
      contestId: 'contest-1', attackerPlayerId: 'player-1', idempotencyKey: 'round', now,
    })).rejects.toThrow('invalid d6 result');
    expect(p.resolveRound).not.toHaveBeenCalled();
  });

  it('validates start input before trusted context reads', async () => {
    const p = port();
    await expect(launchGridPveStrongholdSession(p, {
      attackerPlayerId: ' ', sourceTerritorySlug: 'source-slug', strongholdId: 'stronghold-1',
      attackerCommittedInfluence: 70, idempotencyKey: 'pve:start:1', now,
    })).rejects.toThrow('attackerPlayerId');
    expect(p.getStartContext).not.toHaveBeenCalled();
  });
});
