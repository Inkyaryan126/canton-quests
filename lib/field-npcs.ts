/**
 * Canton Quests — Field NPC / Courier System
 * =============================================
 * Pure types and validation logic for real humans playing Canton Quests
 * NPCs. No database access here; see lib/field-npcs-db.ts.
 *
 * Location privacy is enforced at the type level: FieldNpc carries
 * exactLat/exactLon, PublicFieldNpc does not — toPublicFieldNpc is the one
 * place that boundary is drawn, mirroring lib/live-events.ts's
 * toPublicLiveEvent.
 */

import { StartingPath } from './types';

export type FieldNpcType = 'COURIER' | 'WITNESS' | 'MESSENGER' | 'KEYHOLDER' | 'COMMANDER_AGENT';

export interface FieldNpc {
  id: string;
  eventId: string;
  npcType: FieldNpcType;
  aliasName: string;
  publicDescription: string;
  avatarSymbol: string;
  sectorScope?: StartingPath | null;
  broadAreaLabel?: string | null;
  exactLat?: number | null;
  exactLon?: number | null;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  currentCode?: string | null;
  codeRotatedAt?: string | null;
  claimLimit?: number | null;
  currentClaims: number;
  rewardXp: number;
  rewardDrawingEntries: number;
  commanderTransmissionTrigger?: string | null;
  operatorNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The sanitized shape a player may ever see — never currentCode, exactLat/exactLon, operatorNotes, or commanderTransmissionTrigger. */
export type PublicFieldNpc = Pick<
  FieldNpc,
  | 'id' | 'eventId' | 'npcType' | 'aliasName' | 'publicDescription' | 'avatarSymbol'
  | 'sectorScope' | 'broadAreaLabel' | 'startsAt' | 'endsAt' | 'claimLimit' | 'currentClaims'
  | 'rewardXp' | 'rewardDrawingEntries'
>;

export function toPublicFieldNpc(npc: FieldNpc): PublicFieldNpc {
  return {
    id: npc.id,
    eventId: npc.eventId,
    npcType: npc.npcType,
    aliasName: npc.aliasName,
    publicDescription: npc.publicDescription,
    avatarSymbol: npc.avatarSymbol,
    sectorScope: npc.sectorScope,
    broadAreaLabel: npc.broadAreaLabel,
    startsAt: npc.startsAt,
    endsAt: npc.endsAt,
    claimLimit: npc.claimLimit,
    currentClaims: npc.currentClaims,
    rewardXp: npc.rewardXp,
    rewardDrawingEntries: npc.rewardDrawingEntries,
  };
}

export type FieldNpcClaimEligibility =
  | { ok: true }
  | { ok: false; reason: 'not_active' | 'not_yet_active' | 'expired' | 'invalid_code' | 'inventory_exhausted'; message: string };

/**
 * Server-authoritative claim-window/code check — takes an injectable `now`,
 * exactly like getQuestAvailability/getLiveEventAvailability, so a device
 * clock can never extend eligibility. Inventory itself is enforced
 * separately and atomically by the claim_field_npc_slot RPC (a pre-check
 * here is only a fast, friendly rejection — the RPC is the real gate).
 */
export function validateFieldNpcClaim(
  npc: Pick<FieldNpc, 'isActive' | 'startsAt' | 'endsAt' | 'currentCode' | 'claimLimit' | 'currentClaims'>,
  suppliedCode: string,
  now: Date = new Date()
): FieldNpcClaimEligibility {
  if (!npc.isActive) return { ok: false, reason: 'not_active', message: 'This contact is not currently active.' };
  const nowMs = now.getTime();
  if (npc.startsAt && new Date(npc.startsAt).getTime() > nowMs) {
    return { ok: false, reason: 'not_yet_active', message: 'This contact has not appeared yet.' };
  }
  if (npc.endsAt && new Date(npc.endsAt).getTime() <= nowMs) {
    return { ok: false, reason: 'expired', message: 'This contact is no longer active.' };
  }
  if (!npc.currentCode || suppliedCode.trim().toUpperCase() !== npc.currentCode.trim().toUpperCase()) {
    return { ok: false, reason: 'invalid_code', message: 'Incorrect code.' };
  }
  if (npc.claimLimit !== null && npc.claimLimit !== undefined && npc.currentClaims >= npc.claimLimit) {
    return { ok: false, reason: 'inventory_exhausted', message: 'This contact has nothing left to give — all claims exhausted.' };
  }
  return { ok: true };
}

/** A short, easy-to-read-aloud rotating code — never includes ambiguous characters (0/O, 1/I). */
export function generateFieldNpcCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
