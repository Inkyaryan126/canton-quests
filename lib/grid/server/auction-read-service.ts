import type {
  GridAuctionListing,
  GridAuctionReadPort,
  GridListActiveAuctionsInput,
} from './auction-read-port';

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`Grid auction discovery requires ${label}`);
  }
}

export async function listGridActiveAuctions(
  port: GridAuctionReadPort,
  input: GridListActiveAuctionsInput,
): Promise<GridAuctionListing[]> {
  requireNonBlank(input.seasonId, 'seasonId');
  requireNonBlank(input.viewerPlayerId, 'viewerPlayerId');

  if (!Number.isFinite(Date.parse(input.now))) {
    throw new Error('Grid auction discovery requires a valid now timestamp');
  }

  return port.listActiveAuctions(input);
}
