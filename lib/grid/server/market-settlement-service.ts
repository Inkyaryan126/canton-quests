import type { GridDirectDealSettlementPlan } from '../core/direct-deal-types';
import type { GridFixedPricePurchasePlan } from '../core/market-listing-types';
import {
  buildGridMarketTransactionFromDirectDeal,
  buildGridMarketTransactionFromFixedPricePurchase,
  validateGridMarketTransactionRecord,
} from '../core/market-transactions';
import type {
  GridMarketCancelFixedPricePropertyListingCommand,
  GridMarketCancelFixedPricePropertyListingResult,
  GridMarketOpenFixedPricePropertyListingCommand,
  GridMarketOpenFixedPricePropertyListingResult,
  GridMarketSettlementCommand,
  GridMarketSettlementPort,
  GridMarketSettlementResult,
} from './market-settlement-port';

const BASIS_POINTS = 10_000;
const MAX_POSTGRES_INTERVAL_MINUTES = 2_147_483_647;

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) throw new Error(`Grid market settlement requires ${label}`);
}

function requireTimestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Grid market settlement requires valid ${label}`);
  return parsed;
}

function requireNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Grid market settlement requires non-negative safe integer ${label}`);
  }
}

function requirePositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Grid market settlement requires positive safe integer ${label}`);
  }
}

function validateRules(transactionTaxBps: number, propertyTradeCooldownMinutes: number): void {
  requireNonNegativeSafeInteger(transactionTaxBps, 'transactionTaxBps');
  if (transactionTaxBps > BASIS_POINTS) throw new Error('Grid market settlement transactionTaxBps cannot exceed 10000');
  requireNonNegativeSafeInteger(propertyTradeCooldownMinutes, 'propertyTradeCooldownMinutes');
  if (
    propertyTradeCooldownMinutes > MAX_POSTGRES_INTERVAL_MINUTES ||
    !Number.isSafeInteger(propertyTradeCooldownMinutes * 60_000)
  ) {
    throw new Error('Grid market settlement propertyTradeCooldownMinutes is too large');
  }
}

function validateCommandIdentity(command: { seasonId: string; idempotencyKey: string }): void {
  requireNonBlank(command.seasonId, 'seasonId');
  requireNonBlank(command.idempotencyKey, 'a non-empty idempotency key');
}

export async function openGridFixedPricePropertyListing(
  port: GridMarketSettlementPort,
  command: GridMarketOpenFixedPricePropertyListingCommand,
): Promise<GridMarketOpenFixedPricePropertyListingResult> {
  validateCommandIdentity(command);
  requireNonBlank(command.listingId, 'listingId');
  requireNonBlank(command.sellerPlayerId, 'sellerPlayerId');
  requireNonBlank(command.propertyId, 'propertyId');
  requirePositiveSafeInteger(command.priceCredits, 'priceCredits');
  requireNonNegativeSafeInteger(command.minimumPriceCredits, 'minimumPriceCredits');
  requirePositiveSafeInteger(command.maximumPriceCredits, 'maximumPriceCredits');
  if (command.maximumPriceCredits < command.minimumPriceCredits) throw new Error('Grid market settlement maximumPriceCredits must be at least minimumPriceCredits');
  if (command.priceCredits < command.minimumPriceCredits || command.priceCredits > command.maximumPriceCredits) throw new Error('Grid market settlement priceCredits is outside configured bounds');
  requirePositiveSafeInteger(command.minimumListingDurationMinutes, 'minimumListingDurationMinutes');
  requirePositiveSafeInteger(command.maximumListingDurationMinutes, 'maximumListingDurationMinutes');
  if (command.maximumListingDurationMinutes < command.minimumListingDurationMinutes) throw new Error('Grid market settlement maximumListingDurationMinutes must be at least minimumListingDurationMinutes');
  requireNonNegativeSafeInteger(command.propertyTradeCooldownMinutes, 'propertyTradeCooldownMinutes');
  if (
    command.propertyTradeCooldownMinutes > MAX_POSTGRES_INTERVAL_MINUTES ||
    !Number.isSafeInteger(command.propertyTradeCooldownMinutes * 60_000)
  ) throw new Error('Grid market settlement propertyTradeCooldownMinutes is too large');
  const createdAt = requireTimestamp(command.createdAt, 'createdAt');
  const expiresAt = requireTimestamp(command.expiresAt, 'expiresAt');
  const now = requireTimestamp(command.now, 'now');
  if (expiresAt <= createdAt) throw new Error('Grid market settlement expiresAt must be after createdAt');
  if (now >= expiresAt) throw new Error('Grid market settlement listing is already expired');
  const durationMs = expiresAt - createdAt;
  if (durationMs < command.minimumListingDurationMinutes * 60_000 || durationMs > command.maximumListingDurationMinutes * 60_000) {
    throw new Error('Grid market settlement listing duration is outside configured bounds');
  }
  return port.openFixedPricePropertyListing(command);
}

export async function cancelGridFixedPricePropertyListing(
  port: GridMarketSettlementPort,
  command: GridMarketCancelFixedPricePropertyListingCommand,
): Promise<GridMarketCancelFixedPricePropertyListingResult> {
  validateCommandIdentity(command);
  requireNonBlank(command.listingId, 'listingId');
  requireNonBlank(command.sellerPlayerId, 'sellerPlayerId');
  requireTimestamp(command.now, 'now');
  return port.cancelFixedPricePropertyListing(command);
}

export async function settleGridMarketTransaction(
  port: GridMarketSettlementPort,
  command: GridMarketSettlementCommand,
): Promise<GridMarketSettlementResult> {
  validateCommandIdentity(command);
  validateRules(command.transactionTaxBps, command.propertyTradeCooldownMinutes);
  validateGridMarketTransactionRecord(command.transaction);
  if (command.transaction.assetTransfers.some(({ kind }) => kind !== 'property')) {
    throw new Error('Grid market settlement cannot transfer generic assets until authoritative inventory ownership exists');
  }
  return port.settleTransaction(command);
}

export interface SettleGridDirectDealInput {
  seasonId: string;
  idempotencyKey: string;
  transactionId: string;
  sourceId: string;
  plan: GridDirectDealSettlementPlan;
  estimatedAssetValueCreditsById: Record<string, number>;
  transactionTaxBps: number;
  propertyTradeCooldownMinutes: number;
}

export async function settleGridDirectDeal(
  port: GridMarketSettlementPort,
  input: SettleGridDirectDealInput,
): Promise<GridMarketSettlementResult> {
  const transaction = buildGridMarketTransactionFromDirectDeal({
    transactionId: input.transactionId,
    sourceId: input.sourceId,
    plan: input.plan,
    estimatedAssetValueCreditsById: input.estimatedAssetValueCreditsById,
  });
  return settleGridMarketTransaction(port, {
    seasonId: input.seasonId,
    idempotencyKey: input.idempotencyKey,
    transactionTaxBps: input.transactionTaxBps,
    propertyTradeCooldownMinutes: input.propertyTradeCooldownMinutes,
    transaction,
  });
}

export interface SettleGridFixedPricePurchaseInput {
  seasonId: string;
  idempotencyKey: string;
  transactionId: string;
  cityId: string;
  plan: GridFixedPricePurchasePlan;
  estimatedAssetValueCredits: number;
  transactionTaxBps: number;
  propertyTradeCooldownMinutes: number;
}

export async function settleGridFixedPricePurchase(
  port: GridMarketSettlementPort,
  input: SettleGridFixedPricePurchaseInput,
): Promise<GridMarketSettlementResult> {
  const transaction = buildGridMarketTransactionFromFixedPricePurchase({
    transactionId: input.transactionId,
    cityId: input.cityId,
    plan: input.plan,
    estimatedAssetValueCredits: input.estimatedAssetValueCredits,
  });
  return settleGridMarketTransaction(port, {
    seasonId: input.seasonId,
    idempotencyKey: input.idempotencyKey,
    transactionTaxBps: input.transactionTaxBps,
    propertyTradeCooldownMinutes: input.propertyTradeCooldownMinutes,
    transaction,
  });
}
