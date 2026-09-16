export function isGridFoundationEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.GRID_FOUNDATION_ENABLED === '1';
}

export function isGridWorldReadEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GRID_WORLD_READ_ENABLED === '1';
}
