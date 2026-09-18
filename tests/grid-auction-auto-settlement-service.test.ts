import { describe, expect, it, vi } from 'vitest';
import type { GridAuctionCommandPort } from '../lib/grid/server/auction-port';
import { settleExpiredGridAuctions } from '../lib/grid/server/auction-settlement-sweep-service';

function commandPort(): GridAuctionCommandPort {
  return {
    scheduleAuction: vi.fn(),
    placeBid: vi.fn(),
    settleAuction: vi.fn(async (command) => ({
      auctionId: command.auctionId,
      seasonId: 'season-1',
      cityId: 'city-1',
      propertyId: 'property-1',
      sold: true,
      winnerPlayerId: 'winner-1',
      winningBidCredits: 500,
      settledAt: command.now,
      eventId: 'event-' + command.auctionId,
    })),
  };
}

describe('Grid expired auction settlement sweep', () => {
  it('settles a bounded expired batch with stable server-generated idempotency', async () => {
    const readPort = {
      listExpiredAuctionIds: vi
        .fn()
        .mockResolvedValue(['auction-1', 'auction-2']),
    };
    const commands = commandPort();

    const result = await settleExpiredGridAuctions(readPort, commands, {
      seasonId: 'season-1',
      now: '2026-09-18T07:30:00.000Z',
      limit: 25,
    });

    expect(readPort.listExpiredAuctionIds).toHaveBeenCalledWith(
      'season-1',
      '2026-09-18T07:30:00.000Z',
      25,
    );
    expect(commands.settleAuction).toHaveBeenNthCalledWith(1, {
      auctionId: 'auction-1',
      idempotencyKey: 'auction:auto-settle:auction-1',
      now: '2026-09-18T07:30:00.000Z',
    });
    expect(commands.settleAuction).toHaveBeenNthCalledWith(2, {
      auctionId: 'auction-2',
      idempotencyKey: 'auction:auto-settle:auction-2',
      now: '2026-09-18T07:30:00.000Z',
    });
    expect(result).toEqual({
      discovered: 2,
      settled: 2,
      alreadySettled: 0,
      failed: 0,
    });
  });

  it('does not let one failed expired auction block the rest of the sweep', async () => {
    const readPort = {
      listExpiredAuctionIds: vi
        .fn()
        .mockResolvedValue(['auction-bad', 'auction-good', 'auction-race']),
    };
    const commands = commandPort();
    vi.mocked(commands.settleAuction)
      .mockRejectedValueOnce(new Error('PROPERTY_NOT_AVAILABLE'))
      .mockResolvedValueOnce({
        auctionId: 'auction-good',
        seasonId: 'season-1',
        cityId: 'city-1',
        propertyId: 'property-1',
        sold: false,
        settledAt: '2026-09-18T07:30:00.000Z',
        eventId: 'event-good',
      })
      .mockRejectedValueOnce(new Error('AUCTION_ALREADY_SETTLED'));

    const result = await settleExpiredGridAuctions(readPort, commands, {
      seasonId: 'season-1',
      now: '2026-09-18T07:30:00.000Z',
    });

    expect(result).toEqual({
      discovered: 3,
      settled: 1,
      alreadySettled: 1,
      failed: 1,
    });
    expect(commands.settleAuction).toHaveBeenCalledTimes(3);
  });

  it('rejects unbounded sweep sizes before reading or mutating', async () => {
    const readPort = { listExpiredAuctionIds: vi.fn() };
    const commands = commandPort();

    await expect(
      settleExpiredGridAuctions(readPort, commands, {
        seasonId: 'season-1',
        now: '2026-09-18T07:30:00.000Z',
        limit: 101,
      }),
    ).rejects.toThrow('between 1 and 100');

    expect(readPort.listExpiredAuctionIds).not.toHaveBeenCalled();
    expect(commands.settleAuction).not.toHaveBeenCalled();
  });
});
