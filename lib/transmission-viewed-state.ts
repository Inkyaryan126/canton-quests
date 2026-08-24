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
 * callers should pass `trigger: 'gm_announcement'` straight to
 * showGameMoment without checking `hasViewedTransmission` first, so an
 * urgent broadcast always reaches the player regardless of past state.
 */

import { CommanderTransmissionTrigger } from './game-effects';

const STORAGE_KEY = 'canton_quests_viewed_transmissions';

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function transmissionKey(playerId: string | undefined, trigger: CommanderTransmissionTrigger, subjectKey: string): string {
  return `${playerId || 'anon'}:${trigger}:${subjectKey}`;
}

function readViewedSet(): Set<string> {
  if (!isClient()) return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function writeViewedSet(set: Set<string>): void {
  if (!isClient()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
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
  return readViewedSet().has(transmissionKey(playerId, trigger, subjectKey));
}

/** Records that this player has now seen this transmission. */
export function markTransmissionViewed(
  trigger: CommanderTransmissionTrigger,
  subjectKey: string,
  playerId?: string
): void {
  const set = readViewedSet();
  set.add(transmissionKey(playerId, trigger, subjectKey));
  writeViewedSet(set);
}

/**
 * Whether a transmission should auto-show right now: GM announcements
 * always auto-show (they can override normal viewed-state behavior);
 * anything explicitly `replayable` still only *auto*-shows on first view —
 * replayability controls whether a manual "Replay Transmission" control is
 * offered afterward, not whether it forces itself again automatically.
 */
export function shouldAutoShowTransmission(
  trigger: CommanderTransmissionTrigger,
  subjectKey: string,
  playerId?: string
): boolean {
  if (trigger === 'gm_announcement') return true;
  return !hasViewedTransmission(trigger, subjectKey, playerId);
}
