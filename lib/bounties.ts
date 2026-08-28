/**
 * Canton Quests — Bounties
 * ===========================
 * Safe, in-game-attribute-only side objectives built entirely on top of
 * existing systems (Player Links, the leaderboard) — no new persisted
 * "bounty" table. Assignment is deterministic (a stable hash of player+
 * event picks one bounty from the pool, so the same player always sees the
 * same bounty rather than a new random one every request); completion is
 * checked against real server state and granted exactly once via the
 * existing reward_grants ledger (reward_type BOUNTY_COMPLETE) — see
 * lib/bounties-db.ts.
 *
 * Every bounty target is a PUBLIC in-game attribute only: a starting path,
 * a rank position, a link type, a completed-quest count. None ever
 * reference a real name, email, address, or exact GPS — structurally
 * impossible, since BountyContext below carries none of that data at all.
 */

import { PlayerLinkType } from './player-links';

export type BountyKey = 'cross_path_signal' | 'close_rank_link' | 'group_signal' | 'outpace_rival';

export interface BountyDefinition {
  key: BountyKey;
  title: string;
  description: string;
  rewardXp: number;
  /** True for a bounty that can only ever be offered when a rival currently exists (see lib/rivalries.ts) — not part of the stable core rotation. */
  requiresRival?: boolean;
}

export const BOUNTY_DEFINITIONS: BountyDefinition[] = [
  { key: 'cross_path_signal', title: 'Cross-Path Signal', description: 'Establish a link with a player on a different starting path.', rewardXp: 20 },
  { key: 'close_rank_link', title: 'Close Quarters', description: 'Link with a player ranked within 5 positions of you.', rewardXp: 20 },
  { key: 'group_signal', title: 'Group Signal', description: 'Form a 3-player field link.', rewardXp: 25 },
  { key: 'outpace_rival', title: 'Outpace Your Rival', description: 'Complete more missions than your closest rival.', rewardXp: 15, requiresRival: true },
];

const CORE_BOUNTY_KEYS: BountyKey[] = ['cross_path_signal', 'close_rank_link', 'group_signal'];

/** A stable, non-cryptographic hash — deterministic assignment only, never used for anything security-sensitive. */
function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Always returns the same core bounty for the same (playerId, eventId) pair. */
export function assignCoreBounty(playerId: string, eventId: string): BountyDefinition {
  const index = stableHash(`${playerId}:${eventId}`) % CORE_BOUNTY_KEYS.length;
  const key = CORE_BOUNTY_KEYS[index];
  return BOUNTY_DEFINITIONS.find((b) => b.key === key)!;
}

export interface BountyContext {
  myRank: number;
  myLinks: Array<{ linkType: PlayerLinkType; otherPlayerId: string }>;
  linkPartnerRanks: Record<string, number>;
  myCompletedQuests: number;
  rivalCompletedQuests?: number;
}

export function isBountyComplete(key: BountyKey, ctx: BountyContext): boolean {
  switch (key) {
    case 'cross_path_signal':
      return ctx.myLinks.some((l) => l.linkType === 'DIFFERENT_PATH_LINK');
    case 'close_rank_link':
      return ctx.myLinks.some((l) => {
        const rank = ctx.linkPartnerRanks[l.otherPlayerId];
        return rank !== undefined && Math.abs(rank - ctx.myRank) <= 5;
      });
    case 'group_signal':
      return ctx.myLinks.some((l) => l.linkType === 'GROUP_OBJECTIVE');
    case 'outpace_rival':
      return ctx.rivalCompletedQuests !== undefined && ctx.myCompletedQuests > ctx.rivalCompletedQuests;
    default:
      return false;
  }
}
