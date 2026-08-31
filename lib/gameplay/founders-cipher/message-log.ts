/**
 * Canton Quests — Founder's Cipher Commander Text Transmission log.
 *
 * A player should not permanently lose a crucial gameplay message just
 * because they closed the overlay. `archiveWorthy` messages (see
 * lib/gameplay/founders-cipher/types.ts) are appended here so they can be
 * recovered later from the FIELD LOG section of the existing Transmissions
 * archive (app/events/[slug]/transmissions/page.tsx) — reusing that page
 * rather than building a second transmission surface.
 *
 * Deliberately the same kind of client-side, per-device store as
 * lib/transmission-viewed-state.ts (a UX convenience, not a source of
 * truth for any reward/unlock — nothing here gates gameplay). A genuinely
 * server-persisted log is real future scope (see the mission report's
 * "next five" recommendations) but out of scope for this pass — no new
 * schema, no migration, matches the precedent already set by
 * transmission-viewed-state.ts for exactly this tradeoff.
 */

import { ResolvedFounderCipherMessage } from './types';

const STORAGE_KEY = 'canton_quests_founder_cipher_message_log';
const MAX_ENTRIES_PER_PLAYER = 40;

export interface LoggedFounderCipherMessage extends ResolvedFounderCipherMessage {
  loggedAt: number;
}

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readLog(): Record<string, LoggedFounderCipherMessage[]> {
  if (!isClient()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLog(log: Record<string, LoggedFounderCipherMessage[]>): void {
  if (!isClient()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // Best-effort only — never throw over a recoverability convenience.
  }
}

/** Appends a resolved message to this player's field log, if it's marked archiveWorthy. No-ops otherwise. */
export function logFounderCipherMessage(playerId: string | undefined, resolved: ResolvedFounderCipherMessage): void {
  if (!playerId || !resolved.archiveWorthy) return;
  const log = readLog();
  const existing = log[playerId] || [];
  const entry: LoggedFounderCipherMessage = { ...resolved, loggedAt: Date.now() };
  const updated = [entry, ...existing].slice(0, MAX_ENTRIES_PER_PLAYER);
  log[playerId] = updated;
  writeLog(log);
}

/** Returns this player's logged messages, most recent first. */
export function getFounderCipherMessageLog(playerId: string | undefined): LoggedFounderCipherMessage[] {
  if (!playerId) return [];
  return readLog()[playerId] || [];
}
