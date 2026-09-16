import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridTerritoryClaimResult } from './territory-claim-port';
import type { GridOnboardingStarterClaimPort } from './onboarding-starter-claim-port';

function requireResult(data: unknown): GridTerritoryClaimResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(
      'Grid onboarding starter claim returned an invalid result',
    );
  }
  return data as GridTerritoryClaimResult;
}

export function createSupabaseGridOnboardingStarterClaimPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridOnboardingStarterClaimPort {
  if (!client) {
    throw new Error(
      'Grid onboarding starter claims require Supabase service-role configuration',
    );
  }

  return {
    async claimStarterTerritory(command) {
      const { data, error } = await client.rpc(
        'grid_claim_onboarding_starter_territory',
        {
          p_season_id: command.seasonId,
          p_player_id: command.playerId,
          p_territory_id: command.territoryId,
          p_idempotency_key: command.idempotencyKey,
          p_now: command.now,
        },
      );

      if (error) {
        throw new Error(
          `Failed to claim Grid onboarding starter territory: ${error.message}`,
        );
      }

      return requireResult(data);
    },
  };
}
