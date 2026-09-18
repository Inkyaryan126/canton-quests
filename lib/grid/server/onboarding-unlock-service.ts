import type { GridCityPackage } from '../core/types';
import { appendGridEvent } from './event-ledger';
import type { GridEventLedgerPort } from './event-ledger-port';
import { readGridOnboardingStatus } from './onboarding-status-service';
import type { GridOnboardingStatusPort } from './onboarding-status-port';
import type { GridOnboardingUnlockPort } from './onboarding-unlock-port';

export interface GridOnboardingUnlockRequest {
  playerId: string;
  idempotencyKey: string;
  now: string;
}

export interface GridOnboardingUnlockResult {
  completed: true;
  alreadyComplete: boolean;
  unlockedAt: string;
}

function validateRequest(request: GridOnboardingUnlockRequest): void {
  if (!request.playerId.trim()) {
    throw new Error('Grid onboarding unlock requires playerId');
  }
  if (!request.idempotencyKey.trim()) {
    throw new Error(
      'Grid onboarding unlock requires a non-empty idempotency key',
    );
  }
  if (!Number.isFinite(Date.parse(request.now))) {
    throw new Error('Grid onboarding unlock requires a valid now timestamp');
  }
}
export async function completeGridOnboardingUnlock(
  contextPort: GridOnboardingUnlockPort,
  statusPort: GridOnboardingStatusPort,
  eventPort: GridEventLedgerPort,
  pkg: GridCityPackage,
  request: GridOnboardingUnlockRequest,
): Promise<GridOnboardingUnlockResult> {
  validateRequest(request);

  const context = await contextPort.getContext(request.playerId);
  if (
    !context ||
    !['active', 'surge'].includes(context.seasonStatus)
  ) {
    throw new Error('Grid onboarding unlock requires an active season');
  }

  const existing = await eventPort.getByIdempotencyKey(
    context.seasonId,
    request.idempotencyKey,
  );
  if (existing) {
    if (
      existing.eventType !== 'grid:onboarding_completed' ||
      existing.actorPlayerId !== request.playerId
    ) {
      throw new Error(
        'Grid onboarding unlock idempotency key belongs to another command',
      );
    }
    return {
      completed: true,
      alreadyComplete: true,
      unlockedAt:
        typeof existing.payload.unlockedAt === 'string'
          ? existing.payload.unlockedAt
          : existing.createdAt,
    };
  }
  const status = await readGridOnboardingStatus(statusPort, request.playerId);
  if (status.complete) {
    return {
      completed: true,
      alreadyComplete: true,
      unlockedAt: request.now,
    };
  }

  if (
    !status.readyForFullCityUnlock ||
    status.nextStep?.id !== 'unlock-full-city'
  ) {
    throw new Error(
      'Grid onboarding unlock requires every first-session prerequisite',
    );
  }

  const event = await appendGridEvent(eventPort, {
    cityId: context.cityId,
    seasonId: context.seasonId,
    actorPlayerId: request.playerId,
    eventType: 'grid:onboarding_completed',
    entityType: 'onboarding',
    payload: {
      onboardingVersion: 1,
      fullCityUnlocked: true,
      unlockedAt: request.now,
      citySlug: pkg.city.slug,
      seasonSlug: pkg.seasonTemplate.slug,
    },
    idempotencyKey: request.idempotencyKey,
  });

  return {
    completed: true,
    alreadyComplete: false,
    unlockedAt:
      typeof event.payload.unlockedAt === 'string'
        ? event.payload.unlockedAt
        : request.now,
  };
}
