import type {
  GridFixedPriceCancellationDecision,
  GridFixedPriceListingOpenDecision,
  GridFixedPriceListingProjectedStatus,
  GridFixedPriceListingRequest,
  GridFixedPriceListingRules,
  GridFixedPriceListingState,
  GridFixedPricePurchasePlan,
  GridMarketAssetSnapshot,
  GridMarketBuyerSnapshot,
} from './market-listing-types';

const BASIS_POINTS = 10_000;

function requireNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function requirePositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function parseTimestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid timestamp`);
  }
  return parsed;
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds safe integer range`);
  }
  return result;
}

function cooldownReason(
  asset: GridMarketAssetSnapshot,
  rules: GridFixedPriceListingRules,
  nowMs: number,
):
  | 'property-cooldown-unverifiable'
  | 'property-cooldown-active'
  | null {
  if (asset.kind !== 'property' || rules.propertyTradeCooldownMinutes === 0) {
    return null;
  }
  if (!asset.acquiredAt) return 'property-cooldown-unverifiable';

  const acquiredAtMs = Date.parse(asset.acquiredAt);
  if (!Number.isFinite(acquiredAtMs)) {
    return 'property-cooldown-unverifiable';
  }

  const cooldownMs = rules.propertyTradeCooldownMinutes * 60_000;
  return nowMs < acquiredAtMs + cooldownMs
    ? 'property-cooldown-active'
    : null;
}

export function validateGridFixedPriceListingRules(
  rules: GridFixedPriceListingRules,
): void {
  requireNonNegativeSafeInteger(rules.transactionTaxBps, 'transactionTaxBps');
  if (rules.transactionTaxBps > BASIS_POINTS) {
    throw new Error('transactionTaxBps cannot exceed 10000 basis points');
  }

  requireNonNegativeSafeInteger(
    rules.propertyTradeCooldownMinutes,
    'propertyTradeCooldownMinutes',
  );
  if (!Number.isSafeInteger(rules.propertyTradeCooldownMinutes * 60_000)) {
    throw new Error('propertyTradeCooldownMinutes is too large');
  }

  requirePositiveSafeInteger(rules.minimumPriceCredits, 'minimumPriceCredits');
  requirePositiveSafeInteger(rules.maximumPriceCredits, 'maximumPriceCredits');
  if (rules.maximumPriceCredits < rules.minimumPriceCredits) {
    throw new Error('maximumPriceCredits must be at least minimumPriceCredits');
  }

  requirePositiveSafeInteger(
    rules.minimumListingDurationMinutes,
    'minimumListingDurationMinutes',
  );
  requirePositiveSafeInteger(
    rules.maximumListingDurationMinutes,
    'maximumListingDurationMinutes',
  );
  if (
    rules.maximumListingDurationMinutes < rules.minimumListingDurationMinutes
  ) {
    throw new Error(
      'maximumListingDurationMinutes must be at least minimumListingDurationMinutes',
    );
  }
  if (
    !Number.isSafeInteger(rules.maximumListingDurationMinutes * 60_000)
  ) {
    throw new Error('maximumListingDurationMinutes is too large');
  }
}

export function calculateGridFixedPriceListingTax(
  priceCredits: number,
  rules: GridFixedPriceListingRules,
): number {
  validateGridFixedPriceListingRules(rules);
  requireNonNegativeSafeInteger(priceCredits, 'priceCredits');

  return Number(
    (BigInt(priceCredits) * BigInt(rules.transactionTaxBps)) /
      BigInt(BASIS_POINTS),
  );
}

export function openGridFixedPriceListing(
  request: GridFixedPriceListingRequest,
  asset: GridMarketAssetSnapshot,
  rules: GridFixedPriceListingRules,
): GridFixedPriceListingOpenDecision {
  validateGridFixedPriceListingRules(rules);

  for (const [label, value] of [
    ['listingId', request.listingId],
    ['cityId', request.cityId],
    ['sellerPlayerId', request.sellerPlayerId],
    ['sellerCityId', request.sellerCityId],
    ['assetId', request.assetId],
  ] as const) {
    if (!value.trim()) {
      throw new Error(`Grid fixed-price listing requires ${label}`);
    }
  }

  requireNonNegativeSafeInteger(request.priceCredits, 'priceCredits');

  const createdAtMs = parseTimestamp(request.createdAt, 'createdAt');
  const expiresAtMs = parseTimestamp(request.expiresAt, 'expiresAt');
  if (expiresAtMs <= createdAtMs) {
    throw new Error('Grid fixed-price listing expiresAt must be after createdAt');
  }

  if (
    request.cityId !== request.sellerCityId ||
    asset.cityId !== request.cityId
  ) {
    return { accepted: false, reason: 'city-mismatch' };
  }
  if (asset.assetId !== request.assetId) {
    return { accepted: false, reason: 'asset-mismatch' };
  }
  if (asset.ownerPlayerId !== request.sellerPlayerId) {
    return { accepted: false, reason: 'asset-owner-mismatch' };
  }
  if (!asset.tradable) {
    return { accepted: false, reason: 'asset-not-tradable' };
  }
  if (asset.majorLandmark) {
    return { accepted: false, reason: 'major-landmark' };
  }
  if (
    request.priceCredits < rules.minimumPriceCredits ||
    request.priceCredits > rules.maximumPriceCredits
  ) {
    return { accepted: false, reason: 'price-out-of-range' };
  }

  const durationMs = expiresAtMs - createdAtMs;
  const minimumDurationMs = rules.minimumListingDurationMinutes * 60_000;
  const maximumDurationMs = rules.maximumListingDurationMinutes * 60_000;
  if (durationMs < minimumDurationMs || durationMs > maximumDurationMs) {
    return { accepted: false, reason: 'duration-out-of-range' };
  }

  const cooldown = cooldownReason(asset, rules, createdAtMs);
  if (cooldown) {
    return { accepted: false, reason: cooldown };
  }

  return {
    accepted: true,
    listing: {
      listingId: request.listingId,
      cityId: request.cityId,
      sellerPlayerId: request.sellerPlayerId,
      assetId: request.assetId,
      assetKind: asset.kind,
      priceCredits: request.priceCredits,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
      status: 'open',
    },
  };
}

export function projectGridFixedPriceListingStatus(
  listing: GridFixedPriceListingState,
  now: string,
): GridFixedPriceListingProjectedStatus {
  const nowMs = parseTimestamp(now, 'now');
  const createdAtMs = parseTimestamp(listing.createdAt, 'createdAt');
  const expiresAtMs = parseTimestamp(listing.expiresAt, 'expiresAt');

  if (expiresAtMs <= createdAtMs) {
    throw new Error('Grid fixed-price listing expiresAt must be after createdAt');
  }
  if (listing.status !== 'open') return listing.status;
  if (nowMs < createdAtMs) return 'scheduled';
  if (nowMs >= expiresAtMs) return 'expired';
  return 'open';
}

function rejectPurchase(
  listing: GridFixedPriceListingState,
  buyer: GridMarketBuyerSnapshot,
  purchasedAt: string,
  reason: GridFixedPricePurchasePlan['reason'],
): GridFixedPricePurchasePlan {
  return {
    purchasable: false,
    reason,
    listingId: listing.listingId,
    purchasedAt,
    buyerPlayerId: buyer.playerId,
    sellerPlayerId: listing.sellerPlayerId,
    priceCredits: listing.priceCredits,
    taxCredits: 0,
    buyerTotalDebitCredits: 0,
    buyerCreditDelta: 0,
    sellerCreditDelta: 0,
    nextListing: listing,
  };
}

export function planGridFixedPricePurchase(
  listing: GridFixedPriceListingState,
  buyer: GridMarketBuyerSnapshot,
  asset: GridMarketAssetSnapshot,
  rules: GridFixedPriceListingRules,
  purchasedAt: string,
): GridFixedPricePurchasePlan {
  validateGridFixedPriceListingRules(rules);

  if (!buyer.playerId.trim()) {
    throw new Error('Grid fixed-price purchase requires buyer.playerId');
  }
  if (!buyer.cityId.trim()) {
    throw new Error('Grid fixed-price purchase requires buyer.cityId');
  }
  requireNonNegativeSafeInteger(buyer.creditBalance, 'buyer.creditBalance');

  const purchasedAtMs = parseTimestamp(purchasedAt, 'purchasedAt');
  const projectedStatus = projectGridFixedPriceListingStatus(
    listing,
    purchasedAt,
  );

  if (listing.status !== 'open') {
    return rejectPurchase(
      listing,
      buyer,
      purchasedAt,
      'listing-not-open',
    );
  }
  if (projectedStatus !== 'open') {
    return rejectPurchase(
      listing,
      buyer,
      purchasedAt,
      'outside-listing-window',
    );
  }
  if (buyer.playerId === listing.sellerPlayerId) {
    return rejectPurchase(listing, buyer, purchasedAt, 'seller-cannot-buy');
  }
  if (buyer.cityId !== listing.cityId || asset.cityId !== listing.cityId) {
    return rejectPurchase(listing, buyer, purchasedAt, 'city-mismatch');
  }
  if (asset.assetId !== listing.assetId || asset.kind !== listing.assetKind) {
    return rejectPurchase(listing, buyer, purchasedAt, 'asset-mismatch');
  }
  if (asset.ownerPlayerId !== listing.sellerPlayerId) {
    return rejectPurchase(
      listing,
      buyer,
      purchasedAt,
      'asset-owner-mismatch',
    );
  }
  if (!asset.tradable) {
    return rejectPurchase(
      listing,
      buyer,
      purchasedAt,
      'asset-not-tradable',
    );
  }
  if (asset.majorLandmark) {
    return rejectPurchase(listing, buyer, purchasedAt, 'major-landmark');
  }

  const cooldown = cooldownReason(asset, rules, purchasedAtMs);
  if (cooldown) {
    return rejectPurchase(listing, buyer, purchasedAt, cooldown);
  }

  const taxCredits = calculateGridFixedPriceListingTax(
    listing.priceCredits,
    rules,
  );
  const buyerTotalDebitCredits = checkedAdd(
    listing.priceCredits,
    taxCredits,
    'buyerTotalDebitCredits',
  );

  if (buyer.creditBalance < buyerTotalDebitCredits) {
    return rejectPurchase(
      listing,
      buyer,
      purchasedAt,
      'insufficient-credits',
    );
  }

  const nextBuyerBalance = buyer.creditBalance - buyerTotalDebitCredits;
  if (!Number.isSafeInteger(nextBuyerBalance)) {
    throw new Error('buyer post-purchase balance exceeds safe integer range');
  }

  return {
    purchasable: true,
    listingId: listing.listingId,
    purchasedAt,
    buyerPlayerId: buyer.playerId,
    sellerPlayerId: listing.sellerPlayerId,
    priceCredits: listing.priceCredits,
    taxCredits,
    buyerTotalDebitCredits,
    buyerCreditDelta: -buyerTotalDebitCredits,
    sellerCreditDelta: listing.priceCredits,
    assetTransfer: {
      assetId: listing.assetId,
      kind: listing.assetKind,
      fromPlayerId: listing.sellerPlayerId,
      toPlayerId: buyer.playerId,
    },
    nextListing: {
      ...listing,
      status: 'sold',
      buyerPlayerId: buyer.playerId,
      soldAt: purchasedAt,
    },
  };
}

export function cancelGridFixedPriceListing(
  listing: GridFixedPriceListingState,
  actorPlayerId: string,
  cancelledAt: string,
): GridFixedPriceCancellationDecision {
  if (!actorPlayerId.trim()) {
    throw new Error('Grid fixed-price cancellation requires actorPlayerId');
  }

  const projectedStatus = projectGridFixedPriceListingStatus(
    listing,
    cancelledAt,
  );

  if (listing.status !== 'open') {
    return {
      cancelled: false,
      reason: 'listing-not-open',
      nextListing: listing,
    };
  }
  if (projectedStatus !== 'open') {
    return {
      cancelled: false,
      reason: 'outside-listing-window',
      nextListing: listing,
    };
  }
  if (actorPlayerId !== listing.sellerPlayerId) {
    return {
      cancelled: false,
      reason: 'seller-only',
      nextListing: listing,
    };
  }

  return {
    cancelled: true,
    nextListing: {
      ...listing,
      status: 'cancelled',
      cancelledAt,
    },
  };
}
