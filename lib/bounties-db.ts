/**
 * Canton Quests — Rivalries & Bounties (Supabase data access)
 * ================================================================
 * Server-only. Reads the existing leaderboard and Player Links ledger —
 * no new table. Reward idempotency reuses reward_grants' event-scoped
 * questless unique index (the same one Player Links and Field NPCs already
 * added), so a player checking their bounty status repeatedly, or two
 * concurrent requests, can never grant the same bounty twice.
 */

import { getLeaderboardDB, insertRewardGrantDB } from './supabase-db';
import { getPlayerOwnLinksDB } from './player-links-db';
import { getPrimaryRivalSignal, RivalSignal } from './rivalries';
import { assignCoreBounty, isBountyComplete, BOUNTY_DEFINITIONS, BountyDefinition, BountyKey } from './bounties';
import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';

export interface BountyProgress {
  bounty: BountyDefinition;
  isComplete: boolean;
  newlyCompleted: boolean;
}

export interface PlayerRivalryStatus {
  rival?: RivalSignal;
  coreBounty: BountyProgress;
  rivalBounty?: BountyProgress;
}

async function grantBountyIfNewlyComplete(eventId: string, playerId: string, bounty: BountyDefinition, isComplete: boolean): Promise<boolean> {
  if (!isComplete || !isSupabaseAdminConfigured || !supabaseAdmin) return false;
  const granted = await insertRewardGrantDB({
    eventId,
    playerId,
    rewardType: 'BOUNTY_COMPLETE',
    rewardKey: `bounty:${bounty.key}`,
    xpAwarded: bounty.rewardXp,
  });
  if (!granted) return false;

  const { data: player } = await supabaseAdmin.from('players').select('total_xp').eq('id', playerId).maybeSingle();
  const nextTotalXp = Math.max(0, (player?.total_xp || 0) + bounty.rewardXp);
  await supabaseAdmin.from('players').update({ total_xp: nextTotalXp, level: Math.floor(nextTotalXp / 250) + 1 }).eq('id', playerId);
  await supabaseAdmin.from('score_ledger').insert({
    event_id: eventId,
    player_id: playerId,
    points: bounty.rewardXp,
    category: 'bounty_complete',
    description: `Bounty complete: ${bounty.title} (+${bounty.rewardXp} XP)`,
  });
  return true;
}

/**
 * The single read-and-settle entry point: computes the player's current
 * rival, their assigned core bounty, and (when a rival exists) the bonus
 * rival-outpacing bounty — checking each for completion and granting XP
 * exactly once the first time this call observes it satisfied.
 */
export async function getPlayerRivalryStatusDB(eventId: string, playerId: string): Promise<PlayerRivalryStatus> {
  const [leaderboard, myLinks] = await Promise.all([getLeaderboardDB(eventId), getPlayerOwnLinksDB(eventId, playerId)]);

  const myEntry = leaderboard.find((e) => e.playerId === playerId);
  const myRank = myEntry?.rank ?? leaderboard.length + 1;
  const myCompletedQuests = myEntry?.questsCompletedCount ?? 0;

  const rival = getPrimaryRivalSignal(leaderboard, playerId);

  const linkPartnerRanks: Record<string, number> = {};
  for (const link of myLinks) {
    const partnerEntry = leaderboard.find((e) => e.playerId === link.otherPlayerId);
    if (partnerEntry) linkPartnerRanks[link.otherPlayerId] = partnerEntry.rank;
  }

  const rivalCompletedQuests = rival ? leaderboard.find((e) => e.playerId === rival.rivalPlayerId)?.questsCompletedCount : undefined;

  const context = { myRank, myLinks, linkPartnerRanks, myCompletedQuests, rivalCompletedQuests };

  const coreBountyDef = assignCoreBounty(playerId, eventId);
  const coreComplete = isBountyComplete(coreBountyDef.key, context);
  const coreNewlyCompleted = await grantBountyIfNewlyComplete(eventId, playerId, coreBountyDef, coreComplete);

  let rivalBounty: BountyProgress | undefined;
  if (rival) {
    const rivalBountyDef = BOUNTY_DEFINITIONS.find((b) => b.key === 'outpace_rival')!;
    const rivalComplete = isBountyComplete('outpace_rival', context);
    const rivalNewlyCompleted = await grantBountyIfNewlyComplete(eventId, playerId, rivalBountyDef, rivalComplete);
    rivalBounty = { bounty: rivalBountyDef, isComplete: rivalComplete, newlyCompleted: rivalNewlyCompleted };
  }

  return {
    rival,
    coreBounty: { bounty: coreBountyDef, isComplete: coreComplete, newlyCompleted: coreNewlyCompleted },
    rivalBounty,
  };
}
