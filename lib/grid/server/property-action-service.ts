import type { GridDevelopmentBranch } from '../core/economy-types';
import type { GridPropertyCommandPort } from './property-port';
import { acquireGridProperty, developGridProperty } from './property-service';
import type { GridPropertyActionPort } from './property-action-port';

interface GridPropertyActionRequest {
  playerId: string;
  propertySlug: string;
  idempotencyKey: string;
  now: string;
}

export interface GridDevelopPropertyActionRequest
  extends GridPropertyActionRequest {
  branch: GridDevelopmentBranch;
}

function validateRequest(request: GridPropertyActionRequest): void {
  if (!request.playerId.trim() || !request.propertySlug.trim()) {
    throw new Error('Grid property action requires playerId and propertySlug');
  }
  if (!request.idempotencyKey.trim()) {
    throw new Error(
      'Grid property action requires a non-empty idempotency key',
    );
  }
  if (!Number.isFinite(Date.parse(request.now))) {
    throw new Error('Grid property action requires a valid now timestamp');
  }
}

async function resolveTarget(
  targetPort: GridPropertyActionPort,
  propertySlug: string,
) {
  const target = await targetPort.resolveTarget(propertySlug);
  if (!target || !['active', 'surge'].includes(target.seasonStatus)) {
    throw new Error(
      'Grid property action requires an active season and valid target',
    );
  }
  return target;
}

export async function acquireGridWorldProperty(
  targetPort: GridPropertyActionPort,
  commandPort: GridPropertyCommandPort,
  request: GridPropertyActionRequest,
) {
  validateRequest(request);
  const target = await resolveTarget(targetPort, request.propertySlug);
  const result = await acquireGridProperty(commandPort, {
    seasonId: target.seasonId,
    playerId: request.playerId,
    propertyId: target.propertyId,
    idempotencyKey: request.idempotencyKey,
    now: request.now,
  });

  return {
    propertySlug: result.propertySlug,
    acquiredAt: result.acquiredAt,
    creditsSpent: result.creditsSpent,
    commandPointsSpent: result.commandPointsSpent,
    credits: result.credits,
    influence: result.influence,
    commandPoints: result.commandPoints,
  };
}

export async function developGridWorldProperty(
  targetPort: GridPropertyActionPort,
  commandPort: GridPropertyCommandPort,
  request: GridDevelopPropertyActionRequest,
) {
  validateRequest(request);
  const target = await resolveTarget(targetPort, request.propertySlug);
  const result = await developGridProperty(commandPort, {
    seasonId: target.seasonId,
    playerId: request.playerId,
    propertyId: target.propertyId,
    branch: request.branch,
    idempotencyKey: request.idempotencyKey,
    now: request.now,
  });

  return {
    propertySlug: result.propertySlug,
    developmentBranch: result.developmentBranch,
    previousLevel: result.previousLevel,
    developmentLevel: result.developmentLevel,
    developedAt: result.developedAt,
    creditsSpent: result.creditsSpent,
    commandPointsSpent: result.commandPointsSpent,
    credits: result.credits,
    influence: result.influence,
    commandPoints: result.commandPoints,
    skylineFormed: Boolean(result.skylineEventId),
  };
}
