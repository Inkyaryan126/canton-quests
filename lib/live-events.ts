/**
 * Canton Quests — Live City Events
 * ===================================
 * Pure types and decision functions for the server-authoritative live-event
 * layer (Flash Drops, City Events, Sector Events, Community Milestones, XP
 * Multipliers, Temporary Unlocks, Special Objectives, Emergency Messages).
 *
 * This module never touches the database and never trusts a client-supplied
 * clock — every function here takes an injectable `now: Date` (server time
 * only; callers always pass `new Date()` from inside an API route or RPC,
 * mirroring lib/quest-rewards.ts's getQuestAvailability). Data access lives
 * in lib/live-events-db.ts.
 *
 * IMPORTANT — sector scope is informational, not a gate: players can visit
 * and complete quests in every district regardless of their chosen starting
 * path (confirmed by tests/founders-cipher-district-system.test.ts). A
 * SECTOR_EVENT's sectorScope is display metadata ("this is happening in the
 * Secret district") for the Live Status HUD, never a filter that hides the
 * event from players who started on a different path.
 */

import { QuestCommanderTransmission, StartingPath } from './types';
import { CommanderTransmissionTrigger } from './game-effects';

/** Maps a LiveEventType onto the matching generic contextual trigger (lib/contextual-transmissions.ts) — only for the types that have a real, name-matching trigger. XP_MULTIPLIER/TEMPORARY_UNLOCK/SPECIAL_OBJECTIVE have no 1:1 match and are intentionally omitted rather than forced onto an unrelated trigger name. */
export const LIVE_EVENT_TRANSMISSION_TRIGGER: Partial<Record<LiveEventType, CommanderTransmissionTrigger>> = {
  FLASH_DROP: 'flash_drop',
  CITY_EVENT: 'city_event',
  SECTOR_EVENT: 'sector_event',
  COMMUNITY_MILESTONE: 'community_milestone',
  EMERGENCY_MESSAGE: 'emergency',
};

export type LiveEventType =
  | 'FLASH_DROP'
  | 'CITY_EVENT'
  | 'SECTOR_EVENT'
  | 'COMMUNITY_MILESTONE'
  | 'XP_MULTIPLIER'
  | 'TEMPORARY_UNLOCK'
  | 'SPECIAL_OBJECTIVE'
  | 'EMERGENCY_MESSAGE';

export type LiveEventStatus = 'scheduled' | 'active' | 'completed' | 'cancelled' | 'expired';
export type LiveEventVisibility = 'public' | 'private' | 'personalized';

export interface LiveEvent {
  id: string;
  eventId: string;
  eventType: LiveEventType;
  title: string;
  description?: string;
  status: LiveEventStatus;
  startsAt: string;
  endsAt?: string;
  /** null/undefined = city-wide (CITY_EVENT). Set = one district (SECTOR_EVENT). Display metadata only — see module doc comment. */
  sectorScope?: StartingPath | null;
  /** Set when this live event IS an existing Quest going live — completion flows through the existing quest_submissions pipeline, never a second one. */
  questScopeId?: string | null;
  multiplierValue?: number | null;
  progressCurrent: number;
  progressTarget?: number | null;
  firstNSlots?: number | null;
  visibility: LiveEventVisibility;
  commanderTransmissionTrigger?: string | null;
  publicPayload: Record<string, unknown>;
  adminPayload?: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The sanitized shape returned to players — never admin_payload, createdBy,
 * or the raw Commander trigger key. `resolvedTransmission` is computed
 * server-side (lib/live-events-db.ts, via the Contextual Transmission
 * Engine) and attached here instead — the client receives ready-to-display
 * content, never the internal trigger/rule machinery that produced it.
 */
export type PublicLiveEvent = Omit<LiveEvent, 'adminPayload' | 'createdBy' | 'commanderTransmissionTrigger'> & {
  resolvedTransmission?: QuestCommanderTransmission;
};

export type LiveEventAvailability =
  | { ok: true }
  | { ok: false; reason: 'not_active_status' | 'not_yet_active' | 'expired'; message: string };

/**
 * Whether a live event is genuinely live right now, from the server's own
 * clock. Mirrors getQuestAvailability's shape/pattern deliberately — same
 * kind of check, same injectable-`now` testability, same three-outcome
 * result shape.
 */
export function getLiveEventAvailability(
  liveEvent: Pick<LiveEvent, 'status' | 'startsAt' | 'endsAt'>,
  now: Date = new Date()
): LiveEventAvailability {
  if (liveEvent.status !== 'active') {
    return { ok: false, reason: 'not_active_status', message: 'This live event is not currently active.' };
  }
  const nowMs = now.getTime();
  if (new Date(liveEvent.startsAt).getTime() > nowMs) {
    return { ok: false, reason: 'not_yet_active', message: 'This live event has not started yet.' };
  }
  if (liveEvent.endsAt && new Date(liveEvent.endsAt).getTime() <= nowMs) {
    return { ok: false, reason: 'expired', message: 'This live event has ended.' };
  }
  return { ok: true };
}

/** Strips admin-only fields for the player-facing response. */
export function toPublicLiveEvent(liveEvent: LiveEvent): PublicLiveEvent {
  const { adminPayload, createdBy, commanderTransmissionTrigger, ...rest } = liveEvent;
  return rest;
}

/**
 * The effective XP multiplier a player's quest submission should receive
 * right now, from a list of currently-active live events already scoped to
 * the right event. An XP_MULTIPLIER event applies city-wide unless it
 * declares a sectorScope, in which case it only applies to a quest whose own
 * startingPath matches — this IS a real gate (unlike the display-only
 * sector scope on other event types), since a multiplier is a concrete
 * reward-math decision, not a visibility choice. When more than one
 * multiplier is simultaneously active, the highest wins rather than
 * stacking — stacking silently would make reward math nearly impossible to
 * reason about or audit.
 */
export function getEffectiveLiveEventMultiplier(
  activeLiveEvents: Pick<LiveEvent, 'eventType' | 'sectorScope' | 'multiplierValue'>[],
  questStartingPath?: StartingPath | null
): number {
  let best = 1;
  for (const le of activeLiveEvents) {
    if (le.eventType !== 'XP_MULTIPLIER') continue;
    if (!le.multiplierValue || le.multiplierValue <= 0) continue;
    if (le.sectorScope && le.sectorScope !== questStartingPath) continue;
    if (le.multiplierValue > best) best = le.multiplierValue;
  }
  return best;
}

/** True if any currently-active live event is a TEMPORARY_UNLOCK naming this quest as its scope. */
export function isQuestTemporarilyUnlocked(
  activeLiveEvents: Pick<LiveEvent, 'eventType' | 'questScopeId'>[],
  questId: string
): boolean {
  return activeLiveEvents.some((le) => le.eventType === 'TEMPORARY_UNLOCK' && le.questScopeId === questId);
}
