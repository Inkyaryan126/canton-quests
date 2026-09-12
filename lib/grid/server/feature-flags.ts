export function isGridFoundationEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.GRID_FOUNDATION_ENABLED === '1';
}
