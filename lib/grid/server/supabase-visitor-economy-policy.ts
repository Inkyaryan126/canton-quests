import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import { validateGridVisitorEconomyPolicy } from '../core/visitor-economy';
import type { GridVisitorEconomyPolicy } from '../core/visitor-economy-types';

type CityRow = { id: string; slug: string };
type SeasonRow = {
  id: string;
  status: string;
  config: unknown;
};

export interface GridVisitorEconomyResolvedPolicy {
  cityId: string;
  citySlug: string;
  seasonId: string;
  policy: GridVisitorEconomyPolicy;
}

function requireValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Grid visitor economy policy requires ${field}`);
  }
  return normalized;
}

function objectValue(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Grid visitor economy policy requires ${field} object`);
  }
  return value as Record<string, unknown>;
}

function numericValue(value: unknown, field: string): number {
  if (typeof value !== 'number') {
    throw new Error(`Grid visitor economy policy requires numeric ${field}`);
  }
  return value;
}

export function parseGridVisitorEconomyPolicy(
  seasonConfig: unknown,
): GridVisitorEconomyPolicy | null {
  const config = objectValue(seasonConfig, 'season config');
  const rawPolicy = config.visitorEconomy;
  if (rawPolicy === undefined || rawPolicy === null) return null;

  const raw = objectValue(rawPolicy, 'visitorEconomy');
  const residency = raw.residencyThresholdPoints;
  const policy: GridVisitorEconomyPolicy = {
    visitorInvestmentCapCredits: numericValue(
      raw.visitorInvestmentCapCredits,
      'visitorInvestmentCapCredits',
    ),
    visitorPropertyLimit: numericValue(
      raw.visitorPropertyLimit,
      'visitorPropertyLimit',
    ),
    visitorDeploymentAllowance: numericValue(
      raw.visitorDeploymentAllowance,
      'visitorDeploymentAllowance',
    ),
    residencyThresholdPoints:
      residency === null
        ? null
        : numericValue(residency, 'residencyThresholdPoints'),
  };

  validateGridVisitorEconomyPolicy(policy);
  return policy;
}

export function createSupabaseGridVisitorEconomyPolicyResolver(
  client: SupabaseClient | null = supabaseAdmin,
) {
  if (!client) {
    throw new Error(
      'Grid visitor economy policy requires Supabase service-role configuration',
    );
  }

  return {
    async resolvePolicy(
      targetCitySlug: string,
    ): Promise<GridVisitorEconomyResolvedPolicy | null> {
      const normalizedTargetCitySlug = requireValue(
        targetCitySlug,
        'targetCitySlug',
      );

      const cityResult = await client
        .from('grid_cities')
        .select('id,slug')
        .eq('slug', normalizedTargetCitySlug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(
          `Failed to read Grid visitor policy city: ${cityResult.error.message}`,
        );
      }
      const city = cityResult.data as CityRow | null;
      if (!city) throw new Error('GRID_VISITOR_TARGET_CITY_NOT_FOUND');

      const seasonResult = await client
        .from('grid_seasons')
        .select('id,status,config')
        .eq('city_id', city.id)
        .in('status', ['active', 'surge']);
      if (seasonResult.error) {
        throw new Error(
          `Failed to read Grid visitor policy season: ${seasonResult.error.message}`,
        );
      }
      const seasons = (seasonResult.data ?? []) as SeasonRow[];
      if (seasons.length === 0) return null;
      if (seasons.length > 1) {
        throw new Error('GRID_VISITOR_PLAYABLE_SEASON_AMBIGUOUS');
      }

      const policy = parseGridVisitorEconomyPolicy(seasons[0].config);
      if (!policy) return null;

      return {
        cityId: city.id,
        citySlug: city.slug,
        seasonId: seasons[0].id,
        policy,
      };
    },
  };
}
