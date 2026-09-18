import { describe, expect, it, vi } from 'vitest';
import { cantonFoundingSeasonPackage as pkg } from '../lib/grid/cities/canton/founding-season';
import type { GridEventLedgerPort } from '../lib/grid/server/event-ledger-port';
import {
  completeGridOnboardingTutorialContest,
} from '../lib/grid/server/onboarding-tutorial-contest-service';
import type { GridSignalDiceRoller } from '../lib/grid/server/contest-service';

const playerId = 'player-1';
const now = '2026-09-18T05:00:00.000Z';

function queuedRoller(values: number[]): GridSignalDiceRoller {
  let index = 0;
  return {
    roll: vi.fn(() => values[index++]),
  };
}

function readyStatusPort() {
  return {
    getEvidence: vi.fn().mockResolvedValue({
      homeCityConfirmed: true,
      seasonJoined: true,
      starterTerritoryClaimed: true,
      firstUpgradeCompleted: true,
      firstIncomeObserved: true,
      tutorialContestCompleted: false,
      fullCityUnlocked: false,
    }),
  };
}

function contextPort() {
  return {
    getContext: vi.fn().mockResolvedValue({
      cityId: 'city-1',
      seasonId: 'season-1',
      seasonStatus: 'active',
    }),
  };
}
function eventPort(): GridEventLedgerPort {
  let persisted: any = null;
  return {
    insert: vi.fn(async (input) => {
      persisted = {
        id: 'event-1',
        ...input,
        actorPlayerId: input.actorPlayerId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        payload: input.payload ?? {},
        idempotencyKey: input.idempotencyKey ?? null,
        correlationId: input.correlationId ?? null,
        causationId: input.causationId ?? null,
        createdAt: now,
      };
      return { event: persisted, duplicate: false };
    }),
    getByIdempotencyKey: vi.fn(async (_seasonId, key) =>
      persisted?.idempotencyKey === key ? persisted : null,
    ),
  };
}

describe('Grid onboarding safe tutorial contest', () => {
  it('uses real Signal Dice rules but persists only a safe tutorial event', async () => {
    const events = eventPort();
    const roller = queuedRoller([6, 2, 5]);

    const result = await completeGridOnboardingTutorialContest(
      contextPort(),
      readyStatusPort(),
      events,
      roller,
      pkg,
      {
        playerId,
        idempotencyKey: 'tutorial-1',
        now,
      },
    );
    expect(result).toMatchObject({
      completed: true,
      alreadyComplete: false,
      attackerCommittedInfluence: 30,
      defenderCommittedInfluence: 10,
      attackerRolls: [6, 2],
      defenderRolls: [5],
      defenderInfluenceLost: 10,
      attackerInfluenceLost: 0,
      tiesFavorDefender: true,
    });

    expect(events.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        cityId: 'city-1',
        seasonId: 'season-1',
        actorPlayerId: playerId,
        eventType: 'grid:tutorial_contest_completed',
        entityType: 'tutorial',
        idempotencyKey: 'tutorial-1',
        payload: expect.objectContaining({
          safePractice: true,
          walletMutation: false,
          territoryMutation: false,
        }),
      }),
    );
  });

  it('counts a practice loss as tutorial completion without mutating gameplay state', async () => {
    const result = await completeGridOnboardingTutorialContest(
      contextPort(),
      readyStatusPort(),
      eventPort(),
      queuedRoller([1, 2, 6]),
      pkg,
      {
        playerId,
        idempotencyKey: 'tutorial-loss',
        now,
      },
    );

    expect(result.completed).toBe(true);
    expect(result.comparisons[0]?.winner).toBe('defender');
    expect(result.attackerInfluenceLost).toBe(10);
  });
  it('rejects the tutorial before the player reaches the tutorial step', async () => {
    const statusPort = readyStatusPort();
    statusPort.getEvidence.mockResolvedValue({
      homeCityConfirmed: true,
      seasonJoined: true,
      starterTerritoryClaimed: true,
      firstUpgradeCompleted: true,
      firstIncomeObserved: false,
      tutorialContestCompleted: false,
      fullCityUnlocked: false,
    });
    const events = eventPort();
    const roller = queuedRoller([6, 5, 4]);

    await expect(
      completeGridOnboardingTutorialContest(
        contextPort(),
        statusPort,
        events,
        roller,
        pkg,
        {
          playerId,
          idempotencyKey: 'too-early',
          now,
        },
      ),
    ).rejects.toThrow('not the current onboarding step');

    expect(events.insert).not.toHaveBeenCalled();
    expect(roller.roll).not.toHaveBeenCalled();
  });

  it('replays the persisted event for the same idempotency key without rerolling', async () => {
    const events = eventPort();
    const roller = queuedRoller([6, 4, 3]);
    const request = {
      playerId,
      idempotencyKey: 'tutorial-replay',
      now,
    };

    const first = await completeGridOnboardingTutorialContest(
      contextPort(),
      readyStatusPort(),
      events,
      roller,
      pkg,
      request,
    );
    const secondRoller = queuedRoller([1, 1, 6]);
    const second = await completeGridOnboardingTutorialContest(
      contextPort(),
      readyStatusPort(),
      events,
      secondRoller,
      pkg,
      request,
    );

    expect(second).toMatchObject({
      ...first,
      alreadyComplete: true,
    });
    expect(secondRoller.roll).not.toHaveBeenCalled();
  });
});
