import type {
  GridContractDefinition,
  GridContractInstance,
  GridContractReward,
} from '../core/contract-types';

export interface GridContractScope {
  cityId: string;
  seasonId: string;
  playerId: string;
  contractId: string;
}

export interface GridContractDefinitionScope {
  cityId: string;
  seasonId: string;
  contractId: string;
}

export interface GridContractProgressCommand extends GridContractScope {
  objectiveId: string;
  amount: number;
  idempotencyKey: string;
  nowMs: number;
  locationEnhanced?: boolean;
}

export interface GridContractStoredInstance {
  instance: GridContractInstance;
  version: number;
}
export interface GridContractCommitInput extends GridContractScope {
  objectiveId: string;
  amount: number;
  nowMs: number;
  locationEnhanced?: boolean;
  idempotencyKey: string;
  expectedVersion: number;
  nextInstance: GridContractInstance;
  rewardIntent: GridContractReward | null;
  locationBonusIntent: GridContractReward | null;
}

export type GridContractCommitOutcome = 'applied' | 'duplicate' | 'conflict';

export interface GridContractCommitResult {
  outcome: GridContractCommitOutcome;
  stored: GridContractStoredInstance;
}

export interface GridContractCatalogPort {
  getDefinition(scope: GridContractDefinitionScope): Promise<GridContractDefinition | null>;
}

export interface GridContractProgressPort {
  load(scope: GridContractScope): Promise<GridContractStoredInstance | null>;
  /**
   * Atomically compare-and-swap contract state and enqueue reward intents.
   * The idempotency key covers both state and outbox writes.
   */
  commit(input: GridContractCommitInput): Promise<GridContractCommitResult>;
}
