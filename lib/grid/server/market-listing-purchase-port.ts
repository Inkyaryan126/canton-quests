export interface GridMarketListingPurchaseListingSnapshot {
  listingId: string;
  cityId: string;
  sellerPlayerId: string;
  propertyId: string;
  priceCredits: number;
  createdAt: string;
  expiresAt: string;
  status: 'open' | 'sold' | 'cancelled';
}

export interface GridMarketListingPurchasePropertySnapshot {
  propertyId: string;
  cityId: string;
  ownerPlayerId: string | null;
  tradable: boolean;
  majorLandmark: boolean;
  acquiredAt: string | null;
  baseValueCredits: number;
}

export interface GridMarketListingPurchaseBuyerSnapshot {
  playerId: string;
  cityId: string;
  creditBalance: number;
}

export interface GridMarketListingPurchaseContext {
  listing: GridMarketListingPurchaseListingSnapshot | null;
  property: GridMarketListingPurchasePropertySnapshot | null;
  buyer: GridMarketListingPurchaseBuyerSnapshot | null;
}

export interface GridLoadMarketListingPurchaseContextInput {
  seasonId: string;
  listingId: string;
  buyerPlayerId: string;
}

export interface GridMarketListingPurchaseReadPort {
  loadPurchaseContext(
    input: GridLoadMarketListingPurchaseContextInput,
  ): Promise<GridMarketListingPurchaseContext>;
}
