/**
 * Canton Quests — Watchers Foundation (Supabase data access)
 * ===============================================================
 * Server-only. Every read is scoped to one player's own eligibility record
 * — there is no function anywhere in this module that looks up another
 * player's Watcher state, and the API route built on top of it enforces
 * the same (own-session-only, never a client-supplied target id).
 */

import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';
import { WatcherTriggerSource, WatcherStatus, WatcherEligibilityRecord } from './watchers';
import { getPlayerPersonalRolesDB } from './personal-roles-db';
import { getActiveLiveEventsDB } from './live-events-db';
import { LiveEvent, toPublicLiveEvent, PublicLiveEvent } from './live-events';
import { resolveContextualTransmission } from './contextual-transmissions';

function isMissingTable(error: any): boolean {
  return error?.code === '42P01' || /relation .* does not exist/i.test(error?.message || '');
}

/** Idempotent — a repeat grant for the same (event, player, source) is a safe no-op, absorbed by the UNIQUE constraint. */
export async function grantWatcherEligibilityDB(eventId: string, playerId: string, triggerSource: WatcherTriggerSource, detail?: string): Promise<{ newlyGranted: boolean }> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { newlyGranted: false };
  const { error } = await supabaseAdmin.from('watcher_eligibility').insert({
    event_id: eventId,
    player_id: playerId,
    trigger_source: triggerSource,
    trigger_detail: detail || null,
  });
  if (error) {
    if (error.code === '23505') return { newlyGranted: false };
    if (isMissingTable(error)) return { newlyGranted: false };
    throw new Error(`Failed to grant Watcher eligibility: ${error.message}`);
  }
  return { newlyGranted: true };
}

/** Own-eyes-only status: whether this player is Watcher-eligible, through which source(s), and their private clue state. */
export async function getWatcherStatusDB(eventId: string, playerId: string): Promise<WatcherStatus> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { isEligible: false, records: [], privateClueState: {} };
  const { data, error } = await supabaseAdmin.from('watcher_eligibility').select('*').eq('event_id', eventId).eq('player_id', playerId);
  if (error) {
    if (isMissingTable(error)) return { isEligible: false, records: [], privateClueState: {} };
    throw new Error(`Failed to read Watcher status: ${error.message}`);
  }
  const rows = data || [];
  const records: WatcherEligibilityRecord[] = rows.map((r: any) => ({ triggerSource: r.trigger_source, triggerDetail: r.trigger_detail || undefined, eligibleAt: r.eligible_at }));
  const mergedClueState = rows.reduce((acc: Record<string, unknown>, r: any) => ({ ...acc, ...(r.private_clue_state || {}) }), {});
  return { isEligible: rows.length > 0, records, privateClueState: mergedClueState };
}

/**
 * Re-evaluates the real, server-verifiable trigger conditions this
 * foundation actually wires up (three district sigils, holding the Signal
 * Carrier role) and grants eligibility for any newly-satisfied one. The
 * remaining enum values (QUEST_COMBINATION, COMPLETION_ORDER, HIDDEN_BADGE,
 * PLAYER_INTERACTION, NPC_INTERACTION, LIVE_EVENT) are valid, storable
 * trigger sources with no specific content to check yet — granting through
 * them today would mean inventing a puzzle that doesn't exist, so they're
 * reachable only via grantWatcherEligibilityDB directly, once real content
 * defines what satisfies them.
 */
export async function evaluateWatcherEligibilityDB(eventId: string, playerId: string): Promise<{ newlyEligible: WatcherTriggerSource[] }> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { newlyEligible: [] };
  const newlyEligible: WatcherTriggerSource[] = [];

  const { data: sigilRows } = await supabaseAdmin
    .from('player_district_cipher_progress')
    .select('district_key, status')
    .eq('event_id', eventId)
    .eq('player_id', playerId);
  const unlockedCount = (sigilRows || []).filter((r: any) => r.status === 'token_unlocked').length;
  if (unlockedCount >= 3) {
    const result = await grantWatcherEligibilityDB(eventId, playerId, 'THREE_SIGILS', `${unlockedCount} district sigils unlocked`);
    if (result.newlyGranted) newlyEligible.push('THREE_SIGILS');
  }

  const roles = await getPlayerPersonalRolesDB(eventId, playerId);
  if (roles.some((r) => r.type === 'SIGNAL_CARRIER')) {
    const result = await grantWatcherEligibilityDB(eventId, playerId, 'SIGNAL_CARRIER', 'Holds the Signal Carrier role');
    if (result.newlyGranted) newlyEligible.push('SIGNAL_CARRIER');
  }

  return { newlyEligible };
}

/**
 * The full live-events feed for this player, including any currently
 * active 'personalized' visibility event — but ONLY when the player is
 * Watcher-eligible. Every other visitor (ineligible players, and anyone
 * unauthenticated) only ever sees 'public' events, exactly like
 * getPublicLiveEventsDB. This is the concrete implementation of
 * "personalized event visibility."
 */
export async function getPersonalizedLiveEventsDB(eventId: string, eventSlug: string, playerId: string | undefined, now: Date = new Date()): Promise<PublicLiveEvent[]> {
  const active = await getActiveLiveEventsDB(eventId, now);
  const isEligible = playerId ? (await getWatcherStatusDB(eventId, playerId)).isEligible : false;

  const visible = active.filter((le: LiveEvent) => le.visibility === 'public' || (le.visibility === 'personalized' && isEligible));

  return visible.map((row) => {
    const publicEvent = toPublicLiveEvent(row);
    if (row.commanderTransmissionTrigger) {
      const resolved = resolveContextualTransmission({ trigger: row.commanderTransmissionTrigger as any, eventSlug, now });
      if (resolved) publicEvent.resolvedTransmission = resolved;
    }
    return publicEvent;
  });
}
