import type {
  GridGetMarketListingInput,
  GridListOpenMarketListingsInput,
  GridMarketListingReadPort,
  GridMarketListingSummary,
} from './market-listing-read-port';

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`Grid market listing discovery requires ${label}`);
  }
}

function requireNow(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('Grid market listing discovery requires a valid now timestamp');
  }
}

export async function listGridOpenMarketListings(
  port: GridMarketListingReadPort,
  input: GridListOpenMarketListingsInput,
): Promise<GridMarketListingSummary[]> {
  requireNonBlank(input.seasonId, 'seasonId');
  requireNonBlank(input.viewerPlayerId, 'viewerPlayerId');
  requireNow(input.now);

  return port.listOpenListings(input);
}

export async function getGridMarketListing(
  port: GridMarketListingReadPort,
  input: GridGetMarketListingInput,
): Promise<GridMarketListingSummary | null> {
  requireNonBlank(input.seasonId, 'seasonId');
  requireNonBlank(input.listingId, 'listingId');
  requireNonBlank(input.viewerPlayerId, 'viewerPlayerId');
  requireNow(input.now);

  return port.getListing(input);
}
