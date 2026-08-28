/**
 * Canton Quests — Live City Events (Supabase data access)
 * ==========================================================
 * Server-only. Every read and write here uses supabaseAdmin (service
 * role) — getPublicLiveEventsDB reads at admin level specifically so it can
 * see commanderTransmissionTrigger/publicPayload and resolve each event's
 * Commander transmission server-side (lib/contextual-transmissions.ts), then
 * sanitizes via toPublicLiveEvent before anything reaches the client. The
 * public_live_events DB view from the 20260828130000 migration remains in
 * place as an independent, defense-in-depth read path (anon-capable,
 * excludes admin_payload/createdBy/commanderTransmissionTrigger at the
 * database layer) for any future caller that only needs the raw fields with
 * no resolution step — this module just doesn't happen to use it, since
 * resolving a transmission requires the admin-level columns anyway.
 *
 * There is no cron/scheduled-job runner anywhere in this codebase (the one
 * function literally named with "Cron" in it is invoked on-demand from an
 * admin action, not on a schedule). Expiration is therefore lazy: every read
 * of "active" events re-checks each row's window with
 * getLiveEventAvailability and opportunistically flips any row that has
 * genuinely passed its end time to status='expired' before returning —
 * status is a cache of that decision, never trusted on its own without the
 * time-window recheck, matching how quest.status alone is never sufficient
 * to decide submittability elsewhere in this codebase.
 *
 * isMissingTable lets every function here degrade to an empty/no-op result
 * instead of throwing when this migration hasn't been applied to a given
 * environment yet (it is prepared-only as of this mission) — same pattern
 * lib/founders-cipher.ts uses for the same reason.
 */

import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';
import { StartingPath } from './types';
import {
  LiveEvent,
  LiveEventType,
  LiveEventVisibility,
  PublicLiveEvent,
  LIVE_EVENT_TRANSMISSION_TRIGGER,
  getLiveEventAvailability,
  getEffectiveLiveEventMultiplier,
  toPublicLiveEvent,
} from './live-events';
import { CommanderTransmissionTrigger } from './game-effects';
import { resolveContextualTransmission } from './contextual-transmissions';

function isMissingTable(error: any): boolean {
  return error?.code === '42P01' || /relation .* does not exist/i.test(error?.message || '');
}

function mapLiveEventFromDB(row: any): LiveEvent {
  return {
    id: row.id,
    eventId: row.event_id,
    eventType: row.event_type,
    title: row.title,
    description: row.description || undefined,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at || undefined,
    sectorScope: row.sector_scope || null,
    questScopeId: row.quest_scope_id || null,
    multiplierValue: row.multiplier_value ?? null,
    progressCurrent: row.progress_current ?? 0,
    progressTarget: row.progress_target ?? null,
    firstNSlots: row.first_n_slots ?? null,
    visibility: row.visibility,
    commanderTransmissionTrigger: row.commander_transmission_trigger || null,
    publicPayload: row.public_payload || {},
    adminPayload: row.admin_payload || {},
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function expireIfPastWindow(row: LiveEvent, now: Date): Promise<LiveEvent> {
  if (row.status !== 'active') return row;
  const availability = getLiveEventAvailability(row, now);
  if (availability.ok || availability.reason !== 'expired') return row;
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return row;

  await supabaseAdmin.from('live_events').update({ status: 'expired', updated_at: now.toISOString() }).eq('id', row.id);
  await closeQuestWindowForEnd(row);
  await recordLiveEventAuditDB(row.id, row.eventId, 'expired', { reason: 'window_passed' });
  return { ...row, status: 'expired' };
}

/** Every currently-active live event for an operation, server-side, with lazy expiry applied. For internal/admin/reward-pipeline use — includes admin_payload. */
export async function getActiveLiveEventsDB(eventId: string, now: Date = new Date()): Promise<LiveEvent[]> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin.from('live_events').select('*').eq('event_id', eventId).eq('status', 'active');
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`Failed to read live events: ${error.message}`);
  }
  const rows = await Promise.all((data || []).map((row) => expireIfPastWindow(mapLiveEventFromDB(row), now)));
  return rows.filter((row) => getLiveEventAvailability(row, now).ok);
}

/**
 * The sanitized, player-safe list. Reads through getActiveLiveEventsDB
 * (admin-level, so it can see commanderTransmissionTrigger/publicPayload)
 * specifically so it can resolve each event's Commander transmission
 * content server-side — the client must never see the raw trigger name or
 * decide for itself what to display; it only ever receives a
 * ready-to-render QuestCommanderTransmission. toPublicLiveEvent is the
 * sanitization boundary: adminPayload/createdBy/commanderTransmissionTrigger
 * are stripped from every row before it leaves this function, regardless of
 * whether a transmission was resolved. The public_live_events DB view
 * remains in place as an independent, defense-in-depth read path for any
 * future caller that only needs the raw fields with no resolution step.
 */
export async function getPublicLiveEventsDB(eventId: string, eventSlug: string, now: Date = new Date()): Promise<PublicLiveEvent[]> {
  const active = await getActiveLiveEventsDB(eventId, now);
  return active.map((row) => {
    const publicEvent = toPublicLiveEvent(row);
    const trigger = row.commanderTransmissionTrigger as CommanderTransmissionTrigger | null | undefined;
    const inline = (row.publicPayload as any)?.transmission as { headline: string; message: string; cta?: string; posterKey?: string } | undefined;
    const effectiveTrigger = trigger || LIVE_EVENT_TRANSMISSION_TRIGGER[row.eventType];
    if (effectiveTrigger || inline) {
      const resolved = resolveContextualTransmission({
        trigger: effectiveTrigger || 'city_event',
        eventSlug,
        path: row.sectorScope || undefined,
        inlineContent: inline,
        countdownEndsAt: row.endsAt || undefined,
        now,
      });
      if (resolved) publicEvent.resolvedTransmission = resolved;
    }
    return publicEvent;
  });
}

export async function getLiveEventByIdDB(liveEventId: string): Promise<LiveEvent | undefined> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return undefined;
  const { data, error } = await supabaseAdmin.from('live_events').select('*').eq('id', liveEventId).maybeSingle();
  if (error || !data) {
    if (error && !isMissingTable(error)) throw new Error(`Failed to read live event: ${error.message}`);
    return undefined;
  }
  return mapLiveEventFromDB(data);
}

export async function createLiveEventDB(params: {
  eventId: string;
  eventType: LiveEventType;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  sectorScope?: StartingPath | null;
  questScopeId?: string | null;
  multiplierValue?: number | null;
  progressTarget?: number | null;
  firstNSlots?: number | null;
  visibility?: LiveEventVisibility;
  commanderTransmissionTrigger?: string | null;
  publicPayload?: Record<string, unknown>;
  adminPayload?: Record<string, unknown>;
  createdBy?: string;
  /** Create directly into 'active' status instead of 'scheduled' — for an immediate GM-triggered drop. */
  activateImmediately?: boolean;
}): Promise<LiveEvent> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    throw new Error('createLiveEventDB requires Supabase service-role configuration.');
  }
  const { data, error } = await supabaseAdmin
    .from('live_events')
    .insert({
      event_id: params.eventId,
      event_type: params.eventType,
      title: params.title,
      description: params.description,
      status: params.activateImmediately ? 'active' : 'scheduled',
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      sector_scope: params.sectorScope || null,
      quest_scope_id: params.questScopeId || null,
      multiplier_value: params.multiplierValue ?? null,
      progress_target: params.progressTarget ?? null,
      first_n_slots: params.firstNSlots ?? null,
      visibility: params.visibility || 'public',
      commander_transmission_trigger: params.commanderTransmissionTrigger || null,
      public_payload: params.publicPayload || {},
      admin_payload: params.adminPayload || {},
      created_by: params.createdBy || 'Game Master',
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || 'Failed to create live event.');

  const created = mapLiveEventFromDB(data);
  await recordLiveEventAuditDB(created.id, created.eventId, 'created', { eventType: created.eventType, title: created.title });
  if (created.status === 'active') {
    await applyQuestWindowForActivation(created);
    await recordLiveEventAuditDB(created.id, created.eventId, 'activated', { immediately: true });
  }
  return created;
}

export async function activateLiveEventDB(liveEventId: string): Promise<LiveEvent | undefined> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return undefined;
  const { data, error } = await supabaseAdmin
    .from('live_events')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', liveEventId)
    .eq('status', 'scheduled')
    .select()
    .single();
  if (error || !data) return undefined;
  const updated = mapLiveEventFromDB(data);
  await applyQuestWindowForActivation(updated);
  await recordLiveEventAuditDB(updated.id, updated.eventId, 'activated', {});
  return updated;
}

export async function cancelLiveEventDB(liveEventId: string, reason?: string): Promise<LiveEvent | undefined> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return undefined;
  const { data, error } = await supabaseAdmin
    .from('live_events')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', liveEventId)
    .in('status', ['scheduled', 'active'])
    .select()
    .single();
  if (error || !data) return undefined;
  const updated = mapLiveEventFromDB(data);
  await closeQuestWindowForEnd(updated);
  await recordLiveEventAuditDB(updated.id, updated.eventId, 'cancelled', { reason: reason || null });
  return updated;
}

/**
 * When a Flash Drop or Special Objective (the two live-event types that are
 * "about" an existing Quest) goes active, its window is written through to
 * that Quest's own startsAt/expiresAt — the EXISTING getQuestAvailability
 * check (lib/quest-rewards.ts), already enforced in both the local and
 * Supabase submission paths, then gates it automatically. This is the whole
 * point of quest_scope_id: zero duplicated window-enforcement logic.
 */
async function applyQuestWindowForActivation(liveEvent: LiveEvent): Promise<void> {
  if (!liveEvent.questScopeId) return;
  if (liveEvent.eventType !== 'FLASH_DROP' && liveEvent.eventType !== 'SPECIAL_OBJECTIVE') return;
  await setQuestLiveWindowDB(liveEvent.questScopeId, {
    isFlash: liveEvent.eventType === 'FLASH_DROP',
    startsAt: liveEvent.startsAt,
    expiresAt: liveEvent.endsAt || null,
  });
}

/** Cancelling/expiring closes the quest's window immediately (a past expiresAt) rather than leaving it claimable — a bonus drop that's over is over. */
async function closeQuestWindowForEnd(liveEvent: LiveEvent): Promise<void> {
  if (!liveEvent.questScopeId) return;
  if (liveEvent.eventType !== 'FLASH_DROP' && liveEvent.eventType !== 'SPECIAL_OBJECTIVE') return;
  await setQuestLiveWindowDB(liveEvent.questScopeId, { isFlash: false, expiresAt: new Date().toISOString() });
}

export async function recordLiveEventAuditDB(
  liveEventId: string,
  eventId: string,
  action: 'created' | 'activated' | 'cancelled' | 'expired' | 'completed' | 'milestone_crossed' | 'multiplier_applied' | 'first_n_awarded',
  detail: Record<string, unknown>,
  actor: string = 'Game Master'
): Promise<void> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return;
  const { error } = await supabaseAdmin
    .from('live_event_audit_log')
    .insert({ live_event_id: liveEventId, event_id: eventId, action, actor, detail });
  if (error && !isMissingTable(error)) {
    // Non-fatal — the audit trail is additive observability, never a gate on the underlying mutation succeeding.
  }
}

/**
 * Atomic milestone-progress increment via the increment_live_event_progress
 * RPC — see the migration for why this must be a single locked UPDATE
 * rather than a read-then-write. Records a 'milestone_crossed' audit entry
 * exactly once, from the one caller the RPC itself identifies as having
 * crossed the threshold.
 */
export async function incrementLiveEventProgressDB(
  liveEventId: string,
  eventId: string,
  increment: number = 1
): Promise<{ newCurrent: number; target: number | null; justCrossedThreshold: boolean } | undefined> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return undefined;
  const { data, error } = await supabaseAdmin.rpc('increment_live_event_progress', {
    p_live_event_id: liveEventId,
    p_increment: increment,
  });
  if (error) {
    if (isMissingTable(error)) return undefined;
    throw new Error(`Failed to increment live event progress: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.new_current === null || row.new_current === undefined) return undefined;

  const result = { newCurrent: row.new_current as number, target: (row.target ?? null) as number | null, justCrossedThreshold: !!row.just_crossed_threshold };
  if (result.justCrossedThreshold) {
    await recordLiveEventAuditDB(liveEventId, eventId, 'milestone_crossed', { newCurrent: result.newCurrent, target: result.target });
  }
  return result;
}

/**
 * Narrow, single-purpose write for a live-event-driven Flash Drop/Special
 * Objective's underlying Quest window. Deliberately separate from
 * lib/supabase-db.ts's AdminQuestUpdate (which intentionally excludes these
 * exact fields so ordinary admin quest edits can never accidentally change
 * a quest's timing) — this function exists specifically so live-event
 * activation/expiration can drive that window, and is called from nowhere
 * else.
 */
export async function setQuestLiveWindowDB(
  questId: string,
  updates: { isFlash?: boolean; startsAt?: string | null; expiresAt?: string | null }
): Promise<void> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return;
  const patch: Record<string, unknown> = {};
  if (updates.isFlash !== undefined) patch.is_flash = updates.isFlash;
  if (updates.startsAt !== undefined) patch.starts_at = updates.startsAt;
  if (updates.expiresAt !== undefined) patch.expires_at = updates.expiresAt;
  if (Object.keys(patch).length === 0) return;
  await supabaseAdmin.from('quests').update(patch).eq('id', questId);
}

/**
 * The effective XP multiplier for a quest submission right now — combines
 * getActiveLiveEventsDB with getEffectiveLiveEventMultiplier's pure logic.
 * Called from lib/supabase-db.ts's awardQuestRewardsDB call sites.
 */
export async function getActiveLiveEventMultiplierDB(
  eventId: string,
  questStartingPath?: StartingPath | null
): Promise<number> {
  const active = await getActiveLiveEventsDB(eventId);
  return getEffectiveLiveEventMultiplier(active, questStartingPath);
}
