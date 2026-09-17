import type {
  GridAuctionListing,
  GridAuctionReadPort,
  GridGetActiveAuctionInput,
  GridListActiveAuctionsInput,
} from './auction-read-port';

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`Grid auction discovery requires ${label}`);
  }
}

function requireNow(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('Grid auction discovery requires a valid now timestamp');
  }
}

export async function listGridActiveAuctions(
  port: GridAuctionReadPort,
  input: GridListActiveAuctionsInput,
): Promise<GridAuctionListing[]> {
  requireNonBlank(input.seasonId, 'seasonId');
  requireNonBlank(input.viewerPlayerId, 'viewerPlayerId');
  requireNow(input.now);

  return port.listActiveAuctions(input);
}

export async function getGridActiveAuction(
  port: GridAuctionReadPort,
  input: GridGetActiveAuctionInput,
): Promise<GridAuctionListing | null> {
  requireNonBlank(input.seasonId, 'seasonId');
  requireNonBlank(input.auctionId, 'auctionId');
  requireNonBlank(input.viewerPlayerId, 'viewerPlayerId');
  requireNow(input.now);

  return port.getActiveAuction(input);
}
