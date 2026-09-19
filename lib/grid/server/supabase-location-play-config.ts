import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import { validateGridLocationEnhancementRule } from '../core/location-enhancement';
import type { GridLocationEnhancementRule } from '../core/location-enhancement-types';
import type {
  GridLocationPlayConfigPort,
  GridLocationPlayRuleResolution,
} from './location-play-config-port';
import {
  validateGridLocationPresenceZone,
  type GridLocationPresenceZone,
} from './location-presence-verifier';

interface CityRow {
  id: string;
}

export interface GridLocationPlaySeasonRow {
  id: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  config: unknown;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Grid location play requires ${field} object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Grid location play requires ${field} array`);
  }
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Grid location play requires ${field}`);
  }
  return value.trim();
}

function number(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Grid location play requires numeric ${field}`);
  }
  return value;
}

function parseZone(value: unknown): GridLocationPresenceZone {
  const raw = record(value, 'zone');
  const zone: GridLocationPresenceZone = {
    id: text(raw.id, 'zone id'),
    latitude: number(raw.latitude, 'zone latitude'),
    longitude: number(raw.longitude, 'zone longitude'),
    radiusMeters: number(raw.radiusMeters, 'zone radiusMeters'),
    maxAccuracyMeters: number(raw.maxAccuracyMeters, 'zone maxAccuracyMeters'),
  };
  validateGridLocationPresenceZone(zone);
  return zone;
}

function parseRule(value: unknown): GridLocationEnhancementRule {
  const raw = record(value, 'rule');
  const rule = raw as unknown as GridLocationEnhancementRule;
  validateGridLocationEnhancementRule(rule);
  return rule;
}

export function parseGridLocationPlaySeasonConfig(
  cityId: string,
  season: GridLocationPlaySeasonRow,
  requestedRuleId: string,
): GridLocationPlayRuleResolution | null {
  const ruleId = requestedRuleId.trim();
  if (!ruleId) throw new Error('Grid location play requires rule id');

  const config = record(season.config, 'season config');
  const location = config.locationEnhancements;
  if (location === undefined || location === null) return null;
  const locationConfig = record(location, 'locationEnhancements');
  const zones = array(locationConfig.zones, 'locationEnhancements zones').map(parseZone);
  const rules = array(locationConfig.rules, 'locationEnhancements rules').map(parseRule);

  const rule = rules.find((candidate) => candidate.id.trim() === ruleId);
  if (!rule) return null;
  const zone = zones.find((candidate) => candidate.id === rule.zoneId.trim());
  if (!zone) {
    throw new Error(`Grid location play rule ${rule.id} references missing zone ${rule.zoneId}`);
  }

  return {
    cityId,
    seasonId: text(season.id, 'season id'),
    seasonStatus: text(season.status, 'season status'),
    startsAt: season.starts_at,
    endsAt: season.ends_at,
    rule,
    zone,
  };
}

export function createSupabaseGridLocationPlayConfigPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridLocationPlayConfigPort {
  if (!client) {
    throw new Error('Grid location play requires Supabase service-role configuration');
  }

  return {
    async resolveRule(citySlug, seasonSlug, ruleId) {
      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', citySlug.trim())
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(`Failed to resolve Grid location city: ${cityResult.error.message}`);
      }
      const city = cityResult.data as CityRow | null;
      if (!city) return null;

      const seasonResult = await client
        .from('grid_seasons')
        .select('id,status,starts_at,ends_at,config')
        .eq('city_id', city.id)
        .eq('slug', seasonSlug.trim())
        .maybeSingle();
      if (seasonResult.error) {
        throw new Error(`Failed to resolve Grid location season: ${seasonResult.error.message}`);
      }
      const season = seasonResult.data as GridLocationPlaySeasonRow | null;
      if (!season) return null;

      return parseGridLocationPlaySeasonConfig(city.id, season, ruleId);
    },
  };
}
