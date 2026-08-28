/**
 * Canton Quests — Rivalries
 * ============================
 * Purely computed from the existing leaderboard (lib/supabase-db.ts's
 * getLeaderboardDB) — no new table, no persisted state. A rivalry is
 * "close rank + close XP," nothing more: LeaderboardEntry carries no
 * location data at all, so a rival signal structurally cannot reveal where
 * anyone is. Only displayName/rank/XP gap are ever surfaced — never an
 * exact live position, never a push toward finding someone in person.
 */

import { LeaderboardEntry } from './types';

export interface RivalSignal {
  rivalPlayerId: string;
  rivalDisplayName: string;
  rivalRank: number;
  xpGap: number;
  /** 'behind_you' = the rival is closing in from a lower rank; 'ahead_of_you' = you're closing in on them. */
  direction: 'behind_you' | 'ahead_of_you';
}

const DEFAULT_RIVAL_THRESHOLD_XP = 40;

/**
 * A player's current rival signals: the entry immediately above them (if
 * close enough in XP — "you're closing in") and the entry immediately
 * below them (if close enough — "someone's closing in on you"). Either,
 * both, or neither may apply. Never more than one rival per direction —
 * this is about immediate neighbors on the board, not a broader radius.
 */
export function computeRivalSignals(
  leaderboard: LeaderboardEntry[],
  playerId: string,
  thresholdXp: number = DEFAULT_RIVAL_THRESHOLD_XP
): RivalSignal[] {
  const sorted = [...leaderboard].sort((a, b) => a.rank - b.rank);
  const index = sorted.findIndex((e) => e.playerId === playerId);
  if (index === -1) return [];

  const me = sorted[index];
  const signals: RivalSignal[] = [];

  const above = index > 0 ? sorted[index - 1] : undefined;
  if (above) {
    const gap = me.totalPoints - above.totalPoints;
    if (Math.abs(gap) <= thresholdXp) {
      signals.push({ rivalPlayerId: above.playerId, rivalDisplayName: above.displayName, rivalRank: above.rank, xpGap: Math.abs(gap), direction: 'ahead_of_you' });
    }
  }

  const below = index < sorted.length - 1 ? sorted[index + 1] : undefined;
  if (below) {
    const gap = me.totalPoints - below.totalPoints;
    if (Math.abs(gap) <= thresholdXp) {
      signals.push({ rivalPlayerId: below.playerId, rivalDisplayName: below.displayName, rivalRank: below.rank, xpGap: Math.abs(gap), direction: 'behind_you' });
    }
  }

  return signals;
}

/** The single "closing in" signal worth surfacing prominently — the tightest gap, if any. Rank ties (gap 0) always count as a live rival. */
export function getPrimaryRivalSignal(leaderboard: LeaderboardEntry[], playerId: string, thresholdXp?: number): RivalSignal | undefined {
  const signals = computeRivalSignals(leaderboard, playerId, thresholdXp);
  if (signals.length === 0) return undefined;
  return [...signals].sort((a, b) => a.xpGap - b.xpGap)[0];
}
