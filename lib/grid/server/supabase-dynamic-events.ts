import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridDynamicEventInstance,
  GridDynamicEventKind,
  GridDynamicEventModifier,
  GridDynamicEventTarget,
} from '../core/dynamic-event-types';
import type {
  GridDynamicEventInsertInput,
  GridDynamicEventPort,
} from './dynamic-event-port';

interface CityRow {
  id: string;
}

interface SeasonRow {
  id: string;
}

interface DynamicEventRow {
  instance_key: string;
  template_id: string;
  kind: GridDynamicEventKind;
  priority: number;
  starts_at: string;
  ends_at: string;
  target: GridDynamicEventTarget;
  modifiers: GridDynamicEventModifier[];
  tags: string[];
}

function mapRow(
  citySlug: string,
  row: DynamicEventRow,
): GridDynamicEventInstance {
  return {
    instanceId: row.instance_key,
    templateId: row.template_id,
    cityId: citySlug,
    kind: row.kind,
    priority: Number(row.priority),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    target: row.target,
    modifiers: row.modifiers ?? [],
    tags: row.tags ?? [],
  };
}

async function resolveCityAndSeason(
  client: SupabaseClient,
  citySlug: string,
  seasonSlug: string,
): Promise<{ cityId: string; seasonId: string }> {
  const cityResult = await client
    .from('grid_cities')
    .select('id')
    .eq('slug', citySlug)
    .maybeSingle();

  if (cityResult.error) {
    throw new Error(
      `Failed to resolve Grid dynamic event city: ${cityResult.error.message}`,
    );
  }

  const city = cityResult.data as CityRow | null;
  if (!city) {
    throw new Error(`Grid dynamic event city not found: ${citySlug}`);
  }

  const seasonResult = await client
    .from('grid_seasons')
    .select('id')
    .eq('city_id', city.id)
    .eq('slug', seasonSlug)
    .maybeSingle();

  if (seasonResult.error) {
    throw new Error(
      `Failed to resolve Grid dynamic event season: ${seasonResult.error.message}`,
    );
  }

  const season = seasonResult.data as SeasonRow | null;
  if (!season) {
    throw new Error(`Grid dynamic event season not found: ${seasonSlug}`);
  }

  return { cityId: city.id, seasonId: season.id };
}

export function createSupabaseGridDynamicEventPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridDynamicEventPort {
  if (!client) {
    throw new Error(
      'Grid dynamic events require Supabase service-role configuration',
    );
  }

  return {
    async listActive(citySlug, seasonSlug, now) {
      const { cityId, seasonId } = await resolveCityAndSeason(
        client,
        citySlug,
        seasonSlug,
      );

      const result = await client
        .from('grid_dynamic_event_instances')
        .select(
          'instance_key,template_id,kind,priority,starts_at,ends_at,target,modifiers,tags',
        )
        .eq('city_id', cityId)
        .eq('season_id', seasonId)
        .lte('starts_at', now)
        .gt('ends_at', now)
        .order('priority', { ascending: false })
        .order('starts_at', { ascending: true });

      if (result.error) {
        throw new Error(
          `Failed to read Grid dynamic events: ${result.error.message}`,
        );
      }

      return ((result.data ?? []) as DynamicEventRow[]).map((row) =>
        mapRow(citySlug, row),
      );
    },

    async insert(input: GridDynamicEventInsertInput) {
      const { cityId, seasonId } = await resolveCityAndSeason(
        client,
        input.instance.cityId,
        input.seasonSlug,
      );

      const result = await client.rpc('grid_start_dynamic_event_instance', {
        p_city_id: cityId,
        p_season_id: seasonId,
        p_instance_key: input.instance.instanceId,
        p_template_id: input.instance.templateId,
        p_kind: input.instance.kind,
        p_priority: input.instance.priority,
        p_starts_at: input.instance.startsAt,
        p_ends_at: input.instance.endsAt,
        p_target: input.instance.target,
        p_modifiers: input.instance.modifiers,
        p_tags: input.instance.tags,
        p_idempotency_key: input.idempotencyKey,
      });

      if (result.error) {
        throw new Error(
          `Failed to start Grid dynamic event: ${result.error.message}`,
        );
      }

      const payload = result.data as
        | { status?: string; instance?: DynamicEventRow | null }
        | null;

      if (
        (payload?.status !== 'inserted' &&
          payload?.status !== 'duplicate') ||
        !payload.instance
      ) {
        throw new Error('Grid dynamic event persistence returned invalid result');
      }

      return {
        instance: mapRow(input.instance.cityId, payload.instance),
        duplicate: payload.status === 'duplicate',
      };
    },
  };
}
