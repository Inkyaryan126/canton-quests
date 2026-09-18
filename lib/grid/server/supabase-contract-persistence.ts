import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridContractInstance } from '../core/contract-types';
import type {
  GridContractScope,
  GridContractCommitInput,
  GridContractCommitResult,
  GridContractStoredInstance,
} from './contract-port';
import type { GridContractPersistencePort } from './contract-persistence-port';

interface ContractInstanceRow {
  contract_id: string;
  player_id: string;
  status: GridContractInstance['status'];
  accepted_at_ms: number;
  expires_at_ms: number | null;
  completed_at_ms: number | null;
  location_enhanced: boolean;
  progress: Record<string, number>;
  version: number;
}

function requireObject<T>(value: unknown, label: string): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return value as T;
}

function mapStored(row: ContractInstanceRow): GridContractStoredInstance {
  return {
    instance: {
      contractId: row.contract_id,
      playerId: row.player_id,
      status: row.status,
      acceptedAtMs: row.accepted_at_ms,
      expiresAtMs: row.expires_at_ms,
      completedAtMs: row.completed_at_ms,
      locationEnhanced: row.location_enhanced,
      progress: row.progress,
    },
    version: row.version,
  };
}

export function createSupabaseGridContractPersistence(
  client: SupabaseClient | null = supabaseAdmin,
): GridContractPersistencePort {
  if (!client) {
    throw new Error('Grid contract persistence requires Supabase service-role configuration');
  }

  return {
    async load(scope: GridContractScope) {
      const { data, error } = await client
        .from('grid_contract_instances')
        .select('contract_id,player_id,status,accepted_at_ms,expires_at_ms,completed_at_ms,location_enhanced,progress,version')
        .eq('city_id', scope.cityId)
        .eq('season_id', scope.seasonId)
        .eq('player_id', scope.playerId)
        .eq('contract_id', scope.contractId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load Grid contract instance: ${error.message}`);
      return data ? mapStored(data as ContractInstanceRow) : null;
    },

    async commit(input: GridContractCommitInput): Promise<GridContractCommitResult> {
      const { data, error } = await client.rpc('grid_commit_contract_progress', {
        p_city_id: input.cityId,
        p_season_id: input.seasonId,
        p_player_id: input.playerId,
        p_contract_id: input.contractId,
        p_objective_id: input.objectiveId,
        p_amount: input.amount,
        p_now_ms: input.nowMs,
        p_location_enhanced: input.locationEnhanced ?? false,
        p_idempotency_key: input.idempotencyKey,
        p_expected_version: input.expectedVersion,
      });
      if (error) throw new Error(`Failed to commit Grid contract progress: ${error.message}`);
      const result = requireObject<GridContractCommitResult>(data, 'Grid contract progress commit');
      if (!['applied', 'duplicate', 'conflict'].includes(result.outcome)) {
        throw new Error('Grid contract progress commit returned an invalid outcome');
      }
      return result;
    },
  };
}
