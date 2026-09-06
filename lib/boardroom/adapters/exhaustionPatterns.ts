/**
 * Canton Quests Boardroom V2 — best-effort usage-exhaustion detection.
 *
 * None of codex/claude/agy expose a real "remaining usage" API (verified —
 * see boardroom/BOARDROOM.md). This is a documented, shared regex list
 * used by every adapter to flag a run as *likely* exhausted from its
 * captured output text. This is HIGH_CONFIDENCE at best, never VERIFIED —
 * a real bug producing similar wording could be misclassified, which is
 * exactly why the two-failed-attempt rule exists as a second, independent
 * safety net regardless of what this function concludes.
 */

const EXHAUSTION_PATTERNS: RegExp[] = [
  /usage limit/i,
  /rate limit/i,
  /quota exceeded/i,
  /quota has been exceeded/i,
  /weekly limit/i,
  /5-hour limit/i,
  /hour limit reached/i,
  /you.?ve hit your/i,
  /reached your (usage|plan) limit/i,
  /please upgrade your plan/i,
  /too many requests/i,
  /429/, // common HTTP status text for rate limiting surfaced in CLI error output
];

export function looksLikeUsageExhaustion(text: string): boolean {
  if (!text) return false;
  return EXHAUSTION_PATTERNS.some((pattern) => pattern.test(text));
}

export const EXHAUSTION_PATTERNS_FOR_TESTS = EXHAUSTION_PATTERNS;
