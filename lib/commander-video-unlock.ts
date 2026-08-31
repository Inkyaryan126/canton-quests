/**
 * Canton Quests — Founder's Cipher Commander video archive unlock state.
 *
 * Distinct from lib/transmission-viewed-state.ts (concept A, "gameplay
 * viewed state" — a local, per-device UX convenience that suppresses
 * repeat auto-play, never gates anything). This file is concept B,
 * "archive unlocked state" — which numbered videos a player has
 * legitimately *received* in-game, used to lock the transmission archive
 * and the direct /transmissions/[id] page against skipping ahead.
 *
 * Deliberately server-derived from data that already exists — no new
 * database table or column. Each tier below maps 1:1 to a real, already
 * server-tracked signal:
 *
 *   - "entered"  -> an event_players row exists for (player, event)
 *   - "path"     -> players.selected_starting_path (the player's universal
 *                   identity, not this event's own event_players.path
 *                   legacy field) matches the video's path
 *   - "profile"  -> isProfileIdentityComplete(player) (existing helper)
 *   - "xp"       -> progress.totalPoints > 0
 *   - "entries"  -> the player has >=1 row in drawing_entry_ledger
 *   - "quest"    -> progress.completedCount > 0 OR a pending submission
 *                   exists (an honest proxy for "opened a quest" — there is
 *                   no server-tracked "quest detail page viewed" signal
 *                   today, and adding one was judged not worth a schema
 *                   change for a single video; documented here rather than
 *                   silently assumed)
 *
 * Onboarding videos (1,2,3,4,5,9,10) unlock as soon as the player has
 * entered the Mission — they're front-loaded intro content, not
 * progression spoilers, so "have you started" is the right bar. The real
 * spoiler protection is on the milestone videos (6/7/8, 11, 12, 13, 14, 15),
 * each gated by the actual server-verified milestone.
 */

import { StartingPath } from './types';
import {
  getEventParticipationDB,
  getPlayerProgressDB,
  getDrawingEntriesForPlayerDB,
  getPlayerByIdDB,
} from './supabase-db';
import { isProfileIdentityComplete } from './player-command-center';

export interface CommanderVideoUnlockSignals {
  hasEntered: boolean;
  path?: StartingPath | null;
  isProfileComplete: boolean;
  hasXp: boolean;
  hasDrawingEntries: boolean;
  hasQuestActivity: boolean;
}

const ONBOARDING_VIDEO_IDS = [1, 2, 3, 4, 5, 9, 10];
const PATH_VIDEO_ID_BY_PATH: Record<StartingPath, number> = { family: 6, challenge: 7, secret: 8 };

/**
 * Pure decision function — no I/O, easily unit-tested. Takes the signals
 * gathered by getCommanderVideoUnlockSignals() and returns the set of
 * numbered video ids the player has legitimately unlocked.
 */
export function computeUnlockedCommanderVideoIds(signals: CommanderVideoUnlockSignals): Set<number> {
  const unlocked = new Set<number>();
  if (!signals.hasEntered) return unlocked;

  for (const id of ONBOARDING_VIDEO_IDS) unlocked.add(id);

  if (signals.path && PATH_VIDEO_ID_BY_PATH[signals.path]) {
    unlocked.add(PATH_VIDEO_ID_BY_PATH[signals.path]);
  }
  if (signals.isProfileComplete) unlocked.add(11);
  if (signals.hasXp) unlocked.add(12);
  if (signals.hasDrawingEntries) unlocked.add(13);
  if (signals.hasQuestActivity) unlocked.add(14); // leaderboard — a real submitted quest is a real board position
  if (signals.hasQuestActivity) unlocked.add(15);

  return unlocked;
}

/** Gathers the real signals for one player+event from existing data sources. Never throws — an unreadable signal resolves to its locked default. */
export async function getCommanderVideoUnlockSignals(
  playerId: string,
  eventId: string
): Promise<CommanderVideoUnlockSignals> {
  const participation = await getEventParticipationDB(eventId, playerId).catch(() => undefined);
  if (!participation) {
    return {
      hasEntered: false,
      isProfileComplete: false,
      hasXp: false,
      hasDrawingEntries: false,
      hasQuestActivity: false,
    };
  }

  const [progress, entries, player] = await Promise.all([
    getPlayerProgressDB(playerId, eventId).catch(() => undefined),
    getDrawingEntriesForPlayerDB(playerId, eventId).catch(() => []),
    getPlayerByIdDB(playerId).catch(() => undefined),
  ]);

  return {
    hasEntered: true,
    path: player?.selectedStartingPath,
    isProfileComplete: player ? isProfileIdentityComplete(player) : false,
    hasXp: (progress?.totalPoints ?? 0) > 0,
    hasDrawingEntries: entries.length > 0,
    hasQuestActivity: (progress?.completedCount ?? 0) > 0 || (progress?.pendingSubmissionQuestIds?.length ?? 0) > 0,
  };
}

/** Convenience wrapper: signals + decision in one call, for API route use. */
export async function getUnlockedCommanderVideoIds(playerId: string, eventId: string): Promise<Set<number>> {
  const signals = await getCommanderVideoUnlockSignals(playerId, eventId);
  return computeUnlockedCommanderVideoIds(signals);
}
