import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridNpcStrongholdActivation } from '../core/npc-stronghold-types';
import type { GridNpcStrongholdRegistryPort } from './npc-stronghold-registry-port';

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridNpcStrongholdRegistryPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridNpcStrongholdRegistryPort {
  if (!client) {
    throw new Error('Grid NPC stronghold registry requires Supabase service-role configuration');
  }

  return {
    async readSnapshot(citySlug, seasonSlug) {
      const cityResult = await client
        .from('grid_cities')
        .select('id,slug')
        .eq('slug', citySlug)
        .single();
      if (cityResult.error) {
        throw new Error(`Failed to resolve Grid stronghold city: ${cityResult.error.message}`);
      }
      const city = requireObject<{ id: string; slug: string }>(cityResult.data, 'Grid stronghold city');

      const seasonResult = await client
        .from('grid_seasons')
        .select('id,slug,city_id')
        .eq('city_id', city.id)
        .eq('slug', seasonSlug)
        .single();
      if (seasonResult.error) {
        throw new Error(`Failed to resolve Grid stronghold season: ${seasonResult.error.message}`);
      }
      const season = requireObject<{ id: string; slug: string; city_id: string }>(
        seasonResult.data,
        'Grid stronghold season',
      );

      const definitionsResult = await client
        .from('grid_npc_stronghold_definitions')
        .select(
          'stronghold_id,faction_id,territory_id,landmark_id,activation,base_garrison_influence,max_garrison_influence,pressure_reinforcement_bps,surge_reinforcement_bps',
        )
        .eq('season_id', season.id)
        .eq('city_id', city.id)
        .eq('enabled', true)
        .order('stronghold_id', { ascending: true });
      if (definitionsResult.error) {
        throw new Error(`Failed to read Grid stronghold definitions: ${definitionsResult.error.message}`);
      }
      const definitions = (definitionsResult.data ?? []) as Array<{
        stronghold_id: string;
        faction_id: string;
        territory_id: string;
        landmark_id: string | null;
        activation: GridNpcStrongholdActivation;
        base_garrison_influence: number;
        max_garrison_influence: number;
        pressure_reinforcement_bps: number;
        surge_reinforcement_bps: number;
      }>;

      const territoryIds = [...new Set(definitions.map((row) => row.territory_id))];
      const landmarkIds = [...new Set(definitions.flatMap((row) => row.landmark_id ? [row.landmark_id] : []))];
      const [territoryResult, landmarkResult, capturedResult] = await Promise.all([
        territoryIds.length === 0
          ? Promise.resolve({ data: [], error: null })
          : client.from('grid_territories').select('id,city_id,slug').in('id', territoryIds),
        landmarkIds.length === 0
          ? Promise.resolve({ data: [], error: null })
          : client.from('grid_landmarks').select('id,city_id,territory_id,slug').in('id', landmarkIds),
        client
          .from('grid_pve_stronghold_contests')
          .select('stronghold_id')
          .eq('season_id', season.id)
          .eq('status', 'captured'),
      ]);
      if (territoryResult.error) {
        throw new Error(`Failed to read Grid stronghold territories: ${territoryResult.error.message}`);
      }
      if (landmarkResult.error) {
        throw new Error(`Failed to read Grid stronghold landmarks: ${landmarkResult.error.message}`);
      }
      if (capturedResult.error) {
        throw new Error(`Failed to read Grid captured strongholds: ${capturedResult.error.message}`);
      }

      const territories = new Map(
        ((territoryResult.data ?? []) as Array<{ id: string; city_id: string; slug: string }>).map(
          (row) => [row.id, row] as const,
        ),
      );
      const landmarks = new Map(
        ((landmarkResult.data ?? []) as Array<{
          id: string; city_id: string; territory_id: string | null; slug: string;
        }>).map((row) => [row.id, row] as const),
      );

      const configs = definitions.map((row) => {
        const territory = territories.get(row.territory_id);
        if (!territory || territory.city_id !== city.id) {
          throw new Error(`Grid stronghold ${row.stronghold_id} has invalid territory identity`);
        }
        const landmark = row.landmark_id ? landmarks.get(row.landmark_id) : undefined;
        if (
          row.landmark_id &&
          (!landmark || landmark.city_id !== city.id || landmark.territory_id !== territory.id)
        ) {
          throw new Error(`Grid stronghold ${row.stronghold_id} has invalid landmark identity`);
        }
        return {
          strongholdId: row.stronghold_id,
          factionId: row.faction_id,
          territorySlug: territory.slug,
          ...(landmark ? { landmarkSlug: landmark.slug } : {}),
          activation: row.activation,
          baseGarrisonInfluence: row.base_garrison_influence,
          maxGarrisonInfluence: row.max_garrison_influence,
          pressureReinforcementBps: row.pressure_reinforcement_bps,
          surgeReinforcementBps: row.surge_reinforcement_bps,
        };
      });

      const capturedStrongholdIds = [...new Set(
        ((capturedResult.data ?? []) as Array<{ stronghold_id: string }>).map((row) => row.stronghold_id),
      )].sort();

      return {
        citySlug: city.slug,
        seasonSlug: season.slug,
        configs,
        capturedStrongholdIds,
      };
    },
  };
}
