import type {
  GridListMarketTransactionFeedInput,
  GridMarketTransactionFeedEntry,
  GridMarketTransactionReadPort,
} from './market-transaction-read-port';

const MAX_FEED_LIMIT = 50;

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`Grid market transaction feed requires ${label}`);
  }
}

export async function listGridMarketTransactionFeed(
  port: GridMarketTransactionReadPort,
  input: GridListMarketTransactionFeedInput,
): Promise<GridMarketTransactionFeedEntry[]> {
  requireNonBlank(input.seasonId, 'seasonId');
  requireNonBlank(input.viewerPlayerId, 'viewerPlayerId');
  if (!Number.isSafeInteger(input.limit) || input.limit <= 0) {
    throw new Error('Grid market transaction feed requires a positive limit');
  }

  return port.listRecentTransactions({
    ...input,
    limit: Math.min(input.limit, MAX_FEED_LIMIT),
  });
}
