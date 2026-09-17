import { validateGridMarketTransactionRecord } from '../core/market-transactions';
import type {
  GridDirectDealProposalAcceptCommand,
  GridDirectDealProposalAcceptResult,
  GridDirectDealProposalCancelCommand,
  GridDirectDealProposalCancelResult,
  GridDirectDealProposalCommandPort,
  GridDirectDealProposalCreateCommand,
  GridDirectDealProposalRecord,
} from './direct-deal-proposal-port';

const BASIS_POINTS = 10_000;
const MAX_POSTGRES_INTERVAL_MINUTES = 2_147_483_647;

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) throw new Error(`Grid Direct Deal proposal requires ${label}`);
}

function requireTimestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Grid Direct Deal proposal requires valid ${label}`);
  return parsed;
}

function requireNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Grid Direct Deal proposal requires non-negative safe integer ${label}`);
  }
}

function requirePositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Grid Direct Deal proposal requires positive safe integer ${label}`);
  }
}

function validateIdentity(command: { seasonId: string; proposalId: string; idempotencyKey: string }): void {
  requireNonBlank(command.seasonId, 'seasonId');
  requireNonBlank(command.proposalId, 'proposalId');
  requireNonBlank(command.idempotencyKey, 'a non-empty idempotency key');
}

function validatePropertyIds(
  proposerPropertyIds: readonly string[],
  counterpartyPropertyIds: readonly string[],
  maxAssetsPerSide: number,
): void {
  if (proposerPropertyIds.length > maxAssetsPerSide || counterpartyPropertyIds.length > maxAssetsPerSide) {
    throw new Error('Grid Direct Deal proposal exceeds maxAssetsPerSide');
  }
  const seen = new Set<string>();
  for (const propertyId of [...proposerPropertyIds, ...counterpartyPropertyIds]) {
    requireNonBlank(propertyId, 'propertyId');
    if (seen.has(propertyId)) throw new Error(`Grid Direct Deal proposal has duplicate property ${propertyId}`);
    seen.add(propertyId);
  }
}

export async function createGridDirectDealProposal(
  port: GridDirectDealProposalCommandPort,
  command: GridDirectDealProposalCreateCommand,
): Promise<GridDirectDealProposalRecord> {
  validateIdentity(command);
  requireNonBlank(command.proposerPlayerId, 'proposerPlayerId');
  requireNonBlank(command.counterpartyPlayerId, 'counterpartyPlayerId');
  if (command.proposerPlayerId === command.counterpartyPlayerId) {
    throw new Error('Grid Direct Deal proposal requires two distinct players');
  }
  requireNonNegativeSafeInteger(command.proposerCredits, 'proposerCredits');
  requireNonNegativeSafeInteger(command.counterpartyCredits, 'counterpartyCredits');
  requireNonNegativeSafeInteger(command.transactionTaxBps, 'transactionTaxBps');
  if (command.transactionTaxBps > BASIS_POINTS) {
    throw new Error('Grid Direct Deal proposal transactionTaxBps cannot exceed 10000');
  }
  requireNonNegativeSafeInteger(command.propertyTradeCooldownMinutes, 'propertyTradeCooldownMinutes');
  if (
    command.propertyTradeCooldownMinutes > MAX_POSTGRES_INTERVAL_MINUTES ||
    !Number.isSafeInteger(command.propertyTradeCooldownMinutes * 60_000)
  ) {
    throw new Error('Grid Direct Deal proposal propertyTradeCooldownMinutes is too large');
  }
  requirePositiveSafeInteger(command.maxAssetsPerSide, 'maxAssetsPerSide');
  validatePropertyIds(command.proposerPropertyIds, command.counterpartyPropertyIds, command.maxAssetsPerSide);
  if (
    command.proposerCredits === 0 &&
    command.counterpartyCredits === 0 &&
    command.proposerPropertyIds.length === 0 &&
    command.counterpartyPropertyIds.length === 0
  ) {
    throw new Error('Grid Direct Deal proposal requires value movement');
  }
  const createdAt = requireTimestamp(command.createdAt, 'createdAt');
  const expiresAt = requireTimestamp(command.expiresAt, 'expiresAt');
  const now = requireTimestamp(command.now, 'now');
  if (createdAt !== now) throw new Error('Grid Direct Deal proposal createdAt must equal now');
  if (expiresAt <= createdAt) throw new Error('Grid Direct Deal proposal expiresAt must be after createdAt');
  return port.createProposal(command);
}

export async function cancelGridDirectDealProposal(
  port: GridDirectDealProposalCommandPort,
  command: GridDirectDealProposalCancelCommand,
): Promise<GridDirectDealProposalCancelResult> {
  validateIdentity(command);
  requireNonBlank(command.proposerPlayerId, 'proposerPlayerId');
  requireTimestamp(command.now, 'now');
  return port.cancelProposal(command);
}

export async function acceptGridDirectDealProposal(
  port: GridDirectDealProposalCommandPort,
  command: GridDirectDealProposalAcceptCommand,
): Promise<GridDirectDealProposalAcceptResult> {
  validateIdentity(command);
  requireNonBlank(command.acceptingPlayerId, 'acceptingPlayerId');
  const now = requireTimestamp(command.now, 'now');
  validateGridMarketTransactionRecord(command.transaction);
  if (command.transaction.source !== 'direct-deal') {
    throw new Error('Grid Direct Deal acceptance requires direct-deal transaction source');
  }
  if (command.transaction.sourceId !== command.proposalId) {
    throw new Error('Grid Direct Deal acceptance transaction sourceId must equal proposalId');
  }
  if (requireTimestamp(command.transaction.occurredAt, 'transaction.occurredAt') !== now) {
    throw new Error('Grid Direct Deal acceptance transaction occurredAt must equal now');
  }
  if (command.transaction.assetTransfers.some(({ kind }) => kind !== 'property')) {
    throw new Error('Grid Direct Deal acceptance can only transfer property until authoritative inventory exists');
  }
  return port.acceptProposal(command);
}
