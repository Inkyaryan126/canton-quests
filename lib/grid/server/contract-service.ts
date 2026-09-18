import { applyGridContractProgress } from '../core/contracts';
import type { GridContractInstance } from '../core/contract-types';
import type {
  GridContractCatalogPort,
  GridContractCommitResult,
  GridContractProgressCommand,
  GridContractProgressPort,
  GridContractStoredInstance,
} from './contract-port';

export interface GridContractProgressServiceResult {
  outcome: 'applied' | 'duplicate';
  instance: GridContractInstance;
  version: number;
  completedNow: boolean;
  rewardQueued: boolean;
  locationBonusQueued: boolean;
}

const MAX_CONFLICT_RETRIES = 2;

function validateCommand(command: GridContractProgressCommand): void {
  if (!command || typeof command !== 'object') {
    throw new Error('Grid contract progress requires a command');
  }
  for (const [name, value] of [
    ['cityId', command.cityId],
    ['seasonId', command.seasonId],
    ['playerId', command.playerId],
    ['contractId', command.contractId],
    ['objectiveId', command.objectiveId],
    ['idempotencyKey', command.idempotencyKey],
  ] as const) {
    if (!value.trim()) throw new Error(`Grid contract progress requires ${name}`);
  }
  if (!Number.isSafeInteger(command.amount) || command.amount < 1) {
    throw new Error('Grid contract progress amount must be a safe integer >= 1');
  }
  if (!Number.isSafeInteger(command.nowMs) || command.nowMs < 0) {
    throw new Error('Grid contract progress nowMs must be a safe integer >= 0');
  }
  if (command.locationEnhanced !== undefined && typeof command.locationEnhanced !== 'boolean') {
    throw new Error('Grid contract progress locationEnhanced must be boolean');
  }
}

function validateStoredInstance(
  stored: GridContractStoredInstance,
  scope: GridContractProgressCommand,
): void {
  if (!stored || typeof stored !== 'object' || !stored.instance) {
    throw new Error('Grid contract persistence returned missing instance');
  }
  if (!Number.isSafeInteger(stored.version) || stored.version < 0) {
    throw new Error('Grid contract persistence returned invalid version');
  }
  if (stored.instance.playerId !== scope.playerId) {
    throw new Error('Grid contract instance player mismatch');
  }
  if (stored.instance.contractId !== scope.contractId) {
    throw new Error('Grid contract instance contract mismatch');
  }
}

function validateCommitResult(
  committed: GridContractCommitResult,
  scope: GridContractProgressCommand,
): void {
  if (!committed || !['applied', 'duplicate', 'conflict'].includes(committed.outcome)) {
    throw new Error('Grid contract persistence returned invalid commit outcome');
  }
  validateStoredInstance(committed.stored, scope);
}
export async function progressGridContract(
  catalog: GridContractCatalogPort,
  port: GridContractProgressPort,
  command: GridContractProgressCommand,
): Promise<GridContractProgressServiceResult> {
  validateCommand(command);
  const definition = await catalog.getDefinition({
    cityId: command.cityId,
    seasonId: command.seasonId,
    contractId: command.contractId,
  });
  if (!definition) throw new Error('Grid contract definition not found');
  if (definition.id !== command.contractId) {
    throw new Error('Grid contract catalog returned a mismatched definition');
  }

  for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt += 1) {
    const stored = await port.load({
      cityId: command.cityId,
      seasonId: command.seasonId,
      playerId: command.playerId,
      contractId: command.contractId,
    });
    if (!stored) throw new Error('Grid contract instance not found');
    validateStoredInstance(stored, command);

    const transition = applyGridContractProgress(definition, stored.instance, {
      objectiveId: command.objectiveId,
      amount: command.amount,
      nowMs: command.nowMs,
      locationEnhanced: command.locationEnhanced,
    });

    const committed = await port.commit({
      cityId: command.cityId,
      seasonId: command.seasonId,
      playerId: command.playerId,
      contractId: command.contractId,
      idempotencyKey: command.idempotencyKey,
      expectedVersion: stored.version,
      nextInstance: transition.instance,
      rewardIntent: transition.rewardIntent,
      locationBonusIntent: transition.locationBonusIntent,
    });
    validateCommitResult(committed, command);

    if (committed.outcome === 'conflict') continue;

    const applied = committed.outcome === 'applied';
    return {
      outcome: committed.outcome,
      instance: committed.stored.instance,
      version: committed.stored.version,
      completedNow: applied && transition.completedNow,
      rewardQueued: applied && transition.rewardIntent !== null,
      locationBonusQueued: applied && transition.locationBonusIntent !== null,
    };
  }

  throw new Error('Grid contract progress conflict retry limit exceeded');
}
