export function isGridProgressionRebuildEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GRID_PROGRESSION_REBUILD_ENABLED === '1';
}
