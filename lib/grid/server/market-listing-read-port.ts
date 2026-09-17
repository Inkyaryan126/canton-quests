export interface GridMarketListingSummary {
  listingId: string;
  seasonId: string;
  cityId: string;
  propertyId: string;
  propertySlug: string;
  propertyName: string;
  status: 'open';
  priceCredits: number;
  createdAt: string;
  expiresAt: string;
  viewerIsSeller: boolean;
}

export interface GridListOpenMarketListingsInput {
  seasonId: string;
  viewerPlayerId: string;
  now: string;
}

export interface GridGetMarketListingInput {
  seasonId: string;
  listingId: string;
  viewerPlayerId: string;
  now: string;
}

export interface GridMarketListingReadPort {
  listOpenListings(
    input: GridListOpenMarketListingsInput,
  ): Promise<GridMarketListingSummary[]>;
  getListing(
    input: GridGetMarketListingInput,
  ): Promise<GridMarketListingSummary | null>;
}
