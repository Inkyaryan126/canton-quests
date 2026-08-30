/**
 * Canton Quests — safe internal-path validation for client-side "return to
 * where you came from" navigation (e.g. the transmission detail page's
 * smart BACK control).
 *
 * Deliberately NOT the same import as lib/supabase-auth.ts's
 * sanitizeRedirectUrl: that module pulls in supabaseAdmin (server-only) and
 * is meant for auth-flow redirects. This file has the same core security
 * property — never accept an absolute URL, protocol-relative URL, or
 * anything that could send a player off Canton Quests — but stays a tiny,
 * pure, client-safe utility so components that only need "is this a real
 * in-app relative path" never bundle the server-only auth module.
 */

/**
 * True only for a same-app relative path: starts with a single `/`, never
 * `//` (protocol-relative → external), and never contains a backslash or
 * null byte (both are ways browsers/servers can be tricked into treating a
 * value as a different origin).
 */
export function isSafeInternalPath(candidate: string | null | undefined): candidate is string {
  if (!candidate || typeof candidate !== 'string') return false;
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  return trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\') && !trimmed.includes('\0');
}

/** Returns `candidate` if it's a safe internal path, otherwise `fallback`. */
export function sanitizeInternalPath(candidate: string | null | undefined, fallback: string): string {
  return isSafeInternalPath(candidate) ? candidate : fallback;
}

/**
 * A short, truthful "BACK TO ___" label for a validated internal path —
 * never a generic pair of competing buttons. Falls back to a plain "BACK"
 * for any path shape not specifically recognized, rather than guessing.
 */
export function getReturnLabelForPath(path: string): string {
  if (/\/rules(\/|\?|$)/.test(path)) return 'BACK TO RULES';
  if (path.startsWith('/leaderboard') || /\/leaderboard(\/|\?|$)/.test(path)) return 'BACK TO LEADERBOARD';
  if (/\/drawing(\/|\?|$)/.test(path)) return 'BACK TO DRAWING';
  if (/\/quests\/[^/?]+/.test(path)) return 'BACK TO QUEST';
  if (/\/quests(\/|\?|$)/.test(path)) return 'BACK TO QUESTS';
  if (/\/transmissions(\/|\?|$)/.test(path) && !/\/transmissions\/\d+/.test(path)) return 'BACK TO TRANSMISSIONS';
  if (path.startsWith('/register')) return 'BACK TO REGISTRATION';
  if (/^\/events\/[^/]+\/?(\?|$)/.test(path)) return 'BACK TO MISSION OVERVIEW';
  return 'BACK';
}
