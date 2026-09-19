import type {
  GridContractRewardSettlementPort,
  GridContractRewardSettlementResult,
} from './contract-reward-settlement-port';

export interface GridContractRewardSettlementFailure {
  outboxId: string;
  error: string;
}

export interface GridContractRewardSettlementBatchResult {
  discovered: number;
  applied: number;
  duplicates: number;
  failed: number;
  failures: GridContractRewardSettlementFailure[];
  results: GridContractRewardSettlementResult[];
}

export async function settlePendingGridContractRewards(
  port: GridContractRewardSettlementPort,
  input: {
    now: string;
    limit?: number;
  },
): Promise<GridContractRewardSettlementBatchResult> {
  if (!Number.isFinite(Date.parse(input.now))) {
    throw new Error(
      'Grid Contract reward settlement requires a valid now timestamp',
    );
  }

  const limit = input.limit ?? 25;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error(
      'Grid Contract reward settlement limit must be between 1 and 100',
    );
  }

  const outboxIds = await port.listPendingRewardIds(limit);
  const results: GridContractRewardSettlementResult[] = [];
  const failures: GridContractRewardSettlementFailure[] = [];
  let applied = 0;
  let duplicates = 0;

  for (const outboxId of outboxIds) {
    if (!outboxId.trim()) {
      failures.push({
        outboxId,
        error: 'Grid Contract reward settlement discovered an empty outbox id',
      });
      continue;
    }

    try {
      const result = await port.settleReward({
        outboxId,
        now: input.now,
      });
      results.push(result);
      if (result.outcome === 'duplicate') duplicates += 1;
      else applied += 1;
    } catch (error) {
      failures.push({
        outboxId,
        error:
          error instanceof Error
            ? error.message
            : 'Grid Contract reward settlement failed',
      });
    }
  }

  return {
    discovered: outboxIds.length,
    applied,
    duplicates,
    failed: failures.length,
    failures,
    results,
  };
}
