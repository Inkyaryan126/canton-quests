import { assertGridContractDefinition } from '../core/contracts';
import type { GridContractDefinition, GridContractInstance } from '../core/contract-types';
import type {
  GridContractReadDetailScope,
  GridContractReadPort,
  GridContractReadRecord,
  GridContractReadScope,
} from './contract-read-port';

export interface GridContractReadItem {
  contract: GridContractDefinition;
  state: GridContractInstance;
  version: number;
}

export interface GridContractListResult {
  cityId: string;
  seasonId: string;
  contracts: GridContractReadItem[];
}

export interface GridContractDetailResult {
  cityId: string;
  seasonId: string;
  contract: GridContractReadItem;
}

function requireScope(scope: GridContractReadScope): GridContractReadScope {
  if (!scope || typeof scope !== 'object') {
    throw new Error('Grid contract read requires a scope');
  }
  for (const [name, value] of Object.entries(scope)) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Grid contract read requires ${name}`);
    }
  }
  return {
    cityId: scope.cityId.trim(),
    seasonId: scope.seasonId.trim(),
    playerId: scope.playerId.trim(),
  };
}

function requireDetailScope(scope: GridContractReadDetailScope): GridContractReadDetailScope {
  const normalized = requireScope(scope);
  const contractId = scope.contractId.trim();
  if (!contractId) throw new Error('Grid contract read requires contractId');
  return { ...normalized, contractId };
}

function normalizeRecord(
  record: GridContractReadRecord,
  scope: GridContractReadScope,
): GridContractReadItem {
  if (!record || typeof record !== 'object') {
    throw new Error('Grid contract read returned an invalid record');
  }
  assertGridContractDefinition(record.definition);
  if (!record.instance || record.instance.playerId !== scope.playerId) {
    throw new Error('Grid contract read returned a player mismatch');
  }
  if (record.instance.contractId !== record.definition.id) {
    throw new Error('Grid contract read returned a contract mismatch');
  }
  if (!Number.isSafeInteger(record.version) || record.version < 0) {
    throw new Error('Grid contract read returned an invalid version');
  }

  return {
    contract: record.definition,
    state: {
      ...record.instance,
      progress: { ...record.instance.progress },
    },
    version: record.version,
  };
}

export async function listActiveGridContracts(
  port: GridContractReadPort,
  scope: GridContractReadScope,
): Promise<GridContractListResult> {
  const normalized = requireScope(scope);
  const records = await port.listActive(normalized);
  const contracts = records
    .map((record) => normalizeRecord(record, normalized))
    .sort((left, right) => left.contract.id.localeCompare(right.contract.id));
  return { cityId: normalized.cityId, seasonId: normalized.seasonId, contracts };
}

export async function readGridContract(
  port: GridContractReadPort,
  scope: GridContractReadDetailScope,
): Promise<GridContractDetailResult | null> {
  const normalized = requireDetailScope(scope);
  const record = await port.read(normalized);
  if (!record) return null;
  return {
    cityId: normalized.cityId,
    seasonId: normalized.seasonId,
    contract: normalizeRecord(record, normalized),
  };
}
