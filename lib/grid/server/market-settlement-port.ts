import type { GridMarketTransactionRecord, GridMarketTransactionSource } from '../core/market-transaction-types';

export interface GridMarketOpenFixedPricePropertyListingCommand {
  seasonId: string;
  listingId: string;
  sellerPlayerId: string;
  propertyId: string;
  priceCredits: number;
  createdAt: string;
  expiresAt: string;
  minimumPriceCredits: number;
  maximumPriceCredits: number;
  minimumListingDurationMinutes: number;
  maximumListingDurationMinutes: number;
  propertyTradeCooldownMinutes: number;
  idempotencyKey: string;
  now: string;
}

export interface GridMarketOpenFixedPricePropertyListingResult {
  listingId: string;
  seasonId: string;
  cityId: string;
  sellerPlayerId: string;
  propertyId: string;
  priceCredits: number;
  createdAt: string;
  expiresAt: string;
  status: 'open';
  eventId: string;
}

export interface GridMarketCancelFixedPricePropertyListingCommand {
  seasonId: string;
  listingId: string;
  sellerPlayerId: string;
  idempotencyKey: string;
  now: string;
}

export interface GridMarketCancelFixedPricePropertyListingResult {
  listingId: string;
  seasonId: string;
  status: 'cancelled';
  cancelledAt: string;
  eventId: string;
}

export interface GridMarketSettlementCommand {
  seasonId: string;
  idempotencyKey: string;
  transactionTaxBps: number;
  propertyTradeCooldownMinutes: number;
  transaction: GridMarketTransactionRecord;
}

export interface GridMarketSettlementResult {
  transactionId: string;
  seasonId: string;
  cityId: string;
  source: GridMarketTransactionSource;
  sourceId: string;
  occurredAt: string;
  participantIds: [string, string];
  creditsAfter: Record<string, number>;
  propertyOwnerPlayerIds: Record<string, string>;
  totalTaxCredits: number;
  eventId: string;
}

export interface GridMarketSettlementPort {
  openFixedPricePropertyListing(
    command: GridMarketOpenFixedPricePropertyListingCommand,
  ): Promise<GridMarketOpenFixedPricePropertyListingResult>;
  cancelFixedPricePropertyListing(
    command: GridMarketCancelFixedPricePropertyListingCommand,
  ): Promise<GridMarketCancelFixedPricePropertyListingResult>;
  settleTransaction(
    command: GridMarketSettlementCommand,
  ): Promise<GridMarketSettlementResult>;
}
