export interface GridAuctionListing {
  auctionId: string;
  seasonId: string;
  cityId: string;
  propertyId: string;
  propertySlug: string;
  propertyName: string;
  status: 'scheduled' | 'open';
  reserveCredits: number;
  minimumBidIncrementCredits: number;
  startsAt: string;
  endsAt: string;
  leadingBidCredits?: number;
  minimumNextBidCredits: number;
  viewerIsLeadingBidder: boolean;
}

export interface GridListActiveAuctionsInput {
  seasonId: string;
  viewerPlayerId: string;
  now: string;
}

export interface GridGetActiveAuctionInput {
  seasonId: string;
  auctionId: string;
  viewerPlayerId: string;
  now: string;
}

export interface GridAuctionReadPort {
  listActiveAuctions(
    input: GridListActiveAuctionsInput,
  ): Promise<GridAuctionListing[]>;
  getActiveAuction(
    input: GridGetActiveAuctionInput,
  ): Promise<GridAuctionListing | null>;
}
