import type { GridPropertyActionPort } from './property-action-port';
import { GRID_MARKET_LISTING_RULES } from './market-listing-rules';
import type { GridMarketSettlementPort } from './market-settlement-port';
import {
  cancelGridFixedPricePropertyListing,
  openGridFixedPricePropertyListing,
} from './market-settlement-service';

export interface GridOpenPlayerMarketListingRequest {
  sellerPlayerId: string;
  propertySlug: string;
  priceCredits: number;
  durationMinutes: number;
  idempotencyKey: string;
  now: string;
}

export interface GridCancelPlayerMarketListingRequest {
  seasonId: string;
  sellerPlayerId: string;
  listingId: string;
  idempotencyKey: string;
  now: string;
}

function requireNonBlank(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Grid market listing action requires ${label}`);
  }
  return normalized;
}

function requireTimestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('Grid market listing action requires a valid now timestamp');
  }
  return parsed;
}

export async function openGridPlayerMarketListing(
  targetPort: GridPropertyActionPort,
  settlementPort: GridMarketSettlementPort,
  request: GridOpenPlayerMarketListingRequest,
) {
  const sellerPlayerId = requireNonBlank(request.sellerPlayerId, 'sellerPlayerId');
  const propertySlug = requireNonBlank(request.propertySlug, 'propertySlug');
  const idempotencyKey = requireNonBlank(
    request.idempotencyKey,
    'a non-empty idempotency key',
  );
  const nowMs = requireTimestamp(request.now);

  if (
    !Number.isSafeInteger(request.priceCredits) ||
    request.priceCredits < GRID_MARKET_LISTING_RULES.minimumPriceCredits ||
    request.priceCredits > GRID_MARKET_LISTING_RULES.maximumPriceCredits
  ) {
    throw new Error(
      'Grid market listing action priceCredits is outside configured bounds',
    );
  }
  if (
    !Number.isSafeInteger(request.durationMinutes) ||
    request.durationMinutes <
      GRID_MARKET_LISTING_RULES.minimumListingDurationMinutes ||
    request.durationMinutes >
      GRID_MARKET_LISTING_RULES.maximumListingDurationMinutes
  ) {
    throw new Error(
      'Grid market listing action durationMinutes is outside configured bounds',
    );
  }

  const durationMs = request.durationMinutes * 60_000;
  if (!Number.isSafeInteger(durationMs)) {
    throw new Error('Grid market listing action durationMinutes is too large');
  }

  const target = await targetPort.resolveTarget(propertySlug);
  if (!target || !['active', 'surge'].includes(target.seasonStatus)) {
    throw new Error(
      'Grid market listing action requires an active season and valid property',
    );
  }

  const listingId = 'fixed:' + idempotencyKey;
  const expiresAt = new Date(nowMs + durationMs).toISOString();

  const result = await openGridFixedPricePropertyListing(settlementPort, {
    seasonId: target.seasonId,
    listingId,
    sellerPlayerId,
    propertyId: target.propertyId,
    priceCredits: request.priceCredits,
    createdAt: request.now,
    expiresAt,
    minimumPriceCredits: GRID_MARKET_LISTING_RULES.minimumPriceCredits,
    maximumPriceCredits: GRID_MARKET_LISTING_RULES.maximumPriceCredits,
    minimumListingDurationMinutes:
      GRID_MARKET_LISTING_RULES.minimumListingDurationMinutes,
    maximumListingDurationMinutes:
      GRID_MARKET_LISTING_RULES.maximumListingDurationMinutes,
    propertyTradeCooldownMinutes:
      GRID_MARKET_LISTING_RULES.propertyTradeCooldownMinutes,
    idempotencyKey,
    now: request.now,
  });

  return {
    listingId: result.listingId,
    propertySlug,
    priceCredits: result.priceCredits,
    createdAt: result.createdAt,
    expiresAt: result.expiresAt,
    status: result.status,
  };
}

export async function cancelGridPlayerMarketListing(
  settlementPort: GridMarketSettlementPort,
  request: GridCancelPlayerMarketListingRequest,
) {
  const seasonId = requireNonBlank(request.seasonId, 'seasonId');
  const sellerPlayerId = requireNonBlank(request.sellerPlayerId, 'sellerPlayerId');
  const listingId = requireNonBlank(request.listingId, 'listingId');
  const idempotencyKey = requireNonBlank(
    request.idempotencyKey,
    'a non-empty idempotency key',
  );
  requireTimestamp(request.now);

  const result = await cancelGridFixedPricePropertyListing(settlementPort, {
    seasonId,
    listingId,
    sellerPlayerId,
    idempotencyKey,
    now: request.now,
  });

  return {
    listingId: result.listingId,
    status: result.status,
    cancelledAt: result.cancelledAt,
  };
}
