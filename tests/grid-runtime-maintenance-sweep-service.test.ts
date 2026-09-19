import { describe, expect, it, vi } from 'vitest';
import type { GridAuctionCommandPort } from '../lib/grid/server/auction-port';
import type { GridAuctionSettlementSweepPort } from '../lib/grid/server/auction-settlement-sweep-port';
import type { GridContractRewardSettlementPort } from '../lib/grid/server/contract-reward-settlement-port';
import type { GridSeasonLifecyclePort } from '../lib/grid/server/season-lifecycle-port';
import { runGridRuntimeMaintenanceSweep } from '../lib/grid/server/runtime-maintenance-sweep-service';

const now = '2026-09-19T15:30:00.000Z';

function dependencies(sequence: string[] = []) {
  const lifecyclePort: GridSeasonLifecyclePort = {
    readSeason: vi.fn(async () => {
      sequence.push('lifecycle:read');
      return {
        cityId: 'city-1',
        seasonId: 'season-1',
        status: 'active' as const,
        startsAt: '2026-09-01T00:00:00.000Z',
        surgeStartsAt: '2026-09-29T00:00:00.000Z',
        endsAt: '2026-10-01T00:00:00.000Z',
      };
    }),
    reconcile: vi.fn(async () => {
      sequence.push('lifecycle:reconcile');
      return {
        seasonId: 'season-1',
        previousStatus: 'active' as const,
        status: 'active' as const,
        changed: false,
        duplicate: false,
        eventId: null,
        updatedAt: now,
      };
    }),
  };

  const auctionReadPort: GridAuctionSettlementSweepPort = {
    listExpiredAuctionIds: vi.fn(async (seasonId) => {
      sequence.push('auctions:list:' + seasonId);
      return ['auction-1', 'auction-2'];
    }),
  };

  const auctionCommandPort: GridAuctionCommandPort = {
    scheduleAuction: vi.fn(),
    placeBid: vi.fn(),
    settleAuction: vi.fn(async (command) => {
      sequence.push('auctions:settle:' + command.auctionId);
      return {} as any;
    }),
  };

  const contractRewardPort: GridContractRewardSettlementPort = {
    listPendingRewardIds: vi.fn(async () => {
      sequence.push('rewards:list');
      return ['reward-1'];
    }),
    settleReward: vi.fn(async ({ outboxId }) => {
      sequence.push('rewards:settle:' + outboxId);
      return {
        outboxId,
        outcome: 'applied',
        playerId: 'player-1',
        seasonId: 'season-1',
        contractId: 'contract-1',
        creditsAwarded: 100,
        influenceAwarded: 5,
        commandPointsAwarded: 1,
        eventId: 'event-1',
        settledAt: now,
      } as any;
    }),
  };

  return {
    lifecyclePort,
    auctionReadPort,
    auctionCommandPort,
    contractRewardPort,
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    citySlug: 'canton-oh',
    seasonSlug: 'founding-season',
    surgeHours: 48,
    now,
    auctionSettlementEnabled: true,
    contractRewardSettlementEnabled: true,
    auctionLimit: 25,
    contractRewardLimit: 25,
    ...overrides,
  } as any;
}

describe('Grid runtime maintenance sweep', () => {
  it('runs lifecycle first, then uses its authoritative season id for auctions, then settles rewards', async () => {
    const sequence: string[] = [];
    const deps = dependencies(sequence);

    const result = await runGridRuntimeMaintenanceSweep(deps, input());

    expect(result.success).toBe(true);
    expect(result.lifecycle.status).toBe('completed');
    expect(result.auctions).toMatchObject({
      status: 'completed',
      result: {
        discovered: 2,
        settled: 2,
        alreadySettled: 0,
        failed: 0,
      },
    });
    expect(result.contractRewards).toMatchObject({
      status: 'completed',
      result: {
        discovered: 1,
        applied: 1,
        duplicates: 0,
        failed: 0,
      },
    });
    expect(deps.auctionReadPort.listExpiredAuctionIds).toHaveBeenCalledWith(
      'season-1',
      now,
      25,
    );
    expect(sequence).toEqual([
      'lifecycle:read',
      'auctions:list:season-1',
      'auctions:settle:auction-1',
      'auctions:settle:auction-2',
      'rewards:list',
      'rewards:settle:reward-1',
    ]);
  });

  it('skips disabled maintenance phases without calling their ports', async () => {
    const deps = dependencies();
    const result = await runGridRuntimeMaintenanceSweep(
      deps,
      input({
        auctionSettlementEnabled: false,
        contractRewardSettlementEnabled: false,
      }),
    );

    expect(result.success).toBe(true);
    expect(result.auctions).toEqual({
      status: 'skipped',
      reason: 'disabled',
    });
    expect(result.contractRewards).toEqual({
      status: 'skipped',
      reason: 'disabled',
    });
    expect(deps.auctionReadPort.listExpiredAuctionIds).not.toHaveBeenCalled();
    expect(deps.contractRewardPort.listPendingRewardIds).not.toHaveBeenCalled();
  });

  it('isolates lifecycle failure: auctions skip because they need season id while rewards still run', async () => {
    const deps = dependencies();
    vi.mocked(deps.lifecyclePort.readSeason).mockRejectedValueOnce(
      new Error('season lookup unavailable'),
    );

    const result = await runGridRuntimeMaintenanceSweep(deps, input());

    expect(result.success).toBe(false);
    expect(result.lifecycle).toEqual({
      status: 'failed',
      error: 'season lookup unavailable',
    });
    expect(result.auctions).toEqual({
      status: 'skipped',
      reason: 'lifecycle-failed',
    });
    expect(result.contractRewards.status).toBe('completed');
    expect(deps.contractRewardPort.listPendingRewardIds).toHaveBeenCalledOnce();
  });

  it('reports item-level settlement failures without hiding completed phases', async () => {
    const deps = dependencies();
    vi.mocked(deps.auctionCommandPort.settleAuction).mockRejectedValueOnce(
      new Error('auction settlement failed'),
    );
    vi.mocked(deps.contractRewardPort.settleReward).mockRejectedValueOnce(
      new Error('reward settlement failed'),
    );

    const result = await runGridRuntimeMaintenanceSweep(deps, input());

    expect(result.success).toBe(false);
    expect(result.lifecycle.status).toBe('completed');
    expect(result.auctions).toMatchObject({
      status: 'completed',
      result: { discovered: 2, settled: 1, failed: 1 },
    });
    expect(result.contractRewards).toMatchObject({
      status: 'completed',
      result: { discovered: 1, applied: 0, failed: 1 },
    });
  });

  it('validates limits before any maintenance side effect begins', async () => {
    const deps = dependencies();

    await expect(
      runGridRuntimeMaintenanceSweep(
        deps,
        input({ auctionLimit: 0 }),
      ),
    ).rejects.toThrow('auctionLimit must be between 1 and 100');

    await expect(
      runGridRuntimeMaintenanceSweep(
        deps,
        input({ contractRewardLimit: 101 }),
      ),
    ).rejects.toThrow('contractRewardLimit must be between 1 and 100');

    expect(deps.lifecyclePort.readSeason).not.toHaveBeenCalled();
    expect(deps.auctionReadPort.listExpiredAuctionIds).not.toHaveBeenCalled();
    expect(deps.contractRewardPort.listPendingRewardIds).not.toHaveBeenCalled();
  });
});
