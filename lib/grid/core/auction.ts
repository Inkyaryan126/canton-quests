import type {
  GridAuctionBid,
  GridAuctionBidDecision,
  GridAuctionRules,
  GridAuctionSettlement,
  GridAuctionState,
} from './auction-types';

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function timestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid timestamp`);
  }
  return parsed;
}

export function validateGridAuctionRules(rules: GridAuctionRules): void {
  requireNonNegativeInteger(rules.reserveCredits, 'reserveCredits');
  requirePositiveInteger(
    rules.minimumBidIncrementCredits,
    'minimumBidIncrementCredits',
  );

  const startsAt = timestamp(rules.startsAt, 'startsAt');
  const endsAt = timestamp(rules.endsAt, 'endsAt');
  if (endsAt <= startsAt) {
    throw new Error('endsAt must be after startsAt');
  }
}

function validateBid(bid: GridAuctionBid): void {
  if (!bid.bidderPlayerId.trim()) {
    throw new Error('bidderPlayerId is required');
  }
  requireNonNegativeInteger(bid.amountCredits, 'amountCredits');
  timestamp(bid.placedAt, 'placedAt');
}

export function minimumRequiredAuctionBid(
  state: GridAuctionState,
): number {
  validateGridAuctionRules(state.rules);

  if (!state.leadingBid) {
    return state.rules.reserveCredits;
  }

  requireNonNegativeInteger(
    state.leadingBid.amountCredits,
    'leadingBid.amountCredits',
  );
  const minimum =
    state.leadingBid.amountCredits +
    state.rules.minimumBidIncrementCredits;
  if (!Number.isSafeInteger(minimum)) {
    throw new Error('minimum required bid exceeds safe integer range');
  }
  return minimum;
}

export function resolveGridAuctionBid(
  state: GridAuctionState,
  bid: GridAuctionBid,
): GridAuctionBidDecision {
  validateGridAuctionRules(state.rules);
  validateBid(bid);

  const minimumRequiredCredits = minimumRequiredAuctionBid(state);
  if (state.status !== 'open') {
    return {
      accepted: false,
      minimumRequiredCredits,
      reason: 'auction-not-open',
      nextState: state,
    };
  }

  const placedAt = timestamp(bid.placedAt, 'placedAt');
  const startsAt = timestamp(state.rules.startsAt, 'startsAt');
  const endsAt = timestamp(state.rules.endsAt, 'endsAt');
  if (placedAt < startsAt || placedAt >= endsAt) {
    return {
      accepted: false,
      minimumRequiredCredits,
      reason: 'outside-auction-window',
      nextState: state,
    };
  }

  if (bid.amountCredits < minimumRequiredCredits) {
    return {
      accepted: false,
      minimumRequiredCredits,
      reason: 'bid-too-low',
      nextState: state,
    };
  }

  return {
    accepted: true,
    minimumRequiredCredits,
    nextState: {
      ...state,
      leadingBid: { ...bid },
    },
  };
}

export function settleGridAuction(
  state: GridAuctionState,
  settledAt: string,
): GridAuctionSettlement {
  validateGridAuctionRules(state.rules);
  const settlementTime = timestamp(settledAt, 'settledAt');
  const endsAt = timestamp(state.rules.endsAt, 'endsAt');

  if (state.status === 'cancelled') {
    throw new Error('cancelled auction cannot be settled');
  }
  if (state.status === 'settled') {
    throw new Error('auction is already settled');
  }
  if (settlementTime < endsAt) {
    throw new Error('auction cannot settle before endsAt');
  }

  const nextState: GridAuctionState = {
    ...state,
    status: 'settled',
  };

  if (!state.leadingBid) {
    return {
      sold: false,
      settledAt,
      nextState,
    };
  }

  return {
    sold: true,
    winnerPlayerId: state.leadingBid.bidderPlayerId,
    winningBidCredits: state.leadingBid.amountCredits,
    settledAt,
    nextState,
  };
}
