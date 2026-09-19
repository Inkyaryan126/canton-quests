import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridSeasonLifecycleStatus } from '../core/season-lifecycle';
import type {
  GridSeasonLifecyclePort,
  GridSeasonLifecycleTransitionResult,
} from './season-lifecycle-port';

const STATUSES = new Set<GridSeasonLifecycleStatus>([
  'draft',
  'scheduled',
  'active',
  'surge',
  'complete',
  'archived',
]);

function lifecycleStatus(value: unknown): GridSeasonLifecycleStatus {
  if (typeof value !== 'string' || !STATUSES.has(value as GridSeasonLifecycleStatus)) {
    throw new Error('Grid season lifecycle persistence returned an invalid status');
  }
  return value as GridSeasonLifecycleStatus;
}

function transitionResult(data: unknown): GridSeasonLifecycleTransitionResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Grid season lifecycle persistence returned an invalid result');
  }
  const row = data as Record<string, unknown>;
  if (
    typeof row.seasonId !== 'string' ||
    typeof row.changed !== 'boolean' ||
    typeof row.duplicate !== 'boolean' ||
    (row.eventId !== null && typeof row.eventId !== 'string') ||
    typeof row.updatedAt !== 'string'
  ) {
    throw new Error('Grid season lifecycle persistence returned an invalid result');
  }
  return {
    seasonId: row.seasonId,
    previousStatus: lifecycleStatus(row.previousStatus),
    status: lifecycleStatus(row.status),
    changed: row.changed,
    duplicate: row.duplicate,
    eventId: row.eventId,
    updatedAt: row.updatedAt,
  };
}

export function createSupabaseGridSeasonLifecyclePort(
  client: SupabaseClient | null = supabaseAdmin,
): GridSeasonLifecyclePort {
  if (!client) {
    throw new Error(
      'Grid season lifecycle requires Supabase service-role configuration',
    );
  }

  return {
    async readSeason(citySlug, seasonSlug) {
      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', citySlug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(
          'Failed to resolve Grid lifecycle city: ' + cityResult.error.message,
        );
      }
      if (!cityResult.data) return null;
      const city = cityResult.data as { id: string };

      const seasonResult = await client
        .from('grid_seasons')
        .select('id,status,starts_at,surge_starts_at,ends_at')
        .eq('city_id', city.id)
        .eq('slug', seasonSlug)
        .maybeSingle();
      if (seasonResult.error) {
        throw new Error(
          'Failed to resolve Grid lifecycle season: ' +
            seasonResult.error.message,
        );
      }
      if (!seasonResult.data) return null;

      const season = seasonResult.data as {
        id: string;
        status: string;
        starts_at: string | null;
        surge_starts_at: string | null;
        ends_at: string | null;
      };
      return {
        cityId: city.id,
        seasonId: season.id,
        status: lifecycleStatus(season.status),
        startsAt: season.starts_at,
        surgeStartsAt: season.surge_starts_at,
        endsAt: season.ends_at,
      };
    },

    async reconcile(input) {
      const result = await client.rpc('grid_reconcile_season_lifecycle', {
        p_season_id: input.seasonId,
        p_surge_hours: input.surgeHours,
        p_now: input.now,
      });
      if (result.error) {
        throw new Error(
          'Failed to reconcile Grid season lifecycle: ' + result.error.message,
        );
      }
      return transitionResult(result.data);
    },
  };
}
