export const GRID_REVISION_DEFAULT_POLL_MS = 5_000;
export const GRID_REVISION_HIDDEN_POLL_MS = 30_000;

const GRID_REVISION_MIN_POLL_MS = 3_000;
const GRID_REVISION_MAX_POLL_MS = 60_000;

export function normalizeGridRevisionPollMs(
  headerValue: string | null,
  fallbackMs = GRID_REVISION_DEFAULT_POLL_MS,
): number {
  const parsed = Number(headerValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.min(
    GRID_REVISION_MAX_POLL_MS,
    Math.max(GRID_REVISION_MIN_POLL_MS, Math.round(parsed)),
  );
}
