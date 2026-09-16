import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridOnboardingHomeCityPort,
  GridOnboardingHomeCityResult,
} from './onboarding-home-city-port';

export function createSupabaseGridOnboardingHomeCityPort(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): GridOnboardingHomeCityPort {
  if (!client) {
    throw new Error(
      'Grid onboarding Home City requires Supabase service-role configuration',
    );
  }
  const resolvedClient = client;

  async function resolveCityId(): Promise<string> {
    const cityResult = await resolvedClient
      .from('grid_cities')
      .select('id')
      .eq('slug', pkg.city.slug)
      .maybeSingle();

    if (cityResult.error) {
      throw new Error(
        `Failed to resolve Grid onboarding Home City: ${cityResult.error.message}`,
      );
    }
    if (!cityResult.data) {
      throw new Error('GRID_CITY_NOT_IMPORTED');
    }

    return (cityResult.data as { id: string }).id;
  }

  return {
    async isHomeCityConfirmed(playerId) {
      const cityId = await resolveCityId();
      const profileResult = await resolvedClient
        .from('grid_player_profiles')
        .select('home_city_id')
        .eq('player_id', playerId)
        .maybeSingle();

      if (profileResult.error) {
        throw new Error(
          `Failed to read Grid onboarding Home City profile: ${profileResult.error.message}`,
        );
      }

      return (
        (profileResult.data as { home_city_id: string | null } | null)
          ?.home_city_id === cityId
      );
    },

    async confirmHomeCity(
      playerId,
      now,
    ): Promise<GridOnboardingHomeCityResult> {
      const cityId = await resolveCityId();
      const existingProfileResult = await resolvedClient
        .from('grid_player_profiles')
        .select('home_city_id')
        .eq('player_id', playerId)
        .maybeSingle();

      if (existingProfileResult.error) {
        throw new Error(
          `Failed to read Grid onboarding Home City profile: ${existingProfileResult.error.message}`,
        );
      }

      const existingHomeCityId = (
        existingProfileResult.data as { home_city_id: string | null } | null
      )?.home_city_id;

      if (existingHomeCityId && existingHomeCityId !== cityId) {
        throw new Error('GRID_HOME_CITY_ALREADY_SET');
      }

      const { data, error } = await resolvedClient
        .from('grid_player_profiles')
        .upsert(
          {
            player_id: playerId,
            home_city_id: cityId,
            updated_at: now,
          },
          { onConflict: 'player_id' },
        )
        .select('home_city_id')
        .single();

      if (error) {
        throw new Error(
          `Failed to confirm Grid onboarding Home City: ${error.message}`,
        );
      }

      return {
        cityId,
        citySlug: pkg.city.slug,
        confirmed:
          (data as { home_city_id: string }).home_city_id === cityId,
      };
    },
  };
}
