import { describe, expect, it, vi } from 'vitest';
import type { GridEventLedgerPort } from '../lib/grid/server/event-ledger-port';
import { cantonFoundingSeasonPackage as pkg } from '../lib/grid/cities/canton/founding-season';
import { completeGridOnboardingUnlock } from '../lib/grid/server/onboarding-unlock-service';

const playerId = 'player-1';
const now = '2026-09-18T05:30:00.000Z';

function contextPort() {
  return {
    getContext: vi.fn().mockResolvedValue({
      cityId: 'city-1',
      seasonId: 'season-1',
      seasonStatus: 'active',
    }),
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
      tutorialContestCompleted: true,
      fullCityUnlocked: false,
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

describe('Grid onboarding full-city unlock', () => {
  it('persists completion only after every onboarding prerequisite', async () => {
    const events = eventPort();
    const result = await completeGridOnboardingUnlock(
      contextPort(),
      readyStatusPort(),
      events,
      pkg,
      { playerId, idempotencyKey: 'unlock-1', now },
    );
    expect(result).toEqual({
      completed: true,
      alreadyComplete: false,
      unlockedAt: now,
    });
    expect(events.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        cityId: 'city-1',
        seasonId: 'season-1',
        actorPlayerId: playerId,
        eventType: 'grid:onboarding_completed',
        entityType: 'onboarding',
        idempotencyKey: 'unlock-1',
        payload: expect.objectContaining({
          fullCityUnlocked: true,
          citySlug: 'canton-oh',
          seasonSlug: 'founding-season',
        }),
      }),
    );
  });

  it('rejects unlock while the tutorial contest is incomplete', async () => {
    const status = readyStatusPort();
    status.getEvidence.mockResolvedValue({
      homeCityConfirmed: true,
      seasonJoined: true,
      starterTerritoryClaimed: true,
      firstUpgradeCompleted: true,
      firstIncomeObserved: true,
      tutorialContestCompleted: false,
      fullCityUnlocked: false,
    });
    const events = eventPort();

    await expect(
      completeGridOnboardingUnlock(
        contextPort(),
        status,
        events,
        pkg,
        { playerId, idempotencyKey: 'unlock-early', now },
      ),
    ).rejects.toThrow('requires every first-session prerequisite');

    expect(events.insert).not.toHaveBeenCalled();
  });
  it('replays the same completion event idempotently', async () => {
    const events = eventPort();
    const request = { playerId, idempotencyKey: 'unlock-replay', now };

    const first = await completeGridOnboardingUnlock(
      contextPort(),
      readyStatusPort(),
      events,
      pkg,
      request,
    );
    const second = await completeGridOnboardingUnlock(
      contextPort(),
      readyStatusPort(),
      events,
      pkg,
      request,
    );

    expect(first.alreadyComplete).toBe(false);
    expect(second).toEqual({
      completed: true,
      alreadyComplete: true,
      unlockedAt: now,
    });
  });
});
