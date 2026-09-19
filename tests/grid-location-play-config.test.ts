import { describe, expect, it } from 'vitest';
import { parseGridLocationPlaySeasonConfig } from '../lib/grid/server/supabase-location-play-config';

const row = {
  id: 'season-1',
  status: 'active',
  starts_at: '2026-09-01T00:00:00.000Z',
  ends_at: '2026-10-01T00:00:00.000Z',
  config: {
    locationEnhancements: {
      zones: [{
        id: 'zone-1', latitude: 40.7989, longitude: -81.3748,
        radiusMeters: 100, maxAccuracyMeters: 35,
      }],
      rules: [{
        id: 'rule-1', zoneId: 'zone-1',
        benefit: { kind: 'scouting-intel', intelId: 'intel-1' },
        verificationMaxAgeMinutes: 5,
        maxClaimsPerPlayer: 1,
      }],
    },
  },
};

describe('Grid location play server configuration', () => {
  it('resolves rule and target zone from authoritative season config', () => {
    expect(parseGridLocationPlaySeasonConfig('city-1', row, 'rule-1')).toEqual({
      cityId: 'city-1', seasonId: 'season-1', seasonStatus: 'active',
      startsAt: row.starts_at, endsAt: row.ends_at,
      rule: row.config.locationEnhancements.rules[0],
      zone: row.config.locationEnhancements.zones[0],
    });
  });

  it('returns null for an unknown rule rather than accepting browser-defined rule data', () => {
    expect(parseGridLocationPlaySeasonConfig('city-1', row, 'missing')).toBeNull();
  });

  it('fails closed when a configured rule references a missing zone', () => {
    const broken = structuredClone(row);
    broken.config.locationEnhancements.rules[0].zoneId = 'missing-zone';
    expect(() => parseGridLocationPlaySeasonConfig('city-1', broken, 'rule-1'))
      .toThrow(/missing zone/);
  });

  it('rejects malformed target-zone coordinates and accuracy policy', () => {
    const broken = structuredClone(row);
    broken.config.locationEnhancements.zones[0].latitude = 999;
    broken.config.locationEnhancements.zones[0].maxAccuracyMeters = 0;
    expect(() => parseGridLocationPlaySeasonConfig('city-1', broken, 'rule-1'))
      .toThrow(/zone/);
  });
});
