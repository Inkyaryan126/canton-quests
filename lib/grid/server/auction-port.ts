export interface GridScheduleAuctionCommand {
  seasonId: string;
  propertyId: string;
  reserveCredits: number;
  minimumBidIncrementCredits: number;
  startsAt: string;
  endsAt: string;
  idempotencyKey: string;
  now: string;
}

export interface GridPlaceAuctionBidCommand {
  auctionId: string;
  bidderPlayerId: string;
  amountCredits: number;
  idempotencyKey: string;
  now: string;
}

export interface GridSettleAuctionCommand {
  auctionId: string;
  idempotencyKey: string;
  now: string;
}

export interface GridAuctionCommandResult {
  auctionId: string;
  seasonId: string;
  cityId: string;
  propertyId: string;
  status: 'scheduled' | 'open' | 'settled' | 'cancelled';
  reserveCredits: number;
  minimumBidIncrementCredits: number;
  startsAt: string;
  endsAt: string;
  leadingBidderPlayerId?: string;
  leadingBidCredits?: number;
  settledAt?: string;
  eventId: string;
}

export interface GridAuctionBidResult {
  auctionId: string;
  seasonId: string;
  propertyId: string;
  bidderPlayerId: string;
  amountCredits: number;
  creditsAfter: number;
  previousLeaderPlayerId?: string;
  previousLeaderRefundedCredits: number;
  eventId: string;
}

export interface GridAuctionSettlementResult {
  auctionId: string;
  seasonId: string;
  cityId: string;
  propertyId: string;
  sold: boolean;
  winnerPlayerId?: string;
  winningBidCredits?: number;
  settledAt: string;
  eventId: string;
}

export interface GridAuctionCommandPort {
  scheduleAuction(
    command: GridScheduleAuctionCommand,
  ): Promise<GridAuctionCommandResult>;
  placeBid(command: GridPlaceAuctionBidCommand): Promise<GridAuctionBidResult>;
  settleAuction(
    command: GridSettleAuctionCommand,
  ): Promise<GridAuctionSettlementResult>;
}
