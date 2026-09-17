import { planGridFixedPricePurchase } from '../core/market-listings';
import type {
  GridFixedPricePurchaseRejectionReason,
  GridMarketAssetSnapshot,
  GridMarketBuyerSnapshot,
} from '../core/market-listing-types';
import { GRID_MARKET_LISTING_RULES } from './market-listing-rules';
import type {
  GridMarketListingPurchaseReadPort,
} from './market-listing-purchase-port';
import { settleGridFixedPricePurchase } from './market-settlement-service';
import type {
  GridMarketSettlementPort,
  GridMarketSettlementResult,
} from './market-settlement-port';

export interface GridPurchaseMarketListingCommand {
  seasonId: string;
  listingId: string;
  buyerPlayerId: string;
  idempotencyKey: string;
  now: string;
}

export type GridMarketListingPurchaseFailureReason =
  | GridFixedPricePurchaseRejectionReason
  | 'listing-not-found'
  | 'property-not-found'
  | 'buyer-not-joined';

export type GridPurchaseMarketListingOutcome =
  | { purchased: true; settlement: GridMarketSettlementResult }
  | { purchased: false; reason: GridMarketListingPurchaseFailureReason };

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`Grid market listing purchase requires ${label}`);
  }
}

export async function purchaseGridMarketListing(
  readPort: GridMarketListingPurchaseReadPort,
  settlementPort: GridMarketSettlementPort,
  command: GridPurchaseMarketListingCommand,
): Promise<GridPurchaseMarketListingOutcome> {
  requireNonBlank(command.seasonId, 'seasonId');
  requireNonBlank(command.listingId, 'listingId');
  requireNonBlank(command.buyerPlayerId, 'buyerPlayerId');
  requireNonBlank(command.idempotencyKey, 'a non-empty idempotency key');
  if (!Number.isFinite(Date.parse(command.now))) {
    throw new Error('Grid market listing purchase requires a valid now timestamp');
  }

  const context = await readPort.loadPurchaseContext({
    seasonId: command.seasonId,
    listingId: command.listingId,
    buyerPlayerId: command.buyerPlayerId,
  });

  if (!context.listing) return { purchased: false, reason: 'listing-not-found' };
  if (!context.property) return { purchased: false, reason: 'property-not-found' };
  if (!context.buyer) return { purchased: false, reason: 'buyer-not-joined' };

  const listingState = {
    listingId: context.listing.listingId,
    cityId: context.listing.cityId,
    sellerPlayerId: context.listing.sellerPlayerId,
    assetId: context.listing.propertyId,
    assetKind: 'property' as const,
    priceCredits: context.listing.priceCredits,
    createdAt: context.listing.createdAt,
    expiresAt: context.listing.expiresAt,
    status: context.listing.status,
  };

  const asset: GridMarketAssetSnapshot = {
    assetId: context.property.propertyId,
    kind: 'property',
    cityId: context.property.cityId,
    ownerPlayerId: context.property.ownerPlayerId ?? '',
    tradable: context.property.tradable,
    majorLandmark: context.property.majorLandmark,
    acquiredAt: context.property.acquiredAt ?? undefined,
  };

  const buyer: GridMarketBuyerSnapshot = {
    playerId: context.buyer.playerId,
    cityId: context.buyer.cityId,
    creditBalance: context.buyer.creditBalance,
  };

  const plan = planGridFixedPricePurchase(
    listingState,
    buyer,
    asset,
    GRID_MARKET_LISTING_RULES,
    command.now,
  );

  if (!plan.purchasable) {
    return { purchased: false, reason: plan.reason! };
  }

  const estimatedAssetValueCredits =
    context.property.baseValueCredits > 0
      ? context.property.baseValueCredits
      : plan.priceCredits;

  const settlement = await settleGridFixedPricePurchase(settlementPort, {
    seasonId: command.seasonId,
    idempotencyKey: command.idempotencyKey,
    transactionId: command.idempotencyKey,
    cityId: context.listing.cityId,
    plan,
    estimatedAssetValueCredits,
    transactionTaxBps: GRID_MARKET_LISTING_RULES.transactionTaxBps,
    propertyTradeCooldownMinutes:
      GRID_MARKET_LISTING_RULES.propertyTradeCooldownMinutes,
  });

  return { purchased: true, settlement };
}
