export function isGridMarketListingReadEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GRID_MARKET_LISTING_READ_ENABLED === '1';
}

export function isGridMarketListingWriteEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GRID_MARKET_LISTING_WRITE_ENABLED === '1';
}
