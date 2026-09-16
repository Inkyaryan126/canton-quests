import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridOnboardingEvidence,
  GridOnboardingStatusPort,
} from './onboarding-status-port';

type OnboardingEventRow = {
  event_type: string;
  payload: Record<string, unknown> | null;
};

const ONBOARDING_EVENT_TYPES = [
  'grid:territory_claimed',
  'grid:property_developed',
  'grid:resources_settled',
  'grid:tutorial_contest_completed',
  'grid:onboarding_completed',
] as const;

function positiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function createSupabaseGridOnboardingStatusPort(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): GridOnboardingStatusPort {
  if (!client) {
    throw new Error(
      'Grid onboarding status requires Supabase service-role configuration',
    );
  }

  return {
    async getEvidence(playerId): Promise<GridOnboardingEvidence> {
      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', pkg.city.slug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(
          `Failed to read Grid onboarding city: ${cityResult.error.message}`,
        );
      }

      if (!cityResult.data) {
        return {
          homeCityConfirmed: false,
          seasonJoined: false,
          starterTerritoryClaimed: false,
          firstUpgradeCompleted: false,
          firstIncomeObserved: false,
          tutorialContestCompleted: false,
          fullCityUnlocked: false,
        };
      }

      const cityId = (cityResult.data as { id: string }).id;
      const seasonResult = await client
        .from('grid_seasons')
        .select('id')
        .eq('city_id', cityId)
        .eq('slug', pkg.seasonTemplate.slug)
        .maybeSingle();
      if (seasonResult.error) {
        throw new Error(
          `Failed to read Grid onboarding season: ${seasonResult.error.message}`,
        );
      }

      const seasonId = (seasonResult.data as { id: string } | null)?.id ?? null;

      const profileResult = await client
        .from('grid_player_profiles')
        .select('home_city_id')
        .eq('player_id', playerId)
        .maybeSingle();
      if (profileResult.error) {
        throw new Error(
          `Failed to read Grid onboarding profile: ${profileResult.error.message}`,
        );
      }
      const homeCityConfirmed =
        (profileResult.data as { home_city_id: string | null } | null)
          ?.home_city_id === cityId;

      if (!seasonId) {
        return {
          homeCityConfirmed,
          seasonJoined: false,
          starterTerritoryClaimed: false,
          firstUpgradeCompleted: false,
          firstIncomeObserved: false,
          tutorialContestCompleted: false,
          fullCityUnlocked: false,
        };
      }

      const stateResult = await client
        .from('grid_player_season_state')
        .select('id')
        .eq('season_id', seasonId)
        .eq('player_id', playerId)
        .maybeSingle();
      if (stateResult.error) {
        throw new Error(
          `Failed to read Grid onboarding season state: ${stateResult.error.message}`,
        );
      }
      const seasonJoined = Boolean(stateResult.data);

      const eventResult = await client
        .from('grid_game_events')
        .select('event_type,payload')
        .eq('season_id', seasonId)
        .eq('actor_player_id', playerId)
        .in('event_type', [...ONBOARDING_EVENT_TYPES]);
      if (eventResult.error) {
        throw new Error(
          `Failed to read Grid onboarding events: ${eventResult.error.message}`,
        );
      }

      const events = (eventResult.data ?? []) as OnboardingEventRow[];
      const starterTerritoryClaimed = events.some(
        (event) =>
          event.event_type === 'grid:territory_claimed' &&
          event.payload?.claimMode === 'starter',
      );
      const firstUpgradeCompleted = events.some(
        (event) => event.event_type === 'grid:property_developed',
      );
      const firstIncomeObserved = events.some(
        (event) =>
          event.event_type === 'grid:resources_settled' &&
          (positiveNumber(event.payload?.creditsEarned) ||
            positiveNumber(event.payload?.influenceEarned)),
      );
      const tutorialContestCompleted = events.some(
        (event) => event.event_type === 'grid:tutorial_contest_completed',
      );
      const fullCityUnlocked = events.some(
        (event) => event.event_type === 'grid:onboarding_completed',
      );

      return {
        homeCityConfirmed,
        seasonJoined,
        starterTerritoryClaimed,
        firstUpgradeCompleted,
        firstIncomeObserved,
        tutorialContestCompleted,
        fullCityUnlocked,
      };
    },
  };
}
