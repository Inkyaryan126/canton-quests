import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridPassportEvent,
  GridPassportProjection,
} from '../core/passport-types';
import type { GridPassportPersistencePort } from './passport-port';

export const GRID_PASSPORT_EVENT_TYPES = [
  'grid:passport_city_entered',
  'grid:passport_home_city_set',
  'grid:passport_city_rank_recorded',
  'grid:passport_championship_earned',
  'grid:passport_territory_control_recorded',
  'grid:passport_landmark_achievement_earned',
  'grid:passport_alliance_championship_earned',
  'grid:passport_seasonal_trophy_earned',
  'grid:passport_rare_cosmetic_earned',
  'grid:passport_reputation_earned',
] as const;

type PassportEventType = (typeof GRID_PASSPORT_EVENT_TYPES)[number];

interface PassportEventRow {
  id: string;
  event_type: PassportEventType;
  payload: Record<string, unknown> | null;
  created_at: string;
}

const coreTypeByEventType: Record<PassportEventType, GridPassportEvent['type']> = {
  'grid:passport_city_entered': 'city-entered',
  'grid:passport_home_city_set': 'home-city-set',
  'grid:passport_city_rank_recorded': 'city-rank-recorded',
  'grid:passport_championship_earned': 'championship-earned',
  'grid:passport_territory_control_recorded': 'territory-control-recorded',
  'grid:passport_landmark_achievement_earned': 'landmark-achievement-earned',
  'grid:passport_alliance_championship_earned': 'alliance-championship-earned',
  'grid:passport_seasonal_trophy_earned': 'seasonal-trophy-earned',
  'grid:passport_rare_cosmetic_earned': 'rare-cosmetic-earned',
  'grid:passport_reputation_earned': 'reputation-earned',
};

function mapPassportEvent(row: PassportEventRow): GridPassportEvent {
  return {
    ...(row.payload ?? {}),
    id: row.id,
    type: coreTypeByEventType[row.event_type],
    occurredAt: row.created_at,
  } as GridPassportEvent;
}

export function createSupabaseGridPassportPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridPassportPersistencePort {
  if (!client) {
    throw new Error('Grid Passport persistence requires Supabase service-role configuration');
  }

  return {
    async listCareerEvents(playerId) {
      const result = await client
        .from('grid_game_events')
        .select('id,event_type,payload,created_at')
        .eq('actor_player_id', playerId)
        .in('event_type', [...GRID_PASSPORT_EVENT_TYPES])
        .order('created_at', { ascending: true });

      if (result.error) {
        throw new Error(
          'Failed to read Grid Passport events: ' + result.error.message,
        );
      }

      return ((result.data ?? []) as PassportEventRow[]).map(mapPassportEvent);
    },

    async saveProjection(
      playerId: string,
      projection: GridPassportProjection,
      rebuiltAt: string,
    ) {
      const result = await client
        .from('grid_player_profiles')
        .upsert(
          {
            player_id: playerId,
            passport: projection,
            global_reputation: projection.nationalReputation,
            updated_at: rebuiltAt,
          },
          { onConflict: 'player_id' },
        );

      if (result.error) {
        throw new Error(
          'Failed to cache Grid Passport projection: ' + result.error.message,
        );
      }
    },
  };
}
