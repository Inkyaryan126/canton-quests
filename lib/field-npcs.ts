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
  /**
   * Optional lucky-pickup range — when both are set, claimFieldNpcDB rolls
   * a random integer in [rewardXpMin, rewardXpMax] instead of the flat
   * rewardXp above. Deliberately excluded from PublicFieldNpc: the exact
   * range is never shown pre-claim (rewardXp still displays as the
   * advertised/typical amount) — the real, random amount is revealed only
   * in the claim result itself, same "mystery until claimed" feel as the
   * Fair Hunt's Mystery Money Signals.
   */
  rewardXpMin?: number | null;
  rewardXpMax?: number | null;
  rewardDrawingEntries: number;
  commanderTransmissionTrigger?: string | null;
  operatorNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Rolls the actual XP an NPC claim pays out. When both range bounds are
 * configured, returns a random integer in [rewardXpMin, rewardXpMax]
 * inclusive (a genuine "lucky pickup"); otherwise falls back to the flat
 * rewardXp, so every existing NPC is unaffected until an admin sets a
 * range. Pulled out as its own pure function (rather than inlined in
 * claimFieldNpcDB) specifically so the roll math is unit-testable without
 * a live Supabase connection.
 */
export function rollFieldNpcRewardXp(npc: Pick<FieldNpc, 'rewardXp' | 'rewardXpMin' | 'rewardXpMax'>): number {
  if (npc.rewardXpMin != null && npc.rewardXpMax != null && npc.rewardXpMax >= npc.rewardXpMin) {
    return npc.rewardXpMin + Math.floor(Math.random() * (npc.rewardXpMax - npc.rewardXpMin + 1));
  }
  return npc.rewardXp;
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
