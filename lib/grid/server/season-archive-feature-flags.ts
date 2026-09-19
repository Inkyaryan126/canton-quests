export function isGridSeasonArchiveEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GRID_SEASON_ARCHIVE_ENABLED === '1';
}
