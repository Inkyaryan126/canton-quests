import { describe, expect, it } from 'vitest';
import {
  minimumRequiredAuctionBid,
  resolveGridAuctionBid,
  settleGridAuction,
  validateGridAuctionRules,
} from '../lib/grid/core/auction';
import type { GridAuctionState } from '../lib/grid/core/auction-types';

const rules = {
  reserveCredits: 1_500,
  minimumBidIncrementCredits: 100,
  startsAt: '2026-09-16T12:00:00.000Z',
  endsAt: '2026-09-17T12:00:00.000Z',
};

const openState: GridAuctionState = {
  status: 'open',
  rules,
};

describe('Grid auction core', () => {
  it('uses the reserve as the opening minimum', () => {
    expect(minimumRequiredAuctionBid(openState)).toBe(1_500);

    const decision = resolveGridAuctionBid(openState, {
      bidderPlayerId: 'player-a',
      amountCredits: 1_500,
      placedAt: '2026-09-16T12:00:00.000Z',
    });

    expect(decision.accepted).toBe(true);
    expect(decision.nextState.leadingBid).toEqual({
      bidderPlayerId: 'player-a',
      amountCredits: 1_500,
      placedAt: '2026-09-16T12:00:00.000Z',
    });
  });

  it('requires the configured increment after a leading bid', () => {
    const state: GridAuctionState = {
      ...openState,
      leadingBid: {
        bidderPlayerId: 'player-a',
        amountCredits: 1_700,
        placedAt: '2026-09-16T13:00:00.000Z',
      },
    };

    expect(minimumRequiredAuctionBid(state)).toBe(1_800);

    const tooLow = resolveGridAuctionBid(state, {
      bidderPlayerId: 'player-b',
      amountCredits: 1_799,
      placedAt: '2026-09-16T14:00:00.000Z',
    });
    expect(tooLow).toMatchObject({
      accepted: false,
      reason: 'bid-too-low',
      minimumRequiredCredits: 1_800,
    });
    expect(tooLow.nextState).toBe(state);
  });

  it('treats startsAt as inclusive and endsAt as exclusive for bids', () => {
    expect(
      resolveGridAuctionBid(openState, {
        bidderPlayerId: 'player-a',
        amountCredits: 1_500,
        placedAt: rules.startsAt,
      }).accepted,
    ).toBe(true);

    const atEnd = resolveGridAuctionBid(openState, {
      bidderPlayerId: 'player-a',
      amountCredits: 1_500,
      placedAt: rules.endsAt,
    });
    expect(atEnd).toMatchObject({
      accepted: false,
      reason: 'outside-auction-window',
    });
  });

  it('rejects bids when the persisted auction state is not open', () => {
    const scheduled = resolveGridAuctionBid(
      { ...openState, status: 'scheduled' },
      {
        bidderPlayerId: 'player-a',
        amountCredits: 1_500,
        placedAt: '2026-09-16T13:00:00.000Z',
      },
    );

    expect(scheduled).toMatchObject({
      accepted: false,
      reason: 'auction-not-open',
    });
  });

  it('settles to the current leader only after the auction end', () => {
    const withLeader: GridAuctionState = {
      ...openState,
      leadingBid: {
        bidderPlayerId: 'player-b',
        amountCredits: 2_100,
        placedAt: '2026-09-17T11:59:00.000Z',
      },
    };

    expect(() =>
      settleGridAuction(withLeader, '2026-09-17T11:59:59.999Z'),
    ).toThrow('before endsAt');

    expect(settleGridAuction(withLeader, rules.endsAt)).toMatchObject({
      sold: true,
      winnerPlayerId: 'player-b',
      winningBidCredits: 2_100,
      settledAt: rules.endsAt,
      nextState: { status: 'settled' },
    });
  });
  it('settles an auction with no bids as a no-sale', () => {
    const settlement = settleGridAuction(openState, rules.endsAt);

    expect(settlement).toMatchObject({
      sold: false,
      settledAt: rules.endsAt,
      nextState: { status: 'settled' },
    });
    expect(settlement.winnerPlayerId).toBeUndefined();
    expect(settlement.winningBidCredits).toBeUndefined();
  });

  it('rejects invalid rules and malformed bids deterministically', () => {
    expect(() =>
      validateGridAuctionRules({
        ...rules,
        minimumBidIncrementCredits: 0,
      }),
    ).toThrow('minimumBidIncrementCredits');

    expect(() =>
      validateGridAuctionRules({
        ...rules,
        endsAt: rules.startsAt,
      }),
    ).toThrow('endsAt must be after startsAt');

    expect(() =>
      resolveGridAuctionBid(openState, {
        bidderPlayerId: ' ',
        amountCredits: 1_500,
        placedAt: '2026-09-16T13:00:00.000Z',
      }),
    ).toThrow('bidderPlayerId');
  });

  it('rejects a next-bid minimum that would exceed safe integer math', () => {
    expect(() =>
      minimumRequiredAuctionBid({
        ...openState,
        rules: {
          ...rules,
          minimumBidIncrementCredits: 1,
        },
        leadingBid: {
          bidderPlayerId: 'player-a',
          amountCredits: Number.MAX_SAFE_INTEGER,
          placedAt: '2026-09-16T13:00:00.000Z',
        },
      }),
    ).toThrow('safe integer range');
  });
});
