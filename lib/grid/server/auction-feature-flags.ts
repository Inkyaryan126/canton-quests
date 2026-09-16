export function isGridAuctionReadEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GRID_AUCTION_READ_ENABLED === '1';
}

export function isGridAuctionWriteEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GRID_AUCTION_WRITE_ENABLED === '1';
}
