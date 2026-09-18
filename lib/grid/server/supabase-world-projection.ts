import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridWorldRuntimeContestState,
  GridWorldRuntimePlayerState,
  GridWorldRuntimePropertyState,
  GridWorldRuntimeSnapshot,
  GridWorldRuntimeTerritoryState,
} from './world-projection';

type CityRow = { id: string };
type SeasonRow = { id: string; status: string; starts_at: string | null; surge_starts_at: string | null; ends_at: string | null };
type SlugRow = { id: string; slug: string };

function throwIfError(error: { message?: string } | null, label: string): void {
  if (error) throw new Error(`Failed to read Grid ${label}: ${error.message ?? 'unknown error'}`);
}

function isMissingContestTable(
  error: { code?: string; message?: string } | null,
): boolean {
  return Boolean(
    error &&
      (error.code === '42P01' ||
        (error.message?.includes('grid_contests') &&
          error.message.includes('does not exist'))),
  );
}

export async function readSupabaseGridWorldRuntime(
  pkg: GridCityPackage,
  viewerPlayerId: string | null,
  client: SupabaseClient | null = supabaseAdmin,
): Promise<GridWorldRuntimeSnapshot | null> {
  if (!client) return null;

  const cityResult = await client
    .from('grid_cities')
    .select('id')
    .eq('slug', pkg.city.slug)
    .maybeSingle();
  throwIfError(cityResult.error, 'city');
  const city = cityResult.data as CityRow | null;
  if (!city) return null;

  const seasonResult = await client
    .from('grid_seasons')
    .select('id,status,starts_at,surge_starts_at,ends_at')
    .eq('city_id', city.id)
    .eq('slug', pkg.seasonTemplate.slug)
    .maybeSingle();
  throwIfError(seasonResult.error, 'season');
  const season = seasonResult.data as SeasonRow | null;
  if (!season) return null;

  const territoryResult = await client
    .from('grid_territories')
    .select('id,slug')
    .eq('city_id', city.id);
  throwIfError(territoryResult.error, 'territories');
  const territoryRows = (territoryResult.data ?? []) as SlugRow[];
  const territorySlugById = new Map(territoryRows.map((row) => [row.id, row.slug]));

  const propertyResult = await client
    .from('grid_properties')
    .select('id,slug')
    .eq('city_id', city.id);
  throwIfError(propertyResult.error, 'properties');
  const propertyRows = (propertyResult.data ?? []) as SlugRow[];
  const propertySlugById = new Map(propertyRows.map((row) => [row.id, row.slug]));

  const territoryStateResult = await client
    .from('grid_season_territory_state')
    .select('territory_id,owner_player_id,claimed_at')
    .eq('season_id', season.id);
  throwIfError(territoryStateResult.error, 'territory ownership');

  const territories: GridWorldRuntimeTerritoryState[] = (
    (territoryStateResult.data ?? []) as Array<{
      territory_id: string;
      owner_player_id: string | null;
      claimed_at: string | null;
    }>
  ).flatMap((row) => {
    const territorySlug = territorySlugById.get(row.territory_id);
    return territorySlug
      ? [{
          territorySlug,
          ownerPlayerId: row.owner_player_id,
          claimedAt: row.claimed_at,
        }]
      : [];
  });

  const propertyStateResult = await client
    .from('grid_season_property_state')
    .select('property_id,owner_player_id,acquired_at,development_branch,development_level,condition_bps')
    .eq('season_id', season.id);
  throwIfError(propertyStateResult.error, 'property ownership');

  const properties: GridWorldRuntimePropertyState[] = (
    (propertyStateResult.data ?? []) as Array<{
      property_id: string;
      owner_player_id: string | null;
      acquired_at: string | null;
      development_branch: GridWorldRuntimePropertyState['developmentBranch'];
      development_level: number;
      condition_bps: number;
    }>
  ).flatMap((row) => {
    const propertySlug = propertySlugById.get(row.property_id);
    return propertySlug
      ? [{
          propertySlug,
          ownerPlayerId: row.owner_player_id,
          acquiredAt: row.acquired_at,
          developmentBranch: row.development_branch,
          developmentLevel: row.development_level,
          conditionBps: row.condition_bps,
        }]
      : [];
  });

  const contestResult = await client
    .from('grid_contests')
    .select(
      'id,source_territory_id,target_territory_id,attacker_player_id,defender_player_id,attacker_remaining_influence,defender_remaining_influence,round_number,status,started_at',
    )
    .eq('season_id', season.id)
    .eq('status', 'active');

  let contests: GridWorldRuntimeContestState[] = [];
  if (!isMissingContestTable(contestResult.error)) {
    throwIfError(contestResult.error, 'active contests');
    contests = (
      (contestResult.data ?? []) as Array<{
        id: string;
        source_territory_id: string;
        target_territory_id: string;
        attacker_player_id: string;
        defender_player_id: string;
        attacker_remaining_influence: number;
        defender_remaining_influence: number;
        round_number: number;
        status: GridWorldRuntimeContestState['status'];
        started_at: string;
      }>
    ).flatMap((row) => {
      const sourceTerritorySlug = territorySlugById.get(row.source_territory_id);
      const targetTerritorySlug = territorySlugById.get(row.target_territory_id);
      return sourceTerritorySlug && targetTerritorySlug
        ? [{
            contestId: row.id,
            sourceTerritorySlug,
            targetTerritorySlug,
            attackerPlayerId: row.attacker_player_id,
            defenderPlayerId: row.defender_player_id,
            attackerRemainingInfluence: Number(row.attacker_remaining_influence),
            defenderRemainingInfluence: Number(row.defender_remaining_influence),
            roundNumber: Number(row.round_number),
            status: row.status,
            startedAt: row.started_at,
          }]
        : [];
    });
  }

  let playerState: GridWorldRuntimePlayerState | null = null;
  if (viewerPlayerId) {
    const playerResult = await client
      .from('grid_player_season_state')
      .select(
        'credits,influence,command_points,resources_settled_at,credits_accrual_remainder,influence_accrual_remainder',
      )
      .eq('season_id', season.id)
      .eq('player_id', viewerPlayerId)
      .maybeSingle();
    throwIfError(playerResult.error, 'player season state');
    const row = playerResult.data as {
      credits: number;
      influence: number;
      command_points: number;
      resources_settled_at: string;
      credits_accrual_remainder: number;
      influence_accrual_remainder: number;
    } | null;

    if (row) {
      playerState = {
        credits: Number(row.credits),
        influence: Number(row.influence),
        commandPoints: Number(row.command_points),
        resourcesSettledAt: row.resources_settled_at,
        creditsAccrualRemainder: Number(row.credits_accrual_remainder),
        influenceAccrualRemainder: Number(row.influence_accrual_remainder),
      };
    }
  }

  return {
    seasonId: season.id,
    seasonStatus: season.status,
    startsAt: season.starts_at,
    surgeStartsAt: season.surge_starts_at,
    endsAt: season.ends_at,
    territories,
    properties,
    contests,
    playerState,
  };
}
