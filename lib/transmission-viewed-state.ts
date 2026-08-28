/**
 * Canton Quests — Commander Transmission Viewed-State
 *
 * Purely a UX convenience ("don't force the same quest-intro transmission
 * on the player every time they reopen the quest") — nothing here gates a
 * reward, unlock, or any server decision, so a client-side, per-device
 * store is an appropriate (not "unsafe client-only") place for it, the
 * same way sound preference already lives in localStorage
 * (canton_effects_muted / cq_sound_enabled — see lib/game-effects.ts).
 *
 * GM live/emergency announcements intentionally never consult this store —
 * callers should pass `trigger: 'gm_announcement'` or `'emergency'` straight
 * to showGameMoment without checking `hasViewedTransmission` first, so an
 * urgent broadcast always reaches the player regardless of past state.
 *
 * Storage is keyed timestamps (not a bare seen/unseen flag) so the
 * Contextual Transmission Engine (lib/contextual-transmissions.ts) can layer
 * a cooldown window on top of the same store, for triggers that are allowed
 * to repeat but not too often (e.g. a repeatable city_event announcement).
 * A record written by the pre-cooldown version of this file (a plain array
 * of key strings) is still read correctly — each such entry is treated as
 * "seen a long time ago" so it never blocks on a cooldown check.
 */

import { CommanderTransmissionTrigger } from './game-effects';

const STORAGE_KEY = 'canton_quests_viewed_transmissions';

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function transmissionKey(playerId: string | undefined, trigger: CommanderTransmissionTrigger, subjectKey: string): string {
  return `${playerId || 'anon'}:${trigger}:${subjectKey}`;
}

function readViewedMap(): Map<string, number> {
  if (!isClient()) return new Map();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Legacy shape (a bare array of keys, no timestamps) — treat every
      // entry as seen at the epoch so it reads as "viewed" but never active
      // under any real cooldown window.
      return new Map(parsed.map((key: string) => [key, 0]));
    }
    if (parsed && typeof parsed === 'object') {
      return new Map(Object.entries(parsed).map(([key, value]) => [key, typeof value === 'number' ? value : 0]));
    }
    return new Map();
  } catch {
    return new Map();
  }
}

function writeViewedMap(map: Map<string, number>): void {
  if (!isClient()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {
    // Fallback — best-effort only, never throw over a UX convenience store.
  }
}

/**
 * Has this player already seen this specific transmission (identified by
 * trigger + a stable subject key, typically a quest id)? Always false on
 * the server / before hydration.
 */
export function hasViewedTransmission(
  trigger: CommanderTransmissionTrigger,
  subjectKey: string,
  playerId?: string
): boolean {
  return readViewedMap().has(transmissionKey(playerId, trigger, subjectKey));
}

/** The timestamp (ms since epoch) this player last saw this transmission, or undefined if never. */
export function getLastShownAt(
  trigger: CommanderTransmissionTrigger,
  subjectKey: string,
  playerId?: string
): number | undefined {
  return readViewedMap().get(transmissionKey(playerId, trigger, subjectKey));
}

/** Records that this player has now seen this transmission, stamped with the current time. */
export function markTransmissionViewed(
  trigger: CommanderTransmissionTrigger,
  subjectKey: string,
  playerId?: string
): void {
  const map = readViewedMap();
  map.set(transmissionKey(playerId, trigger, subjectKey), Date.now());
  writeViewedMap(map);
}

/**
 * Whether a transmission should auto-show right now: GM/emergency
 * announcements always auto-show (they override normal viewed-state
 * behavior); anything explicitly `replayable` still only *auto*-shows on
 * first view — replayability controls whether a manual "Replay
 * Transmission" control is offered afterward, not whether it forces itself
 * again automatically.
 */
export function shouldAutoShowTransmission(
  trigger: CommanderTransmissionTrigger,
  subjectKey: string,
  playerId?: string
): boolean {
  if (trigger === 'gm_announcement' || trigger === 'emergency') return true;
  return !hasViewedTransmission(trigger, subjectKey, playerId);
}

/**
 * Whether this (trigger, subjectKey, player) is still within a cooldown
 * window from its last showing — for a repeatable trigger (onceParPlayer:
 * false) that should still be throttled rather than firing on every single
 * poll. A trigger never shown before is never on cooldown. `now` is
 * injectable for tests; real callers always pass Date.now() (or omit it).
 */
export function hasActiveCooldown(
  trigger: CommanderTransmissionTrigger,
  subjectKey: string,
  cooldownMs: number,
  playerId?: string,
  now: number = Date.now()
): boolean {
  const lastShownAt = getLastShownAt(trigger, subjectKey, playerId);
  if (lastShownAt === undefined) return false;
  return now - lastShownAt < cooldownMs;
}
