import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type { GridOnboardingPropertyRefPort } from './onboarding-property-port';

export function createSupabaseGridOnboardingPropertyRefPort(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): GridOnboardingPropertyRefPort {
  if (!client) {
    throw new Error(
      'Grid onboarding property resolution requires Supabase service-role configuration',
    );
  }

  return {
    async resolvePropertyId(propertySlug) {
      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', pkg.city.slug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(
          `Failed to resolve Grid onboarding property city: ${cityResult.error.message}`,
        );
      }
      if (!cityResult.data) return null;
      const cityId = (cityResult.data as { id: string }).id;
      const propertyResult = await client
        .from('grid_properties')
        .select('id')
        .eq('city_id', cityId)
        .eq('slug', propertySlug)
        .maybeSingle();
      if (propertyResult.error) {
        throw new Error(
          `Failed to resolve Grid onboarding property: ${propertyResult.error.message}`,
        );
      }

      return (propertyResult.data as { id: string } | null)?.id ?? null;
    },
  };
}
