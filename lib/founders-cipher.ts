import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';
import {
  CipherDistrictKey,
  CipherDistrictProgressView,
  CipherDistrictStatus,
  CipherFragmentView,
  PlayerCipherProgressView,
  QuestPath,
} from './types';

export const FOUNDER_CIPHER_DISTRICTS: Array<{
  key: CipherDistrictKey;
  name: string;
  tokenKey: string;
  tokenLabel: string;
  sigilSymbol: string;
}> = [
  {
    key: 'arts',
    name: 'Arts District',
    tokenKey: 'arts-sigil',
    tokenLabel: 'Arts Sigil',
    sigilSymbol: 'ARTS',
  },
  {
    key: 'challenge',
    name: 'Challenge District',
    tokenKey: 'challenge-sigil',
    tokenLabel: 'Challenge Sigil',
    sigilSymbol: 'CHAL',
  },
  {
    key: 'secret',
    name: 'Secret District',
    tokenKey: 'secret-sigil',
    tokenLabel: 'Secret Sigil',
    sigilSymbol: 'SECR',
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
  // PostgREST returns two different shapes for "this table doesn't exist
  // yet" depending on path: a raw Postgres 42P01/"relation ... does not
  // exist" error, OR (far more common in practice against real, not-yet-
  // fully-migrated infrastructure) its own schema-cache-miss wording
  // ("Could not find the table 'public.x' in the schema cache", code
  // PGRST205) — both must be treated as "gracefully degrade," not "crash
  // the route." See lib/live-events-db.ts and siblings for the identical
  // fix applied session-wide; this file was missed in that pass.
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
): Promise<{ unlocked: boolean }> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { unlocked: false };

  const district = DISTRICT_BY_KEY.get(districtKey);
  if (!district) return { unlocked: false };

  const { data: definitions, error: defError } = await supabaseAdmin
    .from('cipher_fragments')
    .select('id, is_required')
    .eq('event_id', eventId)
    .eq('district_key', districtKey);
  if (defError) {
    if (isMissingTable(defError)) return { unlocked: false };
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
    if (isMissingTable(grantError)) return { unlocked: false };
    throw new Error(`Failed to read cipher grants: ${grantError.message}`);
  }

  const collectedCount = (grants || []).filter((row: any) => requiredIds.has(row.fragment_id)).length;
  const nextStatus: CipherDistrictStatus =
    requiredCount > 0 && collectedCount >= requiredCount ? 'token_unlocked' : collectedCount > 0 ? 'in_progress' : 'locked';

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('player_district_cipher_progress')
    .select('status, token_unlocked_at')
    .eq('event_id', eventId)
    .eq('player_id', playerId)
    .eq('district_key', districtKey)
    .maybeSingle();
  if (existingError && !isMissingTable(existingError)) {
    throw new Error(`Failed to read district cipher progress: ${existingError.message}`);
  }

  const unlockedNow = nextStatus === 'token_unlocked' && existing?.status !== 'token_unlocked';
  const unlockedAt = existing?.token_unlocked_at || (nextStatus === 'token_unlocked' ? new Date().toISOString() : null);

  const { error: upsertError } = await supabaseAdmin.from('player_district_cipher_progress').upsert(
    {
      event_id: eventId,
      player_id: playerId,
      district_key: districtKey,
      status: nextStatus,
      collected_count: collectedCount,
      required_count: requiredCount,
      token_key: nextStatus === 'token_unlocked' ? district.tokenKey : null,
      token_label: nextStatus === 'token_unlocked' ? district.tokenLabel : null,
      sigil_symbol: nextStatus === 'token_unlocked' ? district.sigilSymbol : null,
      token_unlocked_at: unlockedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,player_id,district_key' }
  );
  if (upsertError) {
    if (isMissingTable(upsertError)) return { unlocked: false };
    throw new Error(`Failed to update district cipher progress: ${upsertError.message}`);
  }

  return { unlocked: unlockedNow };
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
}> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin || params.fragmentKeys.length === 0) {
    return { newlyGrantedFragmentKeys: [], unlockedDistricts: [] };
  }

  const uniqueKeys = [...new Set(params.fragmentKeys.map((key) => key.trim()).filter(Boolean))];
  if (uniqueKeys.length === 0) return { newlyGrantedFragmentKeys: [], unlockedDistricts: [] };

  const { data: fragments, error } = await supabaseAdmin
    .from('cipher_fragments')
    .select('id, fragment_key, district_key')
    .eq('event_id', params.eventId)
    .in('fragment_key', uniqueKeys);
  if (error) {
    if (isMissingTable(error)) return { newlyGrantedFragmentKeys: [], unlockedDistricts: [] };
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
      if (isMissingTable(insertError)) return { newlyGrantedFragmentKeys, unlockedDistricts: [] };
      throw new Error(`Failed to grant cipher fragment: ${insertError.message}`);
    }
    newlyGrantedFragmentKeys.push(fragment.fragment_key);
    touchedDistricts.add(fragment.district_key as CipherDistrictKey);
  }

  const unlockedDistricts: CipherDistrictKey[] = [];
  for (const districtKey of touchedDistricts) {
    const result = await refreshDistrictProgressDB(params.eventId, params.playerId, districtKey);
    if (result.unlocked) unlockedDistricts.push(districtKey);
  }

  return { newlyGrantedFragmentKeys, unlockedDistricts };
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
    const inferredStatus: CipherDistrictStatus =
      requiredCount > 0 && collectedCount >= requiredCount ? 'token_unlocked' : collectedCount > 0 ? 'in_progress' : 'locked';
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
