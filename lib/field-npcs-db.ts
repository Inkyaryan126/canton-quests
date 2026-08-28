/**
 * Canton Quests — Field NPC / Courier System (Supabase data access)
 * =====================================================================
 * Server-only. Real humans playing NPCs never touch this module or hold
 * any credential to it — they only ever know their NPC's current spoken
 * code. Every mutation (activation, code rotation, reward claim) is either
 * a Game Master admin action or an authenticated player's claim request;
 * there is no "NPC operator" account/role at all, so a normal NPC worker
 * can never become a database admin by construction.
 */

import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';
import { FieldNpc, FieldNpcType, PublicFieldNpc, validateFieldNpcClaim, generateFieldNpcCode, toPublicFieldNpc } from './field-npcs';
import { StartingPath } from './types';
import { insertRewardGrantDB } from './supabase-db';

function isMissingTable(error: any): boolean {
  return error?.code === '42P01' || /relation .* does not exist/i.test(error?.message || '');
}

function mapFieldNpcFromDB(row: any): FieldNpc {
  return {
    id: row.id,
    eventId: row.event_id,
    npcType: row.npc_type,
    aliasName: row.alias_name,
    publicDescription: row.public_description,
    avatarSymbol: row.avatar_symbol,
    sectorScope: row.sector_scope || null,
    broadAreaLabel: row.broad_area_label || null,
    exactLat: row.exact_location_lat ?? null,
    exactLon: row.exact_location_lon ?? null,
    isActive: row.is_active,
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    currentCode: row.current_code || null,
    codeRotatedAt: row.code_rotated_at || null,
    claimLimit: row.claim_limit ?? null,
    currentClaims: row.current_claims ?? 0,
    rewardXp: row.reward_xp ?? 0,
    rewardDrawingEntries: row.reward_drawing_entries ?? 0,
    commanderTransmissionTrigger: row.commander_transmission_trigger || null,
    operatorNotes: row.operator_notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Admin/GM-level read — every field, including exact location and the current code. Never expose this response to a player. */
export async function getEventFieldNpcsDB(eventId: string): Promise<FieldNpc[]> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin.from('field_npcs').select('*').eq('event_id', eventId).order('created_at', { ascending: true });
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`Failed to read field NPCs: ${error.message}`);
  }
  return (data || []).map(mapFieldNpcFromDB);
}

/** Player-facing read — active NPCs only, sanitized. */
export async function getPublicFieldNpcsDB(eventId: string): Promise<PublicFieldNpc[]> {
  const npcs = await getEventFieldNpcsDB(eventId);
  return npcs.filter((n) => n.isActive).map(toPublicFieldNpc);
}

export async function createFieldNpcDB(params: {
  eventId: string;
  npcType: FieldNpcType;
  aliasName: string;
  publicDescription: string;
  avatarSymbol?: string;
  sectorScope?: StartingPath | null;
  broadAreaLabel?: string;
  exactLat?: number;
  exactLon?: number;
  startsAt?: string;
  endsAt?: string;
  claimLimit?: number;
  rewardXp?: number;
  rewardDrawingEntries?: number;
  commanderTransmissionTrigger?: string;
  operatorNotes?: string;
}): Promise<FieldNpc> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) throw new Error('createFieldNpcDB requires Supabase service-role configuration.');
  const { data, error } = await supabaseAdmin
    .from('field_npcs')
    .insert({
      event_id: params.eventId,
      npc_type: params.npcType,
      alias_name: params.aliasName,
      public_description: params.publicDescription,
      avatar_symbol: params.avatarSymbol || '🕵️',
      sector_scope: params.sectorScope || null,
      broad_area_label: params.broadAreaLabel || null,
      exact_location_lat: params.exactLat ?? null,
      exact_location_lon: params.exactLon ?? null,
      starts_at: params.startsAt || null,
      ends_at: params.endsAt || null,
      current_code: generateFieldNpcCode(),
      code_rotated_at: new Date().toISOString(),
      claim_limit: params.claimLimit ?? null,
      reward_xp: params.rewardXp ?? 0,
      reward_drawing_entries: params.rewardDrawingEntries ?? 0,
      commander_transmission_trigger: params.commanderTransmissionTrigger || null,
      operator_notes: params.operatorNotes || null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || 'Failed to create field NPC.');
  return mapFieldNpcFromDB(data);
}

export async function setFieldNpcActiveDB(npcId: string, isActive: boolean): Promise<FieldNpc | undefined> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return undefined;
  const { data, error } = await supabaseAdmin
    .from('field_npcs')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', npcId)
    .select()
    .single();
  if (error || !data) return undefined;
  return mapFieldNpcFromDB(data);
}

/** GM action: issue a fresh spoken code, invalidating the previous one immediately. */
export async function rotateFieldNpcCodeDB(npcId: string): Promise<FieldNpc | undefined> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return undefined;
  const { data, error } = await supabaseAdmin
    .from('field_npcs')
    .update({ current_code: generateFieldNpcCode(), code_rotated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', npcId)
    .select()
    .single();
  if (error || !data) return undefined;
  return mapFieldNpcFromDB(data);
}

export interface FieldNpcClaimResult {
  eligibility: ReturnType<typeof validateFieldNpcClaim>;
  newlyClaimed: boolean;
  xpAwarded: number;
  drawingEntriesAwarded: number;
}

/**
 * The single authenticated-player claim entry point. Validates the window
 * and code, reserves an inventory slot atomically via claim_field_npc_slot
 * (the real, race-safe gate — validateFieldNpcClaim's own limit check is
 * only a fast pre-check), then grants the reward exactly once per
 * (player, event, npc) via the reused reward_grants questless idempotency
 * index — a retried or duplicate claim request is a safe no-op.
 */
export async function claimFieldNpcDB(params: { eventId: string; npcId: string; playerId: string; suppliedCode: string }): Promise<FieldNpcClaimResult> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { eligibility: { ok: false, reason: 'not_active', message: 'Live claiming requires Supabase configuration.' }, newlyClaimed: false, xpAwarded: 0, drawingEntriesAwarded: 0 };
  }

  const { data: row, error: fetchError } = await supabaseAdmin.from('field_npcs').select('*').eq('id', params.npcId).eq('event_id', params.eventId).maybeSingle();
  if (fetchError || !row) {
    return { eligibility: { ok: false, reason: 'not_active', message: 'Contact not found for this Mission.' }, newlyClaimed: false, xpAwarded: 0, drawingEntriesAwarded: 0 };
  }
  const npc = mapFieldNpcFromDB(row);

  const eligibility = validateFieldNpcClaim(npc, params.suppliedCode);
  if (!eligibility.ok) return { eligibility, newlyClaimed: false, xpAwarded: 0, drawingEntriesAwarded: 0 };

  const { data: claimResult, error: claimError } = await supabaseAdmin.rpc('claim_field_npc_slot', { p_npc_id: params.npcId });
  if (claimError) throw new Error(`Failed to claim NPC slot: ${claimError.message}`);
  if (claimResult === null || claimResult === undefined) {
    return { eligibility: { ok: false, reason: 'inventory_exhausted', message: 'This contact has nothing left to give — all claims exhausted.' }, newlyClaimed: false, xpAwarded: 0, drawingEntriesAwarded: 0 };
  }

  const rewardKey = `npc:${params.npcId}`;
  const granted = await insertRewardGrantDB({
    eventId: params.eventId,
    playerId: params.playerId,
    rewardType: 'NPC_CLAIM',
    rewardKey,
    xpAwarded: npc.rewardXp,
    drawingEntriesAwarded: npc.rewardDrawingEntries,
  });
  if (!granted) {
    return { eligibility: { ok: true }, newlyClaimed: false, xpAwarded: 0, drawingEntriesAwarded: 0 };
  }

  if (npc.rewardXp > 0) {
    const { data: player } = await supabaseAdmin.from('players').select('total_xp').eq('id', params.playerId).maybeSingle();
    const nextTotalXp = Math.max(0, (player?.total_xp || 0) + npc.rewardXp);
    await supabaseAdmin.from('players').update({ total_xp: nextTotalXp, level: Math.floor(nextTotalXp / 250) + 1 }).eq('id', params.playerId);
    await supabaseAdmin.from('score_ledger').insert({
      event_id: params.eventId,
      player_id: params.playerId,
      points: npc.rewardXp,
      category: 'npc_claim',
      description: `${npc.aliasName} contact confirmed (+${npc.rewardXp} XP)`,
    });
  }

  let drawingEntriesAwarded = 0;
  if (npc.rewardDrawingEntries > 0) {
    const { data: lockRow } = await supabaseAdmin.from('drawing_ledger_locks').select('is_locked, status').eq('event_id', params.eventId).maybeSingle();
    const drawingLocked = !!(lockRow && (lockRow.is_locked || ['locked', 'drawn', 'published', 'cancelled'].includes(lockRow.status)));
    if (!drawingLocked) {
      const { error: incrementError } = await supabaseAdmin.rpc('increment_drawing_entries', {
        p_event_id: params.eventId,
        p_player_id: params.playerId,
        p_quest_id: null,
        p_add_entries: npc.rewardDrawingEntries,
        p_submission_id: null,
        p_source_type: 'npc_claim',
        p_reason: `${npc.aliasName} contact confirmed`,
      });
      if (!incrementError) drawingEntriesAwarded = npc.rewardDrawingEntries;
    }
  }

  return { eligibility: { ok: true }, newlyClaimed: true, xpAwarded: npc.rewardXp, drawingEntriesAwarded };
}
