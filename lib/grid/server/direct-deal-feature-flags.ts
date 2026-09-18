export function isGridDirectDealReadEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GRID_DIRECT_DEAL_READ_ENABLED === '1';
}

export function isGridDirectDealWriteEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GRID_DIRECT_DEAL_WRITE_ENABLED === '1';
}
