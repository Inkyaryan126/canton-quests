/**
 * Canton Quests — Player Links (Supabase data access)
 * ======================================================
 * Server-only. Every write uses supabaseAdmin. Anti-farming is enforced by
 * reward_grants' own idempotency (insertRewardGrantDB, reused unchanged
 * from lib/supabase-db.ts) — a duplicate reward-grant insert hits Postgres
 * 23505 and is treated as "already earned," exactly like every other
 * reward path in this codebase. The player_links row itself is still
 * written every time (it's a real, potentially-recurring interaction worth
 * logging for aggregate stats), but XP is only ever paid once per
 * (player, event, link_type, pair).
 */

import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';
import {
  PlayerLinkType,
  PLAYER_LINK_CONFIG,
  computePairKey,
  computeLinkRewardKey,
  validatePlayerLinkEligibility,
  PlayerLinkEligibility,
} from './player-links';
import { getEventParticipationDB, insertRewardGrantDB } from './supabase-db';
import { propagateSignalCarrierDB } from './personal-roles-db';

function isMissingTable(error: any): boolean {
  return error?.code === '42P01' || /relation .* does not exist/i.test(error?.message || '');
}

export interface CreatePlayerLinkResult {
  eligibility: PlayerLinkEligibility;
  linkId?: string;
  /** True only when this exact (pair, link_type) had never been rewarded before this call. */
  newlyRewarded: boolean;
  xpAwarded: number;
  /** Set to the player id who newly caught the Signal Carrier role from this link, if propagation occurred (lib/personal-roles-db.ts). */
  signalPropagatedTo?: string;
}

/**
 * The single entry point for establishing a link — validates eligibility,
 * records the occurrence, and grants XP to BOTH players exactly once per
 * pair+type, ever, for this event. Concurrency-safe: two simultaneous
 * identical requests both attempt the reward_grants insert; exactly one
 * wins per player, the other observes 23505 and reports newlyRewarded:
 * false without double-paying.
 */
export async function createPlayerLinkDB(params: {
  eventId: string;
  linkType: PlayerLinkType;
  initiatorId: string;
  targetId: string;
}): Promise<CreatePlayerLinkResult> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { eligibility: { ok: false, reason: 'not_in_event', message: 'Live linking requires Supabase configuration.' }, newlyRewarded: false, xpAwarded: 0 };
  }

  const [initiatorParticipation, targetParticipation] = await Promise.all([
    getEventParticipationDB(params.eventId, params.initiatorId),
    getEventParticipationDB(params.eventId, params.targetId),
  ]);

  const eligibility = validatePlayerLinkEligibility({
    linkType: params.linkType,
    initiatorId: params.initiatorId,
    targetId: params.targetId,
    initiatorInEvent: !!initiatorParticipation,
    targetInEvent: !!targetParticipation,
    initiatorPath: initiatorParticipation?.path,
    targetPath: targetParticipation?.path,
  });
  if (!eligibility.ok) return { eligibility, newlyRewarded: false, xpAwarded: 0 };

  const pairKey = computePairKey(params.initiatorId, params.targetId);
  const rewardKey = computeLinkRewardKey(params.linkType, pairKey);
  const xpAwarded = PLAYER_LINK_CONFIG[params.linkType].xpAwarded;

  const { data: linkRow, error: linkError } = await supabaseAdmin
    .from('player_links')
    .insert({
      event_id: params.eventId,
      link_type: params.linkType,
      player_a_id: params.initiatorId,
      player_b_id: params.targetId,
      pair_key: pairKey,
      initiated_by_player_id: params.initiatorId,
    })
    .select('id')
    .single();
  if (linkError) {
    if (isMissingTable(linkError)) return { eligibility, newlyRewarded: false, xpAwarded: 0 };
    throw new Error(`Failed to record player link: ${linkError.message}`);
  }

  // Signal Carrier propagation (lib/personal-roles-db.ts) — a real link
  // just happened, so this is the one place carrying status can spread.
  // Never fails the link itself over a propagation error; this is
  // additive game flavor on top of an already-recorded interaction.
  let signalPropagatedTo: string | undefined;
  try {
    const propagation = await propagateSignalCarrierDB(params.eventId, params.initiatorId, params.targetId);
    signalPropagatedTo = propagation.propagatedTo;
  } catch {
    // Non-fatal.
  }

  let newlyRewarded = false;
  for (const playerId of [params.initiatorId, params.targetId]) {
    const granted = await insertRewardGrantDB({
      eventId: params.eventId,
      playerId,
      rewardType: 'PLAYER_LINK',
      rewardKey,
      xpAwarded,
    });
    if (granted) {
      newlyRewarded = true;
      const { data: player } = await supabaseAdmin.from('players').select('total_xp').eq('id', playerId).maybeSingle();
      const nextTotalXp = Math.max(0, (player?.total_xp || 0) + xpAwarded);
      await supabaseAdmin.from('players').update({ total_xp: nextTotalXp, level: Math.floor(nextTotalXp / 250) + 1 }).eq('id', playerId);
      await supabaseAdmin.from('score_ledger').insert({
        event_id: params.eventId,
        player_id: playerId,
        points: xpAwarded,
        category: 'player_link',
        description: `${PLAYER_LINK_CONFIG[params.linkType].label} (+${xpAwarded} XP)`,
      });
    }
  }

  return { eligibility, linkId: linkRow?.id, newlyRewarded, xpAwarded: newlyRewarded ? xpAwarded : 0, signalPropagatedTo };
}

/**
 * A GROUP_OBJECTIVE link — every distinct pairwise combination among the
 * given players is recorded and rewarded independently, tagged with a
 * shared group_id. Requires at least 3 distinct players (see
 * PLAYER_LINK_CONFIG.GROUP_OBJECTIVE.requiresGroup).
 */
export async function createGroupPlayerLinkDB(params: {
  eventId: string;
  initiatorId: string;
  playerIds: string[];
}): Promise<{ groupId?: string; results: CreatePlayerLinkResult[] }> {
  const uniqueIds = [...new Set(params.playerIds)];
  if (uniqueIds.length < 3) {
    return { results: [{ eligibility: { ok: false, reason: 'not_in_event', message: 'A group link requires at least 3 distinct players.' }, newlyRewarded: false, xpAwarded: 0 }] };
  }
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { results: [] };

  const groupId = crypto.randomUUID();
  const results: CreatePlayerLinkResult[] = [];
  for (let i = 0; i < uniqueIds.length; i++) {
    for (let j = i + 1; j < uniqueIds.length; j++) {
      const result = await createPlayerLinkDB({ eventId: params.eventId, linkType: 'GROUP_OBJECTIVE', initiatorId: uniqueIds[i], targetId: uniqueIds[j] });
      results.push(result);
    }
  }
  return { groupId, results };
}

/** Safe aggregate-only stats — no per-player identity. Reused by the Community/City State projection (Mission 3). */
export async function getPlayerLinkStatsDB(eventId: string): Promise<{ totalLinks: number }> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { totalLinks: 0 };
  const { count, error } = await supabaseAdmin.from('player_links').select('id', { count: 'exact', head: true }).eq('event_id', eventId);
  if (error) {
    if (isMissingTable(error)) return { totalLinks: 0 };
    return { totalLinks: 0 };
  }
  return { totalLinks: count || 0 };
}

/** A player's own link history — used by their profile/roster view, never by another player looking them up. */
export async function getPlayerOwnLinksDB(eventId: string, playerId: string): Promise<Array<{ id: string; linkType: PlayerLinkType; otherPlayerId: string; createdAt: string }>> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from('player_links')
    .select('id, link_type, player_a_id, player_b_id, created_at')
    .eq('event_id', eventId)
    .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    linkType: row.link_type,
    otherPlayerId: row.player_a_id === playerId ? row.player_b_id : row.player_a_id,
    createdAt: row.created_at,
  }));
}
