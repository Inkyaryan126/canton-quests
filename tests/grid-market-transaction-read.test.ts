import { describe, expect, it, vi } from 'vitest';
import { listGridMarketTransactionFeed } from '../lib/grid/server/market-transaction-read-service';
import { createSupabaseGridMarketTransactionReadPort } from '../lib/grid/server/supabase-market-transaction-read';
import type { GridMarketTransactionReadPort } from '../lib/grid/server/market-transaction-read-port';

describe('Grid market transaction feed', () => {
  it('validates season, viewer, and a positive limit', async () => {
    const port: GridMarketTransactionReadPort = {
      listRecentTransactions: vi.fn().mockResolvedValue([]),
    };

    await expect(
      listGridMarketTransactionFeed(port, {
        seasonId: ' ',
        viewerPlayerId: 'player-1',
        limit: 20,
      }),
    ).rejects.toThrow('seasonId');

    await expect(
      listGridMarketTransactionFeed(port, {
        seasonId: 'season-1',
        viewerPlayerId: 'player-1',
        limit: 0,
      }),
    ).rejects.toThrow('positive limit');

    expect(port.listRecentTransactions).not.toHaveBeenCalled();
  });

  it('caps the requested limit at the feed maximum', async () => {
    const port: GridMarketTransactionReadPort = {
      listRecentTransactions: vi.fn().mockResolvedValue([]),
    };

    await listGridMarketTransactionFeed(port, {
      seasonId: 'season-1',
      viewerPlayerId: 'player-1',
      limit: 500,
    });

    expect(port.listRecentTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 }),
    );
  });

  it('computes the viewer-relative net Credits delta and hides the counterparty identity', async () => {
    const orMock = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [{
            transaction_id: 'txn-1',
            city_id: 'city-1',
            source: 'fixed-price',
            occurred_at: '2026-09-17T12:00:00.000Z',
            credit_transfers: [
              { fromPlayerId: 'viewer-1', toPlayerId: 'seller-1', amountCredits: 5000 },
            ],
            asset_transfers: [
              {
                assetId: 'property-1',
                kind: 'property',
                fromPlayerId: 'seller-1',
                toPlayerId: 'viewer-1',
                estimatedValueCredits: 4000,
              },
            ],
            tax_charges: [{ playerId: 'viewer-1', amountCredits: 250 }],
            participant_a_id: 'seller-1',
            participant_b_id: 'viewer-1',
          }],
          error: null,
        }),
      }),
    });
    const eqSeason = vi.fn().mockReturnValue({ or: orMock });
    const transactionSelect = vi.fn().mockReturnValue({ eq: eqSeason });

    const propertyIn = vi.fn().mockResolvedValue({
      data: [{
        id: 'property-1',
        slug: 'private-property',
        display_name: 'Private Name',
        public_name_safe: false,
      }],
      error: null,
    });
    const propertySelect = vi.fn().mockReturnValue({ in: propertyIn });

    const from = vi.fn((table: string) =>
      table === 'grid_market_transactions'
        ? { select: transactionSelect }
        : { select: propertySelect },
    );

    const port = createSupabaseGridMarketTransactionReadPort({ from } as any);
    const result = await port.listRecentTransactions({
      seasonId: 'season-1',
      viewerPlayerId: 'viewer-1',
      limit: 20,
    });

    expect(result).toEqual([{
      transactionId: 'txn-1',
      cityId: 'city-1',
      occurredAt: '2026-09-17T12:00:00.000Z',
      source: 'fixed-price',
      netCreditsDelta: -5000,
      taxCreditsPaid: 250,
      propertyTransfers: [{
        propertySlug: 'private-property',
        propertyName: 'Grid Property',
        direction: 'acquired',
        estimatedValueCredits: 4000,
      }],
    }]);

    expect(JSON.stringify(result)).not.toContain('seller-1');
    expect(JSON.stringify(result)).not.toContain('Private Name');
  });
});
