import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';
import {
  CipherDistrictKey,
  CipherDistrictProgressView,
  CipherDistrictStatus,
  CipherFragmentView,
  PlayerCipherProgressView,
  QuestPath,
} from './types';

export interface DistrictDecodeDefinition {
  key: CipherDistrictKey;
  name: string;
  tokenKey: string;
  tokenLabel: string;
  sigilSymbol: string;
  canonicalSentence: string;
  canonicalSequence: string[];
  canonicalFragmentKeys: string[];
}

export const FOUNDER_CIPHER_DISTRICTS: DistrictDecodeDefinition[] = [
  {
    key: 'arts',
    name: 'Arts District',
    tokenKey: 'arts-sigil',
    tokenLabel: 'Arts Sigil',
    sigilSymbol: 'ARTS',
    canonicalSentence: 'A NAME OUTLIVES THE MAN.',
    canonicalSequence: ['A NAME', 'OUTLIVES', 'THE MAN'],
    canonicalFragmentKeys: ['arts-founder-signal', 'arts-painted-witness', 'arts-palace-lantern'],
  },
  {
    key: 'challenge',
    name: 'Challenge District',
    tokenKey: 'challenge-sigil',
    tokenLabel: 'Challenge Sigil',
    sigilSymbol: 'CHAL',
    canonicalSentence: 'THE WORLD GAVE A MONSTER HIS NAME.',
    canonicalSequence: ['THE WORLD', 'GAVE A MONSTER', 'HIS NAME'],
    canonicalFragmentKeys: ['challenge-brass-key', 'challenge-helmet-emblem', 'challenge-neon-loop'],
  },
  {
    key: 'secret',
    name: 'Secret District',
    tokenKey: 'secret-sigil',
    tokenLabel: 'Secret Sigil',
    sigilSymbol: 'SECR',
    canonicalSentence: 'THE DEAD KEEP IT AT WEST LAWN.',
    canonicalSequence: ['THE DEAD', 'KEEP IT', 'AT WEST LAWN'],
    canonicalFragmentKeys: ['secret-stone-stair', 'secret-quiet-signal', 'secret-silent-court'],
  },
];

const DISTRICT_BY_KEY = new Map(FOUNDER_CIPHER_DISTRICTS.map((district) => [district.key, district]));

export function pathToCipherDistrict(path?: QuestPath): CipherDistrictKey | undefined {
  if (path === 'family') return 'arts';
  if (path === 'challenge') return 'challenge';
  if (path === 'secret') return 'secret';
  return undefined;
}

export function getCipherDistrictName(key: CipherDistrictKey): string {
  return DISTRICT_BY_KEY.get(key)?.name || key;
}

export function getDistrictDecodeDefinition(key: CipherDistrictKey): DistrictDecodeDefinition | undefined {
  return DISTRICT_BY_KEY.get(key);
}

function normalizePhrase(text: string): string {
  return text
    .trim()
    .toUpperCase()
    .replace(/^\[+|\]+$/g, '')
    .replace(/[.,!?;:]+$/g, '')
    .trim();
}

/**
 * Validates a submitted fragment order for a district. Accepts either the
 * canonical phrase tile sequence (e.g. ['A NAME', 'OUTLIVES', 'THE MAN'])
 * or the canonical fragment keys in order.
 */
export function verifyDistrictDecodeSequence(districtKey: CipherDistrictKey, sequence: string[]): boolean {
  const district = DISTRICT_BY_KEY.get(districtKey);
  if (!district || !Array.isArray(sequence) || sequence.length !== 3) return false;

  const normalizedSubmitted = sequence.map(normalizePhrase);
  const normalizedCanonicalPhrases = district.canonicalSequence.map(normalizePhrase);
  const matchesPhrases = normalizedSubmitted.every((val, idx) => val === normalizedCanonicalPhrases[idx]);
  if (matchesPhrases) return true;

  const normalizedCanonicalKeys = district.canonicalFragmentKeys.map((k) => k.trim().toLowerCase());
  const submittedLower = sequence.map((k) => k.trim().toLowerCase());
  const matchesKeys = submittedLower.every((val, idx) => val === normalizedCanonicalKeys[idx]);
  if (matchesKeys) return true;

  return false;
}

function emptyCipherProgress(eventId: string, playerId: string): PlayerCipherProgressView {
  return {
    eventId,
    playerId,
    districts: FOUNDER_CIPHER_DISTRICTS.map((district) => ({
      key: district.key,
      name: district.name,
      status: 'locked',
      collectedCount: 0,
      requiredCount: 0,
      fragments: [],
    })),
    totalCollected: 0,
    totalRequired: 0,
  };
}

function normalizeStatus(value: unknown): CipherDistrictStatus {
  return value === 'in_progress' || value === 'ready_to_decode' || value === 'token_unlocked' ? value : 'locked';
}

function isMissingTable(error: any): boolean {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /relation .* does not exist/i.test(error?.message || '') ||
    /could not find the table/i.test(error?.message || '')
  );
}

async function refreshDistrictProgressDB(
  eventId: string,
  playerId: string,
  districtKey: CipherDistrictKey
): Promise<{ readyToDecode: boolean }> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { readyToDecode: false };

  const district = DISTRICT_BY_KEY.get(districtKey);
  if (!district) return { readyToDecode: false };

  const { data: definitions, error: defError } = await supabaseAdmin
    .from('cipher_fragments')
    .select('id, is_required')
    .eq('event_id', eventId)
    .eq('district_key', districtKey);
  if (defError) {
    if (isMissingTable(defError)) return { readyToDecode: false };
    throw new Error(`Failed to read cipher fragments: ${defError.message}`);
  }

  const requiredIds = new Set((definitions || []).filter((row: any) => row.is_required !== false).map((row: any) => row.id));
  const requiredCount = requiredIds.size;

  const { data: grants, error: grantError } = await supabaseAdmin
    .from('player_cipher_fragments')
    .select('fragment_id')
    .eq('event_id', eventId)
    .eq('player_id', playerId);
  if (grantError) {
    if (isMissingTable(grantError)) return { readyToDecode: false };
    throw new Error(`Failed to read cipher grants: ${grantError.message}`);
  }

  const collectedCount = (grants || []).filter((row: any) => requiredIds.has(row.fragment_id)).length;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('player_district_cipher_progress')
    .select('status, token_unlocked_at, token_key, token_label, sigil_symbol')
    .eq('event_id', eventId)
    .eq('player_id', playerId)
    .eq('district_key', districtKey)
    .maybeSingle();
  if (existingError && !isMissingTable(existingError)) {
    throw new Error(`Failed to read district cipher progress: ${existingError.message}`);
  }

  let nextStatus: CipherDistrictStatus;
  if (existing?.status === 'token_unlocked') {
    nextStatus = 'token_unlocked';
  } else if (requiredCount > 0 && collectedCount >= requiredCount) {
    nextStatus = 'ready_to_decode';
  } else if (collectedCount > 0) {
    nextStatus = 'in_progress';
  } else {
    nextStatus = 'locked';
  }

  const tokenUnlocked = nextStatus === 'token_unlocked';
  const unlockedAt = existing?.token_unlocked_at || (tokenUnlocked ? new Date().toISOString() : null);

  const { error: upsertError } = await supabaseAdmin.from('player_district_cipher_progress').upsert(
    {
      event_id: eventId,
      player_id: playerId,
      district_key: districtKey,
      status: nextStatus,
      collected_count: collectedCount,
      required_count: requiredCount,
      token_key: tokenUnlocked ? district.tokenKey : null,
      token_label: tokenUnlocked ? district.tokenLabel : null,
      sigil_symbol: tokenUnlocked ? district.sigilSymbol : null,
      token_unlocked_at: unlockedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,player_id,district_key' }
  );
  if (upsertError) {
    if (isMissingTable(upsertError)) return { readyToDecode: false };
    throw new Error(`Failed to update district cipher progress: ${upsertError.message}`);
  }

  return { readyToDecode: nextStatus === 'ready_to_decode' && existing?.status !== 'ready_to_decode' };
}

export async function grantCipherFragmentsForQuestRewardDB(params: {
  eventId: string;
  playerId: string;
  questId: string;
  submissionId: string;
  fragmentKeys: string[];
}): Promise<{
  newlyGrantedFragmentKeys: string[];
  unlockedDistricts: CipherDistrictKey[];
  readyToDecodeDistricts: CipherDistrictKey[];
}> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin || params.fragmentKeys.length === 0) {
    return { newlyGrantedFragmentKeys: [], unlockedDistricts: [], readyToDecodeDistricts: [] };
  }

  const uniqueKeys = [...new Set(params.fragmentKeys.map((key) => key.trim()).filter(Boolean))];
  if (uniqueKeys.length === 0) return { newlyGrantedFragmentKeys: [], unlockedDistricts: [], readyToDecodeDistricts: [] };

  const { data: fragments, error } = await supabaseAdmin
    .from('cipher_fragments')
    .select('id, fragment_key, district_key')
    .eq('event_id', params.eventId)
    .in('fragment_key', uniqueKeys);
  if (error) {
    if (isMissingTable(error)) return { newlyGrantedFragmentKeys: [], unlockedDistricts: [], readyToDecodeDistricts: [] };
    throw new Error(`Failed to resolve cipher fragments: ${error.message}`);
  }

  const newlyGrantedFragmentKeys: string[] = [];
  const touchedDistricts = new Set<CipherDistrictKey>();

  for (const fragment of fragments || []) {
    const { error: insertError } = await supabaseAdmin.from('player_cipher_fragments').insert({
      event_id: params.eventId,
      player_id: params.playerId,
      fragment_id: fragment.id,
      quest_id: params.questId,
      submission_id: params.submissionId,
    });
    if (insertError) {
      if (insertError.code === '23505') {
        touchedDistricts.add(fragment.district_key as CipherDistrictKey);
        continue;
      }
      if (isMissingTable(insertError)) return { newlyGrantedFragmentKeys, unlockedDistricts: [], readyToDecodeDistricts: [] };
      throw new Error(`Failed to grant cipher fragment: ${insertError.message}`);
    }
    newlyGrantedFragmentKeys.push(fragment.fragment_key);
    touchedDistricts.add(fragment.district_key as CipherDistrictKey);
  }

  const readyToDecodeDistricts: CipherDistrictKey[] = [];
  for (const districtKey of touchedDistricts) {
    const result = await refreshDistrictProgressDB(params.eventId, params.playerId, districtKey);
    if (result.readyToDecode) readyToDecodeDistricts.push(districtKey);
  }

  // Under Founder's Cipher rules, fragment accumulation NEVER automatically unlocks district sigils.
  return { newlyGrantedFragmentKeys, unlockedDistricts: [], readyToDecodeDistricts };
}

export interface DistrictDecodeResult {
  success: boolean;
  correct?: boolean;
  status?: CipherDistrictStatus;
  tokenLabel?: string;
  sigilSymbol?: string;
  decodedSentence?: string;
  error?: string;
  alreadyUnlocked?: boolean;
}

/**
 * Server-authoritative district cipher decode submission.
 * Enforces authenticated player scope, required fragment collection,
 * tile sequence verification, idempotency, and prevents extra reward inflation.
 */
export async function decodeDistrictCipherDB(params: {
  eventId: string;
  playerId: string;
  districtKey: CipherDistrictKey;
  sequence: string[];
}): Promise<DistrictDecodeResult> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { success: false, error: 'Database is not configured for remote decode.' };
  }

  const district = DISTRICT_BY_KEY.get(params.districtKey);
  if (!district) {
    return { success: false, error: 'Unknown district.' };
  }

  const { data: definitions, error: defError } = await supabaseAdmin
    .from('cipher_fragments')
    .select('id, is_required')
    .eq('event_id', params.eventId)
    .eq('district_key', params.districtKey);
  if (defError) {
    throw new Error(`Failed to read cipher fragments: ${defError.message}`);
  }

  const requiredIds = new Set((definitions || []).filter((row: any) => row.is_required !== false).map((row: any) => row.id));
  const requiredCount = requiredIds.size;

  const { data: grants, error: grantError } = await supabaseAdmin
    .from('player_cipher_fragments')
    .select('fragment_id')
    .eq('event_id', params.eventId)
    .eq('player_id', params.playerId);
  if (grantError) {
    throw new Error(`Failed to read player cipher grants: ${grantError.message}`);
  }

  const collectedCount = (grants || []).filter((row: any) => requiredIds.has(row.fragment_id)).length;
  if (requiredCount === 0 || collectedCount < requiredCount) {
    return {
      success: false,
      error: `You must collect all ${requiredCount} district fragments before attempting to decode.`,
    };
  }

  const { data: existing } = await supabaseAdmin
    .from('player_district_cipher_progress')
    .select('status, token_unlocked_at, token_label, sigil_symbol')
    .eq('event_id', params.eventId)
    .eq('player_id', params.playerId)
    .eq('district_key', params.districtKey)
    .maybeSingle();

  if (existing?.status === 'token_unlocked') {
    return {
      success: true,
      correct: true,
      alreadyUnlocked: true,
      status: 'token_unlocked',
      tokenLabel: existing.token_label || district.tokenLabel,
      sigilSymbol: existing.sigil_symbol || district.sigilSymbol,
      decodedSentence: district.canonicalSentence,
    };
  }

  const isCorrect = verifyDistrictDecodeSequence(params.districtKey, params.sequence);
  if (!isCorrect) {
    return {
      success: false,
      correct: false,
      error: 'Incorrect fragment sequence. Rearrange the phrases and try again.',
    };
  }

  const nowIso = new Date().toISOString();
  const { error: upsertError } = await supabaseAdmin.from('player_district_cipher_progress').upsert(
    {
      event_id: params.eventId,
      player_id: params.playerId,
      district_key: params.districtKey,
      status: 'token_unlocked',
      collected_count: collectedCount,
      required_count: requiredCount,
      token_key: district.tokenKey,
      token_label: district.tokenLabel,
      sigil_symbol: district.sigilSymbol,
      token_unlocked_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: 'event_id,player_id,district_key' }
  );

  if (upsertError) {
    throw new Error(`Failed to record district decode: ${upsertError.message}`);
  }

  return {
    success: true,
    correct: true,
    status: 'token_unlocked',
    tokenLabel: district.tokenLabel,
    sigilSymbol: district.sigilSymbol,
    decodedSentence: district.canonicalSentence,
  };
}

export async function getPlayerCipherProgressDB(
  eventId: string,
  playerId: string
): Promise<PlayerCipherProgressView | null> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;

  const { data: definitions, error: defError } = await supabaseAdmin
    .from('cipher_fragments')
    .select('id, district_key, fragment_key, display_name, obscured_label, reveal_copy, sort_order, is_required')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });
  if (defError) {
    if (isMissingTable(defError)) return null;
    throw new Error(`Failed to read cipher fragments: ${defError.message}`);
  }
  if (!definitions || definitions.length === 0) return emptyCipherProgress(eventId, playerId);

  const { data: grants, error: grantError } = await supabaseAdmin
    .from('player_cipher_fragments')
    .select('fragment_id, granted_at')
    .eq('event_id', eventId)
    .eq('player_id', playerId);
  if (grantError) {
    if (isMissingTable(grantError)) return null;
    throw new Error(`Failed to read cipher grants: ${grantError.message}`);
  }

  const { data: progressRows, error: progressError } = await supabaseAdmin
    .from('player_district_cipher_progress')
    .select('district_key, status, collected_count, required_count, token_label, sigil_symbol, token_unlocked_at')
    .eq('event_id', eventId)
    .eq('player_id', playerId);
  if (progressError) {
    if (isMissingTable(progressError)) return null;
    throw new Error(`Failed to read district cipher progress: ${progressError.message}`);
  }

  const grantsByFragmentId = new Map((grants || []).map((grant: any) => [grant.fragment_id, grant.granted_at]));
  const progressByDistrict = new Map((progressRows || []).map((row: any) => [row.district_key, row]));

  const districts: CipherDistrictProgressView[] = FOUNDER_CIPHER_DISTRICTS.map((district) => {
    const districtDefinitions = (definitions || []).filter((row: any) => row.district_key === district.key);
    const fragments: CipherFragmentView[] = districtDefinitions.map((row: any) => {
      const grantedAt = grantsByFragmentId.get(row.id) as string | undefined;
      const collected = Boolean(grantedAt);
      return {
        key: row.fragment_key,
        districtKey: district.key,
        displayName: collected ? row.display_name : undefined,
        obscuredLabel: row.obscured_label,
        revealCopy: collected ? row.reveal_copy || undefined : undefined,
        collected,
        sortOrder: row.sort_order || 0,
        grantedAt,
      };
    });
    const requiredCount = districtDefinitions.filter((row: any) => row.is_required !== false).length;
    const collectedCount = fragments.filter((fragment) => fragment.collected).length;
    const persisted = progressByDistrict.get(district.key) as any;

    let inferredStatus: CipherDistrictStatus;
    if (persisted?.status === 'token_unlocked') {
      inferredStatus = 'token_unlocked';
    } else if (requiredCount > 0 && collectedCount >= requiredCount) {
      inferredStatus = 'ready_to_decode';
    } else if (collectedCount > 0) {
      inferredStatus = 'in_progress';
    } else {
      inferredStatus = 'locked';
    }

    const status = normalizeStatus(persisted?.status || inferredStatus);
    const tokenUnlocked = status === 'token_unlocked';
    return {
      key: district.key,
      name: district.name,
      status,
      collectedCount: persisted?.collected_count ?? collectedCount,
      requiredCount: persisted?.required_count ?? requiredCount,
      tokenLabel: tokenUnlocked ? persisted?.token_label || district.tokenLabel : undefined,
      sigilSymbol: tokenUnlocked ? persisted?.sigil_symbol || district.sigilSymbol : undefined,
      tokenUnlockedAt: tokenUnlocked ? persisted?.token_unlocked_at || undefined : undefined,
      decodedSentence: tokenUnlocked ? district.canonicalSentence : undefined,
      fragments,
    };
  });

  return {
    eventId,
    playerId,
    districts,
    totalCollected: districts.reduce((sum, district) => sum + district.collectedCount, 0),
    totalRequired: districts.reduce((sum, district) => sum + district.requiredCount, 0),
  };
}
