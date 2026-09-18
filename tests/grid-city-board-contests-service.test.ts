import { describe, expect, it, vi } from 'vitest';
import type { GridContestConfig } from '../lib/grid/core/contest-types';
import type { GridContestAttackPort } from '../lib/grid/server/contest-attack-port';
import { launchGridBoardContest } from '../lib/grid/server/contest-board-service';
import type { GridContestSessionPort } from '../lib/grid/server/contest-session-port';
import type { GridEconomyCommandPort } from '../lib/grid/server/economy-port';
import type { GridOfflineDefensePolicyPort } from '../lib/grid/server/offline-defense-port';

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

const now = '2026-09-18T05:45:00.000Z';
const attackerPlayerId = 'player-1';
const sourceTerritoryId = 'source-id';
const targetTerritoryId = 'target-id';
const defenderPlayerId = 'secret-defender';

function ports() {
  const boardPort = {
    resolveTerritoryIds: vi.fn().mockResolvedValue({
      sourceTerritoryId,
      targetTerritoryId,
    }),
  };
  const attackPort: GridContestAttackPort = {
    getAttackContext: vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      cityId: 'city-1',
      attackerPlayerId,
      defenderPlayerId,
      sourceTerritoryId,
      targetTerritoryId,
      targetTerritorySlug: 'target-slug',
    }),
    captureByAutoRetreat: vi.fn(),
  };
  const sessionPort: GridContestSessionPort = {
    startContest: vi.fn().mockResolvedValue({
      contestId: 'contest-1',
      seasonId: 'season-1',
      cityId: 'city-1',
      attackerPlayerId,
      defenderPlayerId,
      sourceTerritoryId,
      targetTerritoryId,
      attackerCommittedInfluence: 30,
      defenderCommittedInfluence: 37,
      status: 'active',
      startedAt: now,
      eventId: 'event-1',
    }),
    withdrawContest: vi.fn(),
  };
  const defensePolicyPort: GridOfflineDefensePolicyPort = {
    getPolicy: vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      playerId: defenderPlayerId,
      policy: {
        doctrineId: 'custom-balanced',
        reserveInfluence: 80,
        maxCommitPerContest: 60,
        defaultCommitBps: 7500,
        autoRetreatBelowInfluence: 5,
        autoRetreatAfterLosses: 0,
        defaultTactic: 'fortify',
        priorityRules: [],
      },
      updatedAt: now,
    }),
    setPolicy: vi.fn(),
  };
  const economyPort: GridEconomyCommandPort = {
    joinSeason: vi.fn(),
    settleResources: vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      cityId: 'city-1',
      playerId: defenderPlayerId,
      credits: 0,
      influence: 50,
      commandPoints: 10,
      commandPointsUpdatedAt: now,
      resourcesSettledAt: now,
      creditsAccrualRemainder: 0,
      influenceAccrualRemainder: 0,
      joined: false,
      eventId: null,
    }),
  };

  return {
    boardPort,
    attackPort,
    sessionPort,
    defensePolicyPort,
    economyPort,
  };
}

describe('Grid City Board contest launch', () => {
  it('resolves slugs to trusted IDs and sanitizes rival identity from the result', async () => {
    const p = ports();

    const result = await launchGridBoardContest(
      p.boardPort,
      p.attackPort,
      p.sessionPort,
      p.defensePolicyPort,
      p.economyPort,
      config,
      {
        attackerPlayerId,
        sourceTerritorySlug: 'source-slug',
        targetTerritorySlug: 'target-slug',
        attackerCommittedInfluence: 30,
        idempotencyKey: 'contest-board-1',
        now,
      },
    );

    expect(p.boardPort.resolveTerritoryIds).toHaveBeenCalledWith(
      'source-slug',
      'target-slug',
    );
    expect(p.attackPort.getAttackContext).toHaveBeenCalledWith({
      attackerPlayerId,
      sourceTerritoryId,
      targetTerritoryId,
    });
    expect(result).toMatchObject({
      outcome: 'contest-started',
      contestId: 'contest-1',
      sourceTerritorySlug: 'source-slug',
      targetTerritorySlug: 'target-slug',
      attackerCommittedInfluence: 30,
      defenderCommittedInfluence: 37,
      status: 'active',
    });
    expect(JSON.stringify(result)).not.toContain(defenderPlayerId);
    expect(JSON.stringify(result)).not.toContain(sourceTerritoryId);
    expect(JSON.stringify(result)).not.toContain(targetTerritoryId);
    expect(JSON.stringify(result)).not.toContain('event-1');
  });

  it('rejects unresolved slug pairs before the contest engine is called', async () => {
    const p = ports();
    p.boardPort.resolveTerritoryIds.mockResolvedValue(null);

    await expect(
      launchGridBoardContest(
        p.boardPort,
        p.attackPort,
        p.sessionPort,
        p.defensePolicyPort,
        p.economyPort,
        config,
        {
          attackerPlayerId,
          sourceTerritorySlug: 'missing-source',
          targetTerritorySlug: 'missing-target',
          attackerCommittedInfluence: 30,
          idempotencyKey: 'contest-board-2',
          now,
        },
      ),
    ).rejects.toThrow('could not resolve attack territories');

    expect(p.attackPort.getAttackContext).not.toHaveBeenCalled();
  });
});
