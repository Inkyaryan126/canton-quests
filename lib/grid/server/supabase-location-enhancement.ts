import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridLocationEnhancementBenefit } from '../core/location-enhancement-types';
import type {
  GridLocationEnhancementGrantInput,
  GridLocationEnhancementGrantRecord,
  GridLocationEnhancementPort,
} from './location-enhancement-port';

interface GrantRow {
  id: string;
  season_id: string;
  player_id: string;
  rule_id: string;
  verification_id: string;
  benefit: GridLocationEnhancementBenefit;
  idempotency_key: string;
  claimed_at: string;
}

function mapGrant(row: GrantRow): GridLocationEnhancementGrantRecord {
  return {
    id: row.id,
    seasonId: row.season_id,
    playerId: row.player_id,
    ruleId: row.rule_id,
    verificationId: row.verification_id,
    benefit: row.benefit,
    idempotencyKey: row.idempotency_key,
    claimedAt: row.claimed_at,
  };
}

export function createSupabaseGridLocationEnhancementPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridLocationEnhancementPort {
  if (!client) {
    throw new Error(
      'Grid location enhancement persistence requires Supabase service-role configuration',
    );
  }

  return {
    async findByIdempotencyKey(seasonId, playerId, idempotencyKey) {
      const result = await client
        .from('grid_location_enhancement_claims')
        .select(
          'id,season_id,player_id,rule_id,verification_id,benefit,idempotency_key,claimed_at',
        )
        .eq('season_id', seasonId)
        .eq('player_id', playerId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (result.error) {
        throw new Error(
          'Failed to reconcile Grid location enhancement claim: ' +
            result.error.message,
        );
      }

      return result.data ? mapGrant(result.data as GrantRow) : null;
    },

    async countRuleClaims(seasonId, playerId, ruleId) {
      const result = await client
        .from('grid_location_enhancement_claims')
        .select('id', { count: 'exact', head: true })
        .eq('season_id', seasonId)
        .eq('player_id', playerId)
        .eq('rule_id', ruleId);

      if (result.error) {
        throw new Error(
          'Failed to count Grid location enhancement claims: ' +
            result.error.message,
        );
      }

      return result.count ?? 0;
    },

    async insertGrantAtomic(input: GridLocationEnhancementGrantInput) {
      const result = await client.rpc('grid_claim_location_enhancement', {
        p_season_id: input.seasonId,
        p_player_id: input.playerId,
        p_rule_id: input.ruleId,
        p_verification_id: input.verificationId,
        p_benefit: input.benefit,
        p_idempotency_key: input.idempotencyKey,
        p_claimed_at: input.claimedAt,
        p_max_claims: input.maxClaimsPerPlayer,
      });

      if (result.error) {
        throw new Error(
          'Failed to persist Grid location enhancement claim: ' +
            result.error.message,
        );
      }

      const payload = result.data as
        | {
            status?: string;
            grant?: GrantRow | null;
          }
        | null;

      if (payload?.status === 'limit_reached') {
        return { grant: null, duplicate: false, limitReached: true };
      }

      if (
        payload?.status !== 'inserted' &&
        payload?.status !== 'duplicate'
      ) {
        throw new Error(
          'Grid location enhancement claim returned an invalid status',
        );
      }

      if (!payload.grant) {
        throw new Error(
          'Grid location enhancement claim returned no persisted grant',
        );
      }

      return {
        grant: mapGrant(payload.grant),
        duplicate: payload.status === 'duplicate',
        limitReached: false,
      };
    },
  };
}
