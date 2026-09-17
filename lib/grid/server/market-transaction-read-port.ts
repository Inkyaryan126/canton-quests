import type { GridMarketTransactionSource } from '../core/market-transaction-types';

export interface GridMarketTransactionFeedPropertyTransfer {
  propertySlug: string;
  propertyName: string;
  direction: 'acquired' | 'sold';
  estimatedValueCredits: number;
}

export interface GridMarketTransactionFeedEntry {
  transactionId: string;
  cityId: string;
  occurredAt: string;
  source: GridMarketTransactionSource;
  netCreditsDelta: number;
  taxCreditsPaid: number;
  propertyTransfers: GridMarketTransactionFeedPropertyTransfer[];
}

export interface GridListMarketTransactionFeedInput {
  seasonId: string;
  viewerPlayerId: string;
  limit: number;
}

export interface GridMarketTransactionReadPort {
  listRecentTransactions(
    input: GridListMarketTransactionFeedInput,
  ): Promise<GridMarketTransactionFeedEntry[]>;
}
