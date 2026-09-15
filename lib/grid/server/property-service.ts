import { GRID_DEVELOPMENT_BRANCHES } from '../core/economy-types';
import type {
  GridAcquirePropertyCommand,
  GridDevelopPropertyCommand,
  GridPropertyAcquisitionResult,
  GridPropertyCommandBase,
  GridPropertyCommandPort,
  GridPropertyDevelopmentResult,
} from './property-port';

function validateBase(command: GridPropertyCommandBase): void {
  if (!command.idempotencyKey.trim()) {
    throw new Error('Grid property command requires a non-empty idempotency key');
  }
  if (!Number.isFinite(Date.parse(command.now))) {
    throw new Error('Grid property command requires a valid now timestamp');
  }
  if (
    !command.seasonId.trim() ||
    !command.playerId.trim() ||
    !command.propertyId.trim()
  ) {
    throw new Error('Grid property command requires seasonId, playerId, and propertyId');
  }
}
export async function acquireGridProperty(
  port: GridPropertyCommandPort,
  command: GridAcquirePropertyCommand,
): Promise<GridPropertyAcquisitionResult> {
  validateBase(command);
  return port.acquireProperty(command);
}

export async function developGridProperty(
  port: GridPropertyCommandPort,
  command: GridDevelopPropertyCommand,
): Promise<GridPropertyDevelopmentResult> {
  validateBase(command);
  if (!GRID_DEVELOPMENT_BRANCHES.includes(command.branch)) {
    throw new Error('Grid property development requires a valid branch');
  }
  return port.developProperty(command);
}