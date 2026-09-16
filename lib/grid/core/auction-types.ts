export type GridAuctionStatus =
  | 'scheduled'
  | 'open'
  | 'settled'
  | 'cancelled';

export interface GridAuctionRules {
  reserveCredits: number;
  minimumBidIncrementCredits: number;
  startsAt: string;
  endsAt: string;
}

export interface GridAuctionBid {
  bidderPlayerId: string;
  amountCredits: number;
  placedAt: string;
}

export interface GridAuctionState {
  status: GridAuctionStatus;
  rules: GridAuctionRules;
  leadingBid?: GridAuctionBid;
}

export type GridAuctionBidRejectionReason =
  | 'auction-not-open'
  | 'outside-auction-window'
  | 'bid-too-low';

export interface GridAuctionBidDecision {
  accepted: boolean;
  minimumRequiredCredits: number;
  reason?: GridAuctionBidRejectionReason;
  nextState: GridAuctionState;
}

export interface GridAuctionSettlement {
  sold: boolean;
  winnerPlayerId?: string;
  winningBidCredits?: number;
  settledAt: string;
  nextState: GridAuctionState;
}
