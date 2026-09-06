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
 *
 * Real false positives observed on the first overnight run, all fixed by
 * the combination of changes here + the exit-code gating in each adapter
 * (see codexAdapter.ts/claudeAdapter.ts/agyAdapter.ts) + the retry probe in
 * supervisor.ts:
 *   - Astra's own transcript quoted BOARDROOM.md's documentation of these
 *     very patterns ("usage limit", "rate limit", "quota exceeded",
 *     "weekly limit", "429") while reading the file as required reading —
 *     matched every single phrase in this list purely from Astra's own
 *     SUCCESSFUL output. Fixed primarily by exit-code gating (a clean exit
 *     is never scanned at all), not by the patterns themselves.
 *   - The bare digit sequence "429" matched inside an unrelated large
 *     number (`"input_tokens":1034296`) in Agy's own JSON usage-stats
 *     field, and separately inside `cat -n`-style line-number prefixes in
 *     Astra's transcript (e.g. a tool read landing on line 429 of a file).
 *     Fixed by requiring "429" to be its own token, not a substring of a
 *     larger digit run.
 *   - A genuine Claude 429 ("You've hit your session limit · resets
 *     4:40am") was real, but Boardroom's response (permanent unavailability
 *     for the rest of the run, no re-check) was too aggressive for what
 *     looks like a short session-level throttle rather than the account's
 *     real usage allowance — see supervisor.ts's post-detection probe.
 */

const EXHAUSTION_PATTERNS: RegExp[] = [
  /usage limit/i,
  /rate limit/i,
  /quota exceeded/i,
  /quota has been exceeded/i,
  /weekly limit/i,
  /5-hour limit/i,
  /hour limit reached/i,
  /you.?ve hit your (?:session|usage|plan) limit/i,
  /reached your (usage|plan) limit/i,
  /please upgrade your plan/i,
  /too many requests/i,
  /\b429\b/, // standalone HTTP status token only — NOT a substring of a larger number (see file header)
];

export function looksLikeUsageExhaustion(text: string): boolean {
  if (!text) return false;
  return EXHAUSTION_PATTERNS.some((pattern) => pattern.test(text));
}

export const EXHAUSTION_PATTERNS_FOR_TESTS = EXHAUSTION_PATTERNS;

/**
 * Structured detection for adapters whose CLI emits real JSON (claude/agy
 * via --output-format json). Far more precise than text-scanning: it never
 * looks at free-text fields at all (usage stats, tool-call transcripts,
 * an agent's own prose about "rate limiting" as an engineering topic),
 * only the CLI's own explicit error signal. Returns null when `raw` isn't
 * parseable JSON or doesn't carry a recognizable error-status field, so the
 * caller can fall back to text patterns instead of assuming "not exhausted".
 */
export function structuredExhaustionSignal(raw: string): boolean | null {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const apiErrorStatus = parsed.api_error_status;
  const isError = parsed.is_error === true;
  if (typeof apiErrorStatus !== 'number') return null;

  if (isError && (apiErrorStatus === 429 || apiErrorStatus === 529)) return true;
  return false;
}
