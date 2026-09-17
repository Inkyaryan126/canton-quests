import type {
  GridDirectDealAssetKind,
  GridDirectDealAssetSnapshot,
} from './direct-deal-types';

export type GridMarketAssetSnapshot = GridDirectDealAssetSnapshot;
export type GridMarketAssetKind = GridDirectDealAssetKind;

export interface GridFixedPriceListingRules {
  transactionTaxBps: number;
  propertyTradeCooldownMinutes: number;
  minimumPriceCredits: number;
  maximumPriceCredits: number;
  minimumListingDurationMinutes: number;
  maximumListingDurationMinutes: number;
}

export interface GridFixedPriceListingRequest {
  listingId: string;
  cityId: string;
  sellerPlayerId: string;
  sellerCityId: string;
  assetId: string;
  priceCredits: number;
  createdAt: string;
  expiresAt: string;
}

export type GridFixedPriceListingStatus =
  | 'open'
  | 'sold'
  | 'cancelled';

export type GridFixedPriceListingProjectedStatus =
  | 'scheduled'
  | GridFixedPriceListingStatus
  | 'expired';

export interface GridFixedPriceListingState {
  listingId: string;
  cityId: string;
  sellerPlayerId: string;
  assetId: string;
  assetKind: GridMarketAssetKind;
  priceCredits: number;
  createdAt: string;
  expiresAt: string;
  status: GridFixedPriceListingStatus;
  buyerPlayerId?: string;
  soldAt?: string;
  cancelledAt?: string;
}

export type GridFixedPriceListingOpenRejectionReason =
  | 'city-mismatch'
  | 'asset-mismatch'
  | 'asset-owner-mismatch'
  | 'asset-not-tradable'
  | 'major-landmark'
  | 'property-cooldown-unverifiable'
  | 'property-cooldown-active'
  | 'price-out-of-range'
  | 'duration-out-of-range';

export interface GridFixedPriceListingOpenDecision {
  accepted: boolean;
  reason?: GridFixedPriceListingOpenRejectionReason;
  listing?: GridFixedPriceListingState;
}

export interface GridMarketBuyerSnapshot {
  playerId: string;
  cityId: string;
  creditBalance: number;
}

export type GridFixedPricePurchaseRejectionReason =
  | 'listing-not-open'
  | 'outside-listing-window'
  | 'seller-cannot-buy'
  | 'city-mismatch'
  | 'asset-mismatch'
  | 'asset-owner-mismatch'
  | 'asset-not-tradable'
  | 'major-landmark'
  | 'property-cooldown-unverifiable'
  | 'property-cooldown-active'
  | 'insufficient-credits';

export interface GridFixedPricePurchasePlan {
  purchasable: boolean;
  reason?: GridFixedPricePurchaseRejectionReason;
  listingId: string;
  purchasedAt: string;
  buyerPlayerId: string;
  sellerPlayerId: string;
  priceCredits: number;
  taxCredits: number;
  buyerTotalDebitCredits: number;
  buyerCreditDelta: number;
  sellerCreditDelta: number;
  assetTransfer?: {
    assetId: string;
    kind: GridMarketAssetKind;
    fromPlayerId: string;
    toPlayerId: string;
  };
  nextListing: GridFixedPriceListingState;
}

export type GridFixedPriceCancellationRejectionReason =
  | 'listing-not-open'
  | 'outside-listing-window'
  | 'seller-only';

export interface GridFixedPriceCancellationDecision {
  cancelled: boolean;
  reason?: GridFixedPriceCancellationRejectionReason;
  nextListing: GridFixedPriceListingState;
}
