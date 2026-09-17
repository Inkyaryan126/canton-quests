import { describe, expect, it } from 'vitest';

import type { GridCityPackage } from '../lib/grid/core/types';
import {
  buildGridNpcStrongholdWorldProjection,
  type GridNpcStrongholdWorldInput,
} from '../lib/grid/server/npc-stronghold-world';

const pkg: GridCityPackage = {
  schemaVersion: 1,
  packageVersion: 1,
  status: 'draft',
  city: {
    slug: 'test-city',
    name: 'Test City',
    regionCode: 'OH',
    countryCode: 'US',
    timezone: 'America/New_York',
    mapCenter: { lat: 40.8, lng: -81.4 },
  },
  seasonTemplate: {
    slug: 'season-1',
    name: 'Season One',
    durationDays: 30,
    surgeHours: 24,
    balance: {} as GridCityPackage['seasonTemplate']['balance'],
  },
  districts: [{ slug: 'downtown', name: 'Downtown' }],
  territories: [    {
      slug: 'central',
      name: 'Central',
      districtSlug: 'downtown',
      baseValue: 100,
    },
    {
      slug: 'market',
      name: 'Market',
      districtSlug: 'downtown',
      baseValue: 120,
    },
  ],
  edges: [],
  properties: [],
  landmarks: [
    {
      slug: 'courthouse',
      name: 'Courthouse',
      territorySlug: 'central',
      point: { lat: 40.8, lng: -81.4 },
    },
  ],
};

function stronghold(
  overrides: Partial<GridNpcStrongholdWorldInput> = {},
): GridNpcStrongholdWorldInput {
  return {
    config: {      strongholdId: 'stronghold-1',
      factionId: 'iron-watch',
      territorySlug: 'central',
      activation: 'season',
      baseGarrisonInfluence: 100,
      maxGarrisonInfluence: 200,
      pressureReinforcementBps: 5000,
      surgeReinforcementBps: 5000,
    },
    context: {
      seasonActive: true,
      eventActive: false,
      surgeIntensityBps: 0,
      factionPressureBps: 4000,
      captured: false,
    },
    ...overrides,
  };
}

describe('NPC stronghold world projection', () => {
  it('projects an active territory stronghold into player-visible world data', () => {
    const result = buildGridNpcStrongholdWorldProjection(pkg, [stronghold()]);

    expect(result).toEqual([
      expect.objectContaining({
        strongholdId: 'stronghold-1',
        factionId: 'iron-watch',
        status: 'active',
        activationReason: 'season',
        contestable: true,        garrisonInfluence: 120,
        target: {
          kind: 'pve-territory',
          territorySlug: 'central',
          territoryName: 'Central',
          districtSlug: 'downtown',
        },
      }),
    ]);
  });

  it('attaches landmark identity and point for landmark strongholds', () => {
    const result = buildGridNpcStrongholdWorldProjection(pkg, [
      stronghold({
        config: {
          ...stronghold().config,
          landmarkSlug: 'courthouse',
        },
      }),
    ]);

    expect(result[0]?.target).toEqual({
      kind: 'pve-landmark',
      territorySlug: 'central',
      territoryName: 'Central',
      districtSlug: 'downtown',
      landmark: {
        slug: 'courthouse',
        name: 'Courthouse',
        point: { lat: 40.8, lng: -81.4 },
      },
    });
  });
  it('hides dormant strongholds from player-visible world data', () => {
    const result = buildGridNpcStrongholdWorldProjection(pkg, [
      stronghold({
        config: {
          ...stronghold().config,
          activation: 'event',
        },
      }),
    ]);

    expect(result).toEqual([]);
  });

  it('keeps captured strongholds visible with zero garrison', () => {
    const result = buildGridNpcStrongholdWorldProjection(pkg, [
      stronghold({
        context: {
          ...stronghold().context,
          captured: true,
        },
      }),
    ]);

    expect(result[0]).toEqual(
      expect.objectContaining({
        status: 'captured',
        contestable: false,
        garrisonInfluence: 0,
      }),
    );
  });
  it('rejects a landmark that does not belong to the configured territory', () => {
    const invalidPkg: GridCityPackage = {
      ...pkg,
      landmarks: [
        {
          slug: 'courthouse',
          name: 'Courthouse',
          territorySlug: 'market',
          point: { lat: 40.8, lng: -81.4 },
        },
      ],
    };

    expect(() =>
      buildGridNpcStrongholdWorldProjection(invalidPkg, [
        stronghold({
          config: {
            ...stronghold().config,
            landmarkSlug: 'courthouse',
          },
        }),
      ]),
    ).toThrow(/landmark.*territory/i);
  });

  it('rejects duplicate stronghold ids before projecting the world', () => {
    expect(() =>
      buildGridNpcStrongholdWorldProjection(pkg, [stronghold(), stronghold()]),
    ).toThrow(/duplicate.*stronghold/i);
  });
});