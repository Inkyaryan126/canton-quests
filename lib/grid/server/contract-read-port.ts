import type { GridContractDefinition, GridContractInstance } from '../core/contract-types';

export interface GridContractReadScope {
  cityId: string;
  seasonId: string;
  playerId: string;
}

export interface GridContractReadDetailScope extends GridContractReadScope {
  contractId: string;
}

export interface GridContractReadRecord {
  definition: GridContractDefinition;
  instance: GridContractInstance;
  version: number;
}

export interface GridContractReadPort {
  listActive(scope: GridContractReadScope): Promise<GridContractReadRecord[]>;
  read(scope: GridContractReadDetailScope): Promise<GridContractReadRecord | null>;
}
