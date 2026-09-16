export function isGridScrimmageEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.GRID_FOUNDATION_ENABLED === '1' &&
    env.GRID_SCRIMMAGE_ENABLED === '1'
  );
}
