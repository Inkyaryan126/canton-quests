import type { GridAuctionCommandPort } from './auction-port';
import { settleGridAuctionCommand } from './auction-service';
import type { GridAuctionSettlementSweepPort } from './auction-settlement-sweep-port';

export interface GridAuctionSettlementSweepResult {
  discovered: number;
  settled: number;
  alreadySettled: number;
  failed: number;
}

export async function settleExpiredGridAuctions(
  readPort: GridAuctionSettlementSweepPort,
  commandPort: GridAuctionCommandPort,
  input: {
    seasonId: string;
    now: string;
    limit?: number;
  },
): Promise<GridAuctionSettlementSweepResult> {
  if (!input.seasonId.trim()) {
    throw new Error('Grid auction settlement sweep requires seasonId');
  }
  if (!Number.isFinite(Date.parse(input.now))) {
    throw new Error('Grid auction settlement sweep requires a valid now timestamp');
  }

  const limit = input.limit ?? 25;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Grid auction settlement sweep limit must be between 1 and 100');
  }

  const auctionIds = await readPort.listExpiredAuctionIds(
    input.seasonId,
    input.now,
    limit,
  );

  let settled = 0;
  let alreadySettled = 0;
  let failed = 0;

  for (const auctionId of auctionIds) {
    try {
      await settleGridAuctionCommand(commandPort, {
        auctionId,
        idempotencyKey: 'auction:auto-settle:' + auctionId,
        now: input.now,
      });
      settled += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('AUCTION_ALREADY_SETTLED')) {
        alreadySettled += 1;
      } else {
        failed += 1;
      }
    }
  }

  return {
    discovered: auctionIds.length,
    settled,
    alreadySettled,
    failed,
  };
}
