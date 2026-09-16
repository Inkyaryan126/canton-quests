import { describe, expect, it, vi } from 'vitest';
import type { GridContestConfig } from '../lib/grid/core/contest-types';
import type { GridOfflineDefensePolicyPort } from '../lib/grid/server/offline-defense-port';
import type { GridEconomyCommandPort, GridPlayerSeasonState } from '../lib/grid/server/economy-port';
import type { GridContestSessionPort, GridStartContestResult } from '../lib/grid/server/contest-session-port';
import type { GridContestAttackPort, GridContestAutoRetreatResult } from '../lib/grid/server/contest-attack-port';
import { launchGridContestAttack } from '../lib/grid/server/contest-attack-service';

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
  attackerPlayerId: '50000000-0000-4000-8000-000000000001',
  sourceTerritoryId: '50000000-0000-4000-8000-000000000002',
  targetTerritoryId: '50000000-0000-4000-8000-000000000003',
  attackerCommittedInfluence: 60,
  idempotencyKey: 'attack:one',
  now: '2026-09-16T08:30:00.000Z',
};

const context = {
  seasonId: '50000000-0000-4000-8000-000000000004',
  cityId: '50000000-0000-4000-8000-000000000005',
  attackerPlayerId: request.attackerPlayerId,
  defenderPlayerId: '50000000-0000-4000-8000-000000000006',
  sourceTerritoryId: request.sourceTerritoryId,
  targetTerritoryId: request.targetTerritoryId,
  targetTerritorySlug: 'target-block',
};

function settled(influence: number): GridPlayerSeasonState {
  return {
    seasonId: context.seasonId,
    cityId: context.cityId,
    playerId: context.defenderPlayerId,
    credits: 0,
    influence,
    commandPoints: 10,
    commandPointsUpdatedAt: request.now,
    resourcesSettledAt: request.now,
    creditsAccrualRemainder: 0,
    influenceAccrualRemainder: 0,
    joined: false,
    eventId: null,
  };
}

function ports(options: { influence: number; savedPolicy?: any }) {
  const attackPort: GridContestAttackPort = {
    getAttackContext: vi.fn().mockResolvedValue(context),
    captureByAutoRetreat: vi.fn(),
  };
  const sessionPort: GridContestSessionPort = {
    startContest: vi.fn(),
    withdrawContest: vi.fn(),
  };
  const defensePolicyPort: GridOfflineDefensePolicyPort = {
    getPolicy: vi.fn().mockResolvedValue(
      options.savedPolicy
        ? {
            seasonId: context.seasonId,
            playerId: context.defenderPlayerId,
            policy: options.savedPolicy,
            updatedAt: request.now,
          }
        : null,
    ),
    setPolicy: vi.fn(),
  };
  const economyPort: GridEconomyCommandPort = {
    joinSeason: vi.fn(),
    settleResources: vi.fn().mockResolvedValue(settled(options.influence)),
  };
  return { attackPort, sessionPort, defensePolicyPort, economyPort };
}

describe('launchGridContestAttack', () => {
  it('settles defender strength then starts a contest using saved doctrine commitment', async () => {
    const p = ports({
      influence: 50,
      savedPolicy: {
        doctrineId: 'custom-balanced',
        reserveInfluence: 80,
        maxCommitPerContest: 60,
        defaultCommitBps: 7500,
        autoRetreatBelowInfluence: 5,
        autoRetreatAfterLosses: 0,
        defaultTactic: 'fortify',
        priorityRules: [],
      },
    });

    const contest: GridStartContestResult = {
      contestId: '50000000-0000-4000-8000-000000000007',
      seasonId: context.seasonId,
      cityId: context.cityId,
      attackerPlayerId: request.attackerPlayerId,
      defenderPlayerId: context.defenderPlayerId,
      sourceTerritoryId: request.sourceTerritoryId,
      targetTerritoryId: request.targetTerritoryId,
      attackerCommittedInfluence: 60,
      defenderCommittedInfluence: 37,
      status: 'active',
      startedAt: request.now,
      eventId: '50000000-0000-4000-8000-000000000008',
    };
    vi.mocked(p.sessionPort.startContest).mockResolvedValue(contest);

    await expect(
      launchGridContestAttack(
        p.attackPort,
        p.sessionPort,
        p.defensePolicyPort,
        p.economyPort,
        config,
        request,
      ),
    ).resolves.toEqual({ outcome: 'contest-started', contest });

    expect(p.economyPort.settleResources).toHaveBeenCalledWith({
      seasonId: context.seasonId,
      playerId: context.defenderPlayerId,
      idempotencyKey: 'preattack:defender:attack:one',
      now: request.now,
    });
    expect(p.sessionPort.startContest).toHaveBeenCalledWith(
      expect.objectContaining({
        defenderPlayerId: context.defenderPlayerId,
        defenderCommittedInfluence: 37,
      }),
    );
  });

  it('uses the safe default doctrine and auto-captures when defender strength is below viable reserve', async () => {
    const p = ports({ influence: 8 });
    const capture: GridContestAutoRetreatResult = {
      seasonId: context.seasonId,
      cityId: context.cityId,
      attackerPlayerId: request.attackerPlayerId,
      defenderPlayerId: context.defenderPlayerId,
      sourceTerritoryId: request.sourceTerritoryId,
      targetTerritoryId: request.targetTerritoryId,
      capturedAt: request.now,
      eventId: '50000000-0000-4000-8000-000000000009',
    };
    vi.mocked(p.attackPort.captureByAutoRetreat).mockResolvedValue(capture);

    await expect(
      launchGridContestAttack(
        p.attackPort,
        p.sessionPort,
        p.defensePolicyPort,
        p.economyPort,
        config,
        request,
      ),
    ).resolves.toEqual({ outcome: 'captured-by-auto-retreat', capture });

    expect(p.attackPort.captureByAutoRetreat).toHaveBeenCalledWith(
      expect.objectContaining({
        defenderPlayerId: context.defenderPlayerId,
        defenseDoctrineId: 'balanced-default-v1',
        defenseReason: 'retreat-threshold',
        defenseTactic: 'fortify',
      }),
    );
    expect(p.sessionPort.startContest).not.toHaveBeenCalled();
  });

  it('rejects malformed attacks before reading any game state', async () => {
    const p = ports({ influence: 100 });

    await expect(
      launchGridContestAttack(
        p.attackPort,
        p.sessionPort,
        p.defensePolicyPort,
        p.economyPort,
        config,
        { ...request, attackerCommittedInfluence: 0 },
      ),
    ).rejects.toThrow('positive integer attackerCommittedInfluence');

    expect(p.attackPort.getAttackContext).not.toHaveBeenCalled();
    expect(p.economyPort.settleResources).not.toHaveBeenCalled();
  });
});
