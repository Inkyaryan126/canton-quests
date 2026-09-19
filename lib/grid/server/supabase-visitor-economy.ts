import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridVisitorEconomyEvidence,
  GridVisitorEconomyEvidencePort,
} from './visitor-economy-port';

type CityRow = { id: string; slug: string };
type ProfileRow = { home_city_id: string | null };
type SeasonRow = { id: string; status: string };

function requireValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Grid visitor economy adapter requires ${field}`);
  }
  return normalized;
}

export function createSupabaseGridVisitorEconomyEvidencePort(
  client: SupabaseClient | null = supabaseAdmin,
): GridVisitorEconomyEvidencePort {
  if (!client) {
    throw new Error(
      'Grid visitor economy evidence requires Supabase service-role configuration',
    );
  }

  return {
    async readEvidence(playerId, targetCitySlug): Promise<GridVisitorEconomyEvidence> {
      const normalizedPlayerId = requireValue(playerId, 'playerId');
      const normalizedTargetCitySlug = requireValue(
        targetCitySlug,
        'targetCitySlug',
      );

      const targetCityResult = await client
        .from('grid_cities')
        .select('id,slug')
        .eq('slug', normalizedTargetCitySlug)
        .maybeSingle();
      if (targetCityResult.error) {
        throw new Error(
          `Failed to read Grid visitor target city: ${targetCityResult.error.message}`,
        );
      }
      const targetCity = targetCityResult.data as CityRow | null;
      if (!targetCity) {
        throw new Error('GRID_VISITOR_TARGET_CITY_NOT_FOUND');
      }

      const profileResult = await client
        .from('grid_player_profiles')
        .select('home_city_id')
        .eq('player_id', normalizedPlayerId)
        .maybeSingle();
      if (profileResult.error) {
        throw new Error(
          `Failed to read Grid visitor profile: ${profileResult.error.message}`,
        );
      }
      const profile = profileResult.data as ProfileRow | null;

      let homeCitySlug: string | null = null;
      if (profile?.home_city_id) {
        const homeCityResult = await client
          .from('grid_cities')
          .select('id,slug')
          .eq('id', profile.home_city_id)
          .maybeSingle();
        if (homeCityResult.error) {
          throw new Error(
            `Failed to read Grid visitor Home City: ${homeCityResult.error.message}`,
          );
        }
        const homeCity = homeCityResult.data as CityRow | null;
        if (!homeCity) {
          throw new Error('GRID_VISITOR_HOME_CITY_NOT_FOUND');
        }
        homeCitySlug = homeCity.slug;
      }

      const playableSeasonResult = await client
        .from('grid_seasons')
        .select('id,status')
        .eq('city_id', targetCity.id)
        .in('status', ['active', 'surge']);
      if (playableSeasonResult.error) {
        throw new Error(
          `Failed to read Grid visitor playable season: ${playableSeasonResult.error.message}`,
        );
      }
      const playableSeasons = (playableSeasonResult.data ?? []) as SeasonRow[];

      let ownedPropertyCount: number | null = null;
      if (playableSeasons.length === 1) {
        const propertyCountResult = await client
          .from('grid_season_property_state')
          .select('id', { count: 'exact', head: true })
          .eq('season_id', playableSeasons[0].id)
          .eq('city_id', targetCity.id)
          .eq('owner_player_id', normalizedPlayerId);
        if (propertyCountResult.error) {
          throw new Error(
            `Failed to count Grid visitor properties: ${propertyCountResult.error.message}`,
          );
        }
        ownedPropertyCount =
          typeof propertyCountResult.count === 'number'
            ? propertyCountResult.count
            : null;
      }

      return {
        targetCitySlug: targetCity.slug,
        homeCitySlug,
        // These metrics intentionally remain unknown until authoritative
        // accounting semantics exist. Null means "not proven", not zero.
        localInvestmentCredits: null,
        ownedPropertyCount,
        deploymentsUsed: null,
        residencyPoints: null,
      };
    },
  };
}
