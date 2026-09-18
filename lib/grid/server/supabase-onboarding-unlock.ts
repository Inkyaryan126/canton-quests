import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridOnboardingUnlockContext,
  GridOnboardingUnlockPort,
} from './onboarding-unlock-port';

export function createSupabaseGridOnboardingUnlockPort(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): GridOnboardingUnlockPort {
  if (!client) {
    throw new Error(
      'Grid onboarding unlock requires Supabase service-role configuration',
    );
  }

  return {
    async getContext(playerId): Promise<GridOnboardingUnlockContext | null> {
      if (!playerId.trim()) return null;

      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', pkg.city.slug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(
          `Failed to resolve Grid onboarding unlock city: ${cityResult.error.message}`,
        );
      }
      if (!cityResult.data) return null;

      const cityId = (cityResult.data as { id: string }).id;
      const seasonResult = await client
        .from('grid_seasons')
        .select('id,status')
        .eq('city_id', cityId)
        .eq('slug', pkg.seasonTemplate.slug)
        .maybeSingle();

      if (seasonResult.error) {
        throw new Error(
          `Failed to resolve Grid onboarding unlock season: ${seasonResult.error.message}`,
        );
      }
      if (!seasonResult.data) return null;

      const season = seasonResult.data as { id: string; status: string };
      return {
        cityId,
        seasonId: season.id,
        seasonStatus: season.status,
      };
    },
  };
}
