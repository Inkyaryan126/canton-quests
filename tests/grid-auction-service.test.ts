import { describe, expect, it, vi } from 'vitest';
import type {
  GridAuctionCommandPort,
  GridAuctionCommandResult,
  GridAuctionBidResult,
  GridAuctionSettlementResult,
} from '../lib/grid/server/auction-port';
import {
  placeGridAuctionBid,
  scheduleGridAuction,
  settleGridAuctionCommand,
} from '../lib/grid/server/auction-service';
import { createSupabaseGridAuctionCommandPort } from '../lib/grid/server/supabase-auction';

const seasonId = '10000000-0000-4000-8000-000000000001';
const propertyId = '10000000-0000-4000-8000-000000000002';
const auctionId = '10000000-0000-4000-8000-000000000003';
const playerId = '10000000-0000-4000-8000-000000000004';
const cityId = '10000000-0000-4000-8000-000000000005';

const scheduleCommand = {
  seasonId,
  propertyId,
  reserveCredits: 1500,
  minimumBidIncrementCredits: 100,
  startsAt: '2026-09-16T12:00:00.000Z',
  endsAt: '2026-09-17T12:00:00.000Z',
  idempotencyKey: 'auction:schedule:one',
  now: '2026-09-16T11:00:00.000Z',
};

const scheduled: GridAuctionCommandResult = {
  auctionId,
  seasonId,
  cityId,
  propertyId,
  status: 'scheduled',
  reserveCredits: 1500,
  minimumBidIncrementCredits: 100,
  startsAt: scheduleCommand.startsAt,
  endsAt: scheduleCommand.endsAt,
  eventId: '10000000-0000-4000-8000-000000000006',
};

const bidCommand = {
  auctionId,
  bidderPlayerId: playerId,
  amountCredits: 1800,
  idempotencyKey: 'auction:bid:one',
  now: '2026-09-16T13:00:00.000Z',
};

const bidResult: GridAuctionBidResult = {
  auctionId,
  seasonId,
  propertyId,
  bidderPlayerId: playerId,
  amountCredits: 1800,
  creditsAfter: 3200,
  previousLeaderRefundedCredits: 0,
  eventId: '10000000-0000-4000-8000-000000000007',
};

const settleCommand = {
  auctionId,
  idempotencyKey: 'auction:settle:one',
  now: '2026-09-17T12:00:00.000Z',
};

const settlement: GridAuctionSettlementResult = {
  auctionId,
  seasonId,
  cityId,
  propertyId,
  sold: true,
  winnerPlayerId: playerId,
  winningBidCredits: 1800,
  settledAt: settleCommand.now,
  eventId: '10000000-0000-4000-8000-000000000008',
};

function port(): GridAuctionCommandPort {
  return {
    scheduleAuction: vi.fn().mockResolvedValue(scheduled),
    placeBid: vi.fn().mockResolvedValue(bidResult),
    settleAuction: vi.fn().mockResolvedValue(settlement),
  };
}

describe('Grid auction command service', () => {
  it('validates and forwards auction scheduling', async () => {
    const adapter = port();

    await expect(scheduleGridAuction(adapter, scheduleCommand)).resolves.toEqual(
      scheduled,
    );
    expect(adapter.scheduleAuction).toHaveBeenCalledWith(scheduleCommand);
  });

  it('rejects invalid auction schedule inputs before persistence', async () => {
    const adapter = port();

    await expect(
      scheduleGridAuction(adapter, {
        ...scheduleCommand,
        minimumBidIncrementCredits: 0,
      }),
    ).rejects.toThrow('minimumBidIncrementCredits');
    await expect(
      scheduleGridAuction(adapter, {
        ...scheduleCommand,
        endsAt: scheduleCommand.startsAt,
      }),
    ).rejects.toThrow('endsAt after startsAt');
    await expect(
      scheduleGridAuction(adapter, {
        ...scheduleCommand,
        idempotencyKey: ' ',
      }),
    ).rejects.toThrow('idempotency key');

    expect(adapter.scheduleAuction).not.toHaveBeenCalled();
  });

  it('validates bid and settlement commands', async () => {
    const adapter = port();

    await expect(placeGridAuctionBid(adapter, bidCommand)).resolves.toEqual(
      bidResult,
    );
    await expect(
      settleGridAuctionCommand(adapter, settleCommand),
    ).resolves.toEqual(settlement);

    expect(adapter.placeBid).toHaveBeenCalledWith(bidCommand);
    expect(adapter.settleAuction).toHaveBeenCalledWith(settleCommand);
  });

  it('rejects malformed bid commands before persistence', async () => {
    const adapter = port();

    await expect(
      placeGridAuctionBid(adapter, { ...bidCommand, amountCredits: -1 }),
    ).rejects.toThrow('amountCredits');
    await expect(
      placeGridAuctionBid(adapter, { ...bidCommand, bidderPlayerId: ' ' }),
    ).rejects.toThrow('bidderPlayerId');

    expect(adapter.placeBid).not.toHaveBeenCalled();
  });
});

describe('Supabase Grid auction adapter', () => {
  it('requires service-role configuration', () => {
    expect(() => createSupabaseGridAuctionCommandPort(null as any)).toThrow(
      'Grid auctions require Supabase service-role configuration',
    );
  });

  it('calls only the atomic auction RPCs', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: scheduled, error: null })
      .mockResolvedValueOnce({ data: bidResult, error: null })
      .mockResolvedValueOnce({ data: settlement, error: null });
    const adapter = createSupabaseGridAuctionCommandPort({ rpc } as any);

    await adapter.scheduleAuction(scheduleCommand);
    await adapter.placeBid(bidCommand);
    await adapter.settleAuction(settleCommand);

    expect(rpc).toHaveBeenNthCalledWith(1, 'grid_schedule_property_auction', {
      p_season_id: seasonId,
      p_property_id: propertyId,
      p_reserve_credits: 1500,
      p_minimum_bid_increment_credits: 100,
      p_starts_at: scheduleCommand.startsAt,
      p_ends_at: scheduleCommand.endsAt,
      p_idempotency_key: scheduleCommand.idempotencyKey,
      p_now: scheduleCommand.now,
    });

    expect(rpc).toHaveBeenNthCalledWith(2, 'grid_place_property_auction_bid', {
      p_auction_id: auctionId,
      p_player_id: playerId,
      p_amount_credits: 1800,
      p_idempotency_key: bidCommand.idempotencyKey,
      p_now: bidCommand.now,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, 'grid_settle_property_auction', {
      p_auction_id: auctionId,
      p_idempotency_key: settleCommand.idempotencyKey,
      p_now: settleCommand.now,
    });
  });
});
