import type { GridAuctionCommandPort } from './auction-port';
import type { GridAuctionSettlementSweepPort } from './auction-settlement-sweep-port';
import {
  settleExpiredGridAuctions,
  type GridAuctionSettlementSweepResult,
} from './auction-settlement-sweep-service';
import type { GridContractRewardSettlementPort } from './contract-reward-settlement-port';
import {
  settlePendingGridContractRewards,
  type GridContractRewardSettlementBatchResult,
} from './contract-reward-settlement-service';
import type { GridSeasonLifecyclePort } from './season-lifecycle-port';
import { reconcileGridSeasonLifecycle } from './season-lifecycle-service';

export type GridRuntimeMaintenancePhase<T> =
  | { status: 'completed'; result: T }
  | { status: 'skipped'; reason: 'disabled' | 'lifecycle-failed' }
  | { status: 'failed'; error: string };

export interface GridRuntimeMaintenanceSweepResult {
  now: string;
  success: boolean;
  lifecycle: GridRuntimeMaintenancePhase<
    Awaited<ReturnType<typeof reconcileGridSeasonLifecycle>>
  >;
  auctions: GridRuntimeMaintenancePhase<GridAuctionSettlementSweepResult>;
  contractRewards:
    GridRuntimeMaintenancePhase<GridContractRewardSettlementBatchResult>;
}

export interface GridRuntimeMaintenanceSweepDependencies {
  lifecyclePort: GridSeasonLifecyclePort;
  auctionReadPort: GridAuctionSettlementSweepPort;
  auctionCommandPort: GridAuctionCommandPort;
  contractRewardPort: GridContractRewardSettlementPort;
}

export interface GridRuntimeMaintenanceSweepInput {
  citySlug: string;
  seasonSlug: string;
  surgeHours: number;
  now: string;
  auctionSettlementEnabled: boolean;
  contractRewardSettlementEnabled: boolean;
  auctionLimit?: number;
  contractRewardLimit?: number;
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Grid runtime maintenance sweep requires ${label}`);
  }
  return normalized;
}

function requireTimestamp(value: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(
      'Grid runtime maintenance sweep requires a valid now timestamp',
    );
  }
  return value;
}

function requireLimit(value: number | undefined, label: string): number {
  const resolved = value ?? 25;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > 100) {
    throw new Error(
      `Grid runtime maintenance sweep ${label} must be between 1 and 100`,
    );
  }
  return resolved;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Grid runtime maintenance sweep phase failed';
}

export async function runGridRuntimeMaintenanceSweep(
  dependencies: GridRuntimeMaintenanceSweepDependencies,
  input: GridRuntimeMaintenanceSweepInput,
): Promise<GridRuntimeMaintenanceSweepResult> {
  const citySlug = requireText(input.citySlug, 'citySlug');
  const seasonSlug = requireText(input.seasonSlug, 'seasonSlug');
  const now = requireTimestamp(input.now);
  const auctionLimit = requireLimit(input.auctionLimit, 'auctionLimit');
  const contractRewardLimit = requireLimit(
    input.contractRewardLimit,
    'contractRewardLimit',
  );
  if (!Number.isSafeInteger(input.surgeHours) || input.surgeHours < 0) {
    throw new Error(
      'Grid runtime maintenance sweep surgeHours must be a non-negative safe integer',
    );
  }

  let lifecycle: GridRuntimeMaintenanceSweepResult['lifecycle'];
  let seasonId: string | null = null;

  try {
    const result = await reconcileGridSeasonLifecycle(
      dependencies.lifecyclePort,
      {
        citySlug,
        seasonSlug,
        surgeHours: input.surgeHours,
        now,
      },
    );
    seasonId = result.seasonId;
    lifecycle = { status: 'completed', result };
  } catch (error) {
    lifecycle = { status: 'failed', error: errorMessage(error) };
  }

  let auctions: GridRuntimeMaintenanceSweepResult['auctions'];
  if (!input.auctionSettlementEnabled) {
    auctions = { status: 'skipped', reason: 'disabled' };
  } else if (!seasonId) {
    auctions = { status: 'skipped', reason: 'lifecycle-failed' };
  } else {
    try {
      auctions = {
        status: 'completed',
        result: await settleExpiredGridAuctions(
          dependencies.auctionReadPort,
          dependencies.auctionCommandPort,
          {
            seasonId,
            now,
            limit: auctionLimit,
          },
        ),
      };
    } catch (error) {
      auctions = { status: 'failed', error: errorMessage(error) };
    }
  }

  let contractRewards: GridRuntimeMaintenanceSweepResult['contractRewards'];
  if (!input.contractRewardSettlementEnabled) {
    contractRewards = { status: 'skipped', reason: 'disabled' };
  } else {
    try {
      contractRewards = {
        status: 'completed',
        result: await settlePendingGridContractRewards(
          dependencies.contractRewardPort,
          {
            now,
            limit: contractRewardLimit,
          },
        ),
      };
    } catch (error) {
      contractRewards = {
        status: 'failed',
        error: errorMessage(error),
      };
    }
  }

  const phaseFailed =
    lifecycle.status === 'failed' ||
    auctions.status === 'failed' ||
    contractRewards.status === 'failed';
  const itemFailed =
    (auctions.status === 'completed' && auctions.result.failed > 0) ||
    (contractRewards.status === 'completed' &&
      contractRewards.result.failed > 0);

  return {
    now,
    success: !phaseFailed && !itemFailed,
    lifecycle,
    auctions,
    contractRewards,
  };
}
