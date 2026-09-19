import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import { cantonDominanceHeatConfig } from '../cities/canton/dominance-heat';
import { deriveGridNpcDominancePressure } from './npc-dominance-pressure';
import type { GridNpcStrongholdRuntimeEvidencePort } from './npc-stronghold-runtime-port';

interface GridNpcSeasonRuntimeRow {
  id: string;
  city_id: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
}

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

function requireExactCount(value: number | null, label: string): number {
  if (!Number.isSafeInteger(value) || (value ?? -1) < 0) {
    throw new Error(`Grid NPC runtime ${label} returned an invalid count`);
  }
  return value!;
}

function parseOptionalTimestamp(value: string | null, label: string): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Grid NPC runtime stored ${label} timestamp is invalid`);
  }
  return parsed;
}

export function isGridNpcSeasonActiveAt(
  season: Pick<GridNpcSeasonRuntimeRow, 'status' | 'starts_at' | 'ends_at'>,
  now: string,
): boolean {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) {
    throw new Error('Grid NPC runtime requires a valid now timestamp');
  }
  if (season.status !== 'active' && season.status !== 'surge') return false;
  const startsAt = parseOptionalTimestamp(season.starts_at, 'startsAt');
  const endsAt = parseOptionalTimestamp(season.ends_at, 'endsAt');
  if (startsAt !== null && nowMs < startsAt) return false;
  if (endsAt !== null && nowMs >= endsAt) return false;
  return true;
}

async function readCantonDominancePressureBps(
  client: SupabaseClient,
  cityId: string,
  seasonId: string,
): Promise<number> {
  const [territoryResult, ownershipResult, allianceResult, membershipResult] =
    await Promise.all([
      client
        .from('grid_territories')
        .select('id', { count: 'exact', head: true })
        .eq('city_id', cityId),
      client
        .from('grid_season_territory_state')
        .select('owner_player_id')
        .eq('season_id', seasonId)
        .not('owner_player_id', 'is', null),
      client
        .from('grid_alliances')
        .select('id')
        .eq('season_id', seasonId)
        .eq('status', 'active'),
      client
        .from('grid_alliance_memberships')
        .select('alliance_id,player_id')
        .eq('season_id', seasonId)
        .is('left_at', null),
    ]);

  if (territoryResult.error) {
    throw new Error(
      `Failed to read Grid NPC Dominance eligible territories: ${territoryResult.error.message}`,
    );
  }
  if (ownershipResult.error) {
    throw new Error(
      `Failed to read Grid NPC Dominance ownership: ${ownershipResult.error.message}`,
    );
  }
  if (allianceResult.error) {
    throw new Error(
      `Failed to read Grid NPC Dominance alliances: ${allianceResult.error.message}`,
    );
  }
  if (membershipResult.error) {
    throw new Error(
      `Failed to read Grid NPC Dominance memberships: ${membershipResult.error.message}`,
    );
  }

  const activeAllianceIds = new Set(
    ((allianceResult.data ?? []) as Array<{ id: string }>).map((row) => row.id),
  );
  const allianceMemberships = (
    (membershipResult.data ?? []) as Array<{
      alliance_id: string;
      player_id: string;
    }>
  )
    .filter((row) => activeAllianceIds.has(row.alliance_id))
    .map((row) => ({
      allianceId: row.alliance_id,
      playerId: row.player_id,
    }));

  return deriveGridNpcDominancePressure(
    {
      eligibleTerritories: requireExactCount(
        territoryResult.count,
        'Dominance eligible territories',
      ),
      ownerPlayerIds: (
        (ownershipResult.data ?? []) as Array<{
          owner_player_id: string | null;
        }>
      ).flatMap((row) => (row.owner_player_id ? [row.owner_player_id] : [])),
      allianceMemberships,
    },
    cantonDominanceHeatConfig,
  ).pressureBps;
}

export function createSupabaseGridNpcStrongholdRuntimeEvidencePort(
  client: SupabaseClient | null = supabaseAdmin,
): GridNpcStrongholdRuntimeEvidencePort {
  if (!client) {
    throw new Error('Grid NPC runtime evidence requires Supabase service-role configuration');
  }

  return {
    async readEvidence(request) {
      const cityResult = await client
        .from('grid_cities')
        .select('id,slug')
        .eq('slug', request.citySlug)
        .single();
      if (cityResult.error) {
        throw new Error(`Failed to resolve Grid NPC runtime city: ${cityResult.error.message}`);
      }
      const city = requireObject<{ id: string; slug: string }>(cityResult.data, 'Grid NPC runtime city');

      const seasonResult = await client
        .from('grid_seasons')
        .select('id,city_id,slug,status,starts_at,ends_at')
        .eq('city_id', city.id)
        .eq('slug', request.seasonSlug)
        .single();
      if (seasonResult.error) {
        throw new Error(`Failed to resolve Grid NPC runtime season: ${seasonResult.error.message}`);
      }
      const season = requireObject<GridNpcSeasonRuntimeRow & { slug: string }>(
        seasonResult.data,
        'Grid NPC runtime season',
      );
      const seasonActive = isGridNpcSeasonActiveAt(season, request.now);

      const seasonRuntimePromise = client
        .from('grid_npc_season_runtime_state')
        .select('city_id,surge_intensity_bps')
        .eq('season_id', season.id)
        .maybeSingle();
      const eventPromise = request.strongholdIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : client
          .from('grid_npc_stronghold_event_state')
          .select('city_id,stronghold_id,active')
          .eq('season_id', season.id)
          .in('stronghold_id', request.strongholdIds);
      const pressurePromise = request.factionIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : client
          .from('grid_npc_faction_pressure_state')
          .select('city_id,faction_id,pressure_bps')
          .eq('season_id', season.id)
          .in('faction_id', request.factionIds);

      const [seasonRuntimeResult, eventResult, pressureResult] = await Promise.all([
        seasonRuntimePromise,
        eventPromise,
        pressurePromise,
      ]);
      if (seasonRuntimeResult.error) {
        throw new Error(`Failed to read Grid NPC season runtime: ${seasonRuntimeResult.error.message}`);
      }
      if (eventResult.error) {
        throw new Error(`Failed to read Grid NPC event runtime: ${eventResult.error.message}`);
      }
      if (pressureResult.error) {
        throw new Error(`Failed to read Grid NPC faction runtime: ${pressureResult.error.message}`);
      }

      const seasonRuntime = seasonRuntimeResult.data as {
        city_id: string;
        surge_intensity_bps: number | null;
      } | null;
      if (seasonRuntime && seasonRuntime.city_id !== city.id) {
        throw new Error('Grid NPC season runtime belongs to the wrong city');
      }

      const eventActiveByStrongholdId: Record<string, boolean> = {};
      for (const row of (eventResult.data ?? []) as Array<{
        city_id: string;
        stronghold_id: string;
        active: boolean;
      }>) {
        if (row.city_id !== city.id || !request.strongholdIds.includes(row.stronghold_id)) {
          throw new Error('Grid NPC event runtime returned unexpected identity');
        }
        eventActiveByStrongholdId[row.stronghold_id] = row.active;
      }

      const factionPressureBpsByFaction: Record<string, number> = {};
      for (const row of (pressureResult.data ?? []) as Array<{
        city_id: string;
        faction_id: string;
        pressure_bps: number;
      }>) {
        if (row.city_id !== city.id || !request.factionIds.includes(row.faction_id)) {
          throw new Error('Grid NPC faction runtime returned unexpected identity');
        }
        factionPressureBpsByFaction[row.faction_id] = row.pressure_bps;
      }

      const missingFactionIds = request.factionIds.filter(
        (factionId) => factionPressureBpsByFaction[factionId] === undefined,
      );
      if (
        seasonActive &&
        city.slug === 'canton-oh' &&
        missingFactionIds.length > 0
      ) {
        const dominancePressureBps = await readCantonDominancePressureBps(
          client,
          city.id,
          season.id,
        );
        for (const factionId of missingFactionIds) {
          factionPressureBpsByFaction[factionId] = dominancePressureBps;
        }
      }

      return {
        citySlug: city.slug,
        seasonSlug: season.slug,
        seasonActive,
        surgeIntensityBps: seasonRuntime?.surge_intensity_bps ?? null,
        eventActiveByStrongholdId,
        factionPressureBpsByFaction,
      };
    },
  };
}
