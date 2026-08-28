/**
 * Canton Quests — Community Progress / City State (Supabase data access)
 * ==========================================================================
 * Server-only. Every query here reads existing tables — event_players,
 * quest_submissions, player_district_cipher_progress (Founder's Cipher),
 * player_links, live_events — no new schema. Every query degrades to a
 * safe zero/empty value rather than throwing when a table isn't present
 * yet in a given environment, matching every other *-db.ts module in this
 * codebase.
 */

import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';
import { CityStateProjection, DistrictProgressSummary } from './city-state';
import { getPlayerLinkStatsDB } from './player-links-db';
import { getSignalCarrierCountDB } from './personal-roles-db';

function isMissingTable(error: any): boolean {
  // PostgREST returns two different shapes for "this table doesn't exist
  // yet" depending on path: a raw Postgres 42P01/"relation ... does not
  // exist" error, OR (far more commonly in practice, including every
  // migration this session left unapplied remotely) its own
  // schema-cache-miss wording ("Could not find the table 'public.x' in the
  // schema cache", code PGRST205) — both must be treated as "gracefully
  // degrade," not "crash the route."
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /relation .* does not exist/i.test(error?.message || '') ||
    /could not find the table/i.test(error?.message || '')
  );
}

const EMPTY_DISTRICT: DistrictProgressSummary = { fractionComplete: 0, playersWithProgress: 0, playersUnlocked: 0 };

const EMPTY_PROJECTION = (eventId: string): CityStateProjection => ({
  eventId,
  registeredPlayers: 0,
  activePlayers: 0,
  totalCompletedQuests: 0,
  districtProgress: { arts: EMPTY_DISTRICT, challenge: EMPTY_DISTRICT, secret: EMPTY_DISTRICT },
  totalPlayerLinks: 0,
  totalSignalCarriers: 0,
  sigilDistribution: { oneDistrict: 0, twoDistricts: 0, threeDistricts: 0 },
  convergenceReadyPlayers: 0,
  computedAt: new Date().toISOString(),
});

/**
 * The single server-side city-state aggregate. Safe to expose to players
 * directly (see the PublicCityState alias) — every field is already a
 * city-wide count/fraction with zero per-player identity.
 */
export async function getCityStateDB(eventId: string): Promise<CityStateProjection> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return EMPTY_PROJECTION(eventId);
  const db = supabaseAdmin;

  const [registeredResult, submissionsResult, districtRowsResult, linkStats, signalCarrierCount] = await Promise.all([
    db.from('event_players').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    db.from('quest_submissions').select('player_id, status').eq('event_id', eventId),
    db.from('player_district_cipher_progress').select('player_id, district_key, status, collected_count, required_count').eq('event_id', eventId),
    getPlayerLinkStatsDB(eventId),
    getSignalCarrierCountDB(eventId),
  ]);

  if (registeredResult.error && !isMissingTable(registeredResult.error)) {
    throw new Error(`Failed to read city state (event_players): ${registeredResult.error.message}`);
  }
  const registeredPlayers = registeredResult.count || 0;

  let activePlayers = 0;
  let totalCompletedQuests = 0;
  if (!submissionsResult.error) {
    const submissionRows = submissionsResult.data || [];
    activePlayers = new Set(submissionRows.map((r: any) => r.player_id)).size;
    totalCompletedQuests = submissionRows.filter((r: any) => r.status === 'verified').length;
  } else if (!isMissingTable(submissionsResult.error)) {
    throw new Error(`Failed to read city state (quest_submissions): ${submissionsResult.error.message}`);
  }

  const districtProgress = { arts: { ...EMPTY_DISTRICT }, challenge: { ...EMPTY_DISTRICT }, secret: { ...EMPTY_DISTRICT } };
  const sigilCountByPlayer = new Map<string, number>();

  if (!districtRowsResult.error) {
    const rows = districtRowsResult.data || [];
    const byDistrict: Record<string, { collected: number; required: number; withProgress: number; unlocked: number }> = {
      arts: { collected: 0, required: 0, withProgress: 0, unlocked: 0 },
      challenge: { collected: 0, required: 0, withProgress: 0, unlocked: 0 },
      secret: { collected: 0, required: 0, withProgress: 0, unlocked: 0 },
    };
    for (const row of rows as any[]) {
      const bucket = byDistrict[row.district_key];
      if (!bucket) continue;
      bucket.collected += row.collected_count || 0;
      bucket.required += row.required_count || 0;
      if ((row.collected_count || 0) > 0) bucket.withProgress += 1;
      if (row.status === 'token_unlocked') {
        bucket.unlocked += 1;
        sigilCountByPlayer.set(row.player_id, (sigilCountByPlayer.get(row.player_id) || 0) + 1);
      }
    }
    for (const key of ['arts', 'challenge', 'secret'] as const) {
      const bucket = byDistrict[key];
      districtProgress[key] = {
        fractionComplete: bucket.required > 0 ? Math.min(1, bucket.collected / bucket.required) : 0,
        playersWithProgress: bucket.withProgress,
        playersUnlocked: bucket.unlocked,
      };
    }
  } else if (!isMissingTable(districtRowsResult.error)) {
    throw new Error(`Failed to read city state (player_district_cipher_progress): ${districtRowsResult.error.message}`);
  }

  let oneDistrict = 0;
  let twoDistricts = 0;
  let threeDistricts = 0;
  for (const count of sigilCountByPlayer.values()) {
    if (count === 1) oneDistrict += 1;
    else if (count === 2) twoDistricts += 1;
    else if (count >= 3) threeDistricts += 1;
  }

  return {
    eventId,
    registeredPlayers,
    activePlayers,
    totalCompletedQuests,
    districtProgress,
    totalPlayerLinks: linkStats.totalLinks,
    totalSignalCarriers: signalCarrierCount,
    sigilDistribution: { oneDistrict, twoDistricts, threeDistricts },
    convergenceReadyPlayers: threeDistricts,
    computedAt: new Date().toISOString(),
  };
}
