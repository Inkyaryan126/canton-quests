import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridContractDefinition, GridContractInstance } from '../core/contract-types';
import type {
  GridContractReadDetailScope,
  GridContractReadPort,
  GridContractReadRecord,
  GridContractReadScope,
} from './contract-read-port';

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

interface ContractDefinitionRow {
  contract_id: string;
  definition: GridContractDefinition;
}

function mapRecord(
  instanceRow: ContractInstanceRow,
  definitionRow: ContractDefinitionRow,
): GridContractReadRecord {
  return {
    definition: definitionRow.definition,
    instance: {
      contractId: instanceRow.contract_id,
      playerId: instanceRow.player_id,
      status: instanceRow.status,
      acceptedAtMs: Number(instanceRow.accepted_at_ms),
      expiresAtMs: instanceRow.expires_at_ms === null ? null : Number(instanceRow.expires_at_ms),
      completedAtMs: instanceRow.completed_at_ms === null ? null : Number(instanceRow.completed_at_ms),
      locationEnhanced: instanceRow.location_enhanced,
      progress: instanceRow.progress,
    },
    version: Number(instanceRow.version),
  };
}

async function readDefinition(
  client: SupabaseClient,
  scope: GridContractReadDetailScope,
): Promise<ContractDefinitionRow | null> {
  const result = await client
    .from('grid_contract_definitions')
    .select('contract_id,definition')
    .eq('city_id', scope.cityId)
    .eq('season_id', scope.seasonId)
    .eq('contract_id', scope.contractId)
    .maybeSingle();
  if (result.error) {
    throw new Error(`Failed to read Grid contract definition: ${result.error.message}`);
  }
  return result.data as ContractDefinitionRow | null;
}

async function readInstance(
  client: SupabaseClient,
  scope: GridContractReadDetailScope,
  activeOnly: boolean,
): Promise<ContractInstanceRow | null> {
  let query = client
    .from('grid_contract_instances')
    .select('contract_id,player_id,status,accepted_at_ms,expires_at_ms,completed_at_ms,location_enhanced,progress,version')
    .eq('city_id', scope.cityId)
    .eq('season_id', scope.seasonId)
    .eq('player_id', scope.playerId)
    .eq('contract_id', scope.contractId);
  if (activeOnly) query = query.eq('status', 'active');
  const result = await query.maybeSingle();
  if (result.error) {
    throw new Error(`Failed to read Grid contract state: ${result.error.message}`);
  }
  return result.data as ContractInstanceRow | null;
}

export function createSupabaseGridContractReadPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridContractReadPort {
  if (!client) {
    throw new Error('Grid contract read requires Supabase service-role configuration');
  }

  return {
    async listActive(scope) {
      const result = await client
        .from('grid_contract_instances')
        .select('contract_id,player_id,status,accepted_at_ms,expires_at_ms,completed_at_ms,location_enhanced,progress,version')
        .eq('city_id', scope.cityId)
        .eq('season_id', scope.seasonId)
        .eq('player_id', scope.playerId)
        .eq('status', 'active')
        .order('contract_id', { ascending: true });
      if (result.error) {
        throw new Error(`Failed to read active Grid contracts: ${result.error.message}`);
      }

      const rows = (result.data ?? []) as ContractInstanceRow[];
      const records = await Promise.all(rows.map(async (row) => {
        const definition = await readDefinition(client, { ...scope, contractId: row.contract_id });
        if (!definition) throw new Error('Grid contract definition not found for stored state');
        return mapRecord(row, definition);
      }));
      return records;
    },

    async read(scope) {
      const instance = await readInstance(client, scope, false);
      if (!instance) return null;
      const definition = await readDefinition(client, scope);
      if (!definition) throw new Error('Grid contract definition not found for stored state');
      return mapRecord(instance, definition);
    },
  };
}
