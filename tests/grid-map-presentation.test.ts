import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildGridMapPresentation,
  gridMapConditionBand,
} from '../lib/grid/map/presentation';
import type { GridMapScene } from '../lib/grid/map/scene-types';

function baseScene(): GridMapScene {
  return {
    version: 1,
    zoom: 16,
    zoomBand: 'property',
    center: { lat: 40.7989, lng: -81.3748 },
    focus: {
      districtSlug: 'downtown',
      territorySlug: 'territory-you',
      propertySlug: 'property-you',
    },
    visibility: {
      streets: true,
      districts: true,
      territories: true,
      properties: true,
      virtualBuildings: true,
    },
    counts: {
      districts: 4,
      territoriesVisible: 4,
      propertiesVisible: 4,
      contestedTerritories: 1,
      activeParticipantContests: 1,
    },
    districts: [
      {
        slug: 'contested-district',
        focused: false,
        territoryCount: 2,
        neutralTerritories: 0,
        yourTerritories: 1,
        occupiedTerritories: 1,
        contestedTerritories: 1,
      },
      {
        slug: 'downtown',
        focused: true,
        territoryCount: 2,
        neutralTerritories: 0,
        yourTerritories: 2,
        occupiedTerritories: 0,
        contestedTerritories: 0,
      },
      {
        slug: 'mixed',
        focused: false,
        territoryCount: 2,
        neutralTerritories: 0,
        yourTerritories: 1,
        occupiedTerritories: 1,
        contestedTerritories: 0,
      },
      {
        slug: 'neutral',
        focused: false,
        territoryCount: 1,
        neutralTerritories: 1,
        yourTerritories: 0,
        occupiedTerritories: 0,
        contestedTerritories: 0,
      },
    ],
    territories: [
      {
        slug: 'territory-claimable',
        name: 'Claimable',
        districtSlug: 'neutral',
        ownership: 'neutral',
        visualState: 'neutral',
        claimable: true,
        starterEligible: false,
        contested: false,
        focused: false,
        propertyCount: 0,
        developedPropertyCount: 0,
        totalDevelopmentLevel: 0,
      },
      {
        slug: 'territory-contested',
        name: 'Contested',
        districtSlug: 'contested-district',
        ownership: 'occupied',
        visualState: 'contested',
        claimable: true,
        starterEligible: false,
        contested: true,
        focused: false,
        propertyCount: 0,
        developedPropertyCount: 0,
        totalDevelopmentLevel: 0,
      },
      {
        slug: 'territory-rival',
        name: 'Rival',
        districtSlug: 'contested-district',
        ownership: 'occupied',
        visualState: 'occupied',
        claimable: false,
        starterEligible: false,
        contested: false,
        focused: false,
        propertyCount: 1,
        developedPropertyCount: 0,
        totalDevelopmentLevel: 0,
      },
      {
        slug: 'territory-you',
        name: 'Yours',
        districtSlug: 'downtown',
        ownership: 'you',
        visualState: 'you',
        claimable: false,
        starterEligible: false,
        contested: false,
        focused: true,
        propertyCount: 3,
        developedPropertyCount: 3,
        totalDevelopmentLevel: 6,
      },
    ],
    properties: [
      {
        slug: 'property-critical',
        name: 'Critical',
        territorySlug: 'territory-you',
        ownership: 'you',
        developmentBranch: 'fortress',
        developmentLevel: 1,
        conditionBps: 3_999,
        heightUnits: 1,
        damaged: true,
        focused: false,
      },
      {
        slug: 'property-rival',
        name: 'Rival',
        territorySlug: 'territory-rival',
        ownership: 'occupied',
        developmentBranch: null,
        developmentLevel: 0,
        conditionBps: 10_000,
        heightUnits: 0,
        damaged: false,
        focused: false,
      },
      {
        slug: 'property-worn',
        name: 'Worn',
        territorySlug: 'territory-you',
        ownership: 'you',
        developmentBranch: 'commerce',
        developmentLevel: 3,
        conditionBps: 7_000,
        heightUnits: 3,
        damaged: true,
        focused: false,
      },
      {
        slug: 'property-you',
        name: 'Focused',
        territorySlug: 'territory-you',
        ownership: 'you',
        developmentBranch: 'prestige',
        developmentLevel: 2,
        conditionBps: 9_000,
        heightUnits: 2,
        damaged: true,
        focused: true,
      },
    ],
    contestFronts: [],
    skylines: [],
  };
}

describe('Grid map semantic presentation', () => {
  it('uses deterministic condition bands with explicit basis-point boundaries', () => {
    expect(gridMapConditionBand(10_000)).toBe('healthy');
    expect(gridMapConditionBand(8_500)).toBe('healthy');
    expect(gridMapConditionBand(8_499)).toBe('worn');
    expect(gridMapConditionBand(6_500)).toBe('worn');
    expect(gridMapConditionBand(6_499)).toBe('damaged');
    expect(gridMapConditionBand(4_000)).toBe('damaged');
    expect(gridMapConditionBand(3_999)).toBe('critical');
    expect(() => gridMapConditionBand(10_001)).toThrow(/0\.\.10000/);
  });

  it('prioritizes contested and claimable territory treatment over ordinary ownership', () => {
    const presentation = buildGridMapPresentation(baseScene());
    expect(
      presentation.territories.find((row) => row.slug === 'territory-contested'),
    ).toMatchObject({
      fillRole: 'contested',
      borderRole: 'contested',
      glow: 'strong',
      pulse: true,
    });
    expect(
      presentation.territories.find((row) => row.slug === 'territory-claimable'),
    ).toMatchObject({
      fillRole: 'neutral',
      borderRole: 'claimable',
      glow: 'soft',
      pulse: false,
    });
  });

  it('distinguishes owned, rival, mixed, neutral, and contested district control semantically', () => {
    const presentation = buildGridMapPresentation(baseScene());
    const roles = new Map(
      presentation.districts.map((district) => [district.slug, district.controlRole]),
    );

    expect(roles.get('downtown')).toBe('you');
    expect(roles.get('mixed')).toBe('mixed');
    expect(roles.get('neutral')).toBe('neutral');
    expect(roles.get('contested-district')).toBe('contested');
  });

  it('projects virtual building visibility, height, condition, and focus without visual-library details', () => {
    const presentation = buildGridMapPresentation(baseScene());
    expect(
      presentation.properties.find((row) => row.slug === 'property-you'),
    ).toMatchObject({
      conditionBand: 'healthy',
      glow: 'strong',
      focused: true,
      virtualBuildingVisible: true,
      heightUnits: 2,
    });
    expect(
      presentation.properties.find((row) => row.slug === 'property-rival'),
    ).toMatchObject({
      conditionBand: 'healthy',
      glow: 'none',
      virtualBuildingVisible: false,
      heightUnits: 0,
    });
    expect(
      presentation.properties.find((row) => row.slug === 'property-critical')
        ?.conditionBand,
    ).toBe('critical');
  });

  it('contains semantic renderer tokens rather than hard-coded colors', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/grid/map/presentation.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(/\brgba?\s*\(/i);
    expect(source).not.toMatch(/\bhsla?\s*\(/i);
  });

  it('is deterministic regardless of input ordering', () => {
    const scene = baseScene();
    const reversed: GridMapScene = {
      ...scene,
      districts: [...scene.districts].reverse(),
      territories: [...scene.territories].reverse(),
      properties: [...scene.properties].reverse(),
    };

    expect(buildGridMapPresentation(reversed))
      .toEqual(buildGridMapPresentation(scene));
  });
});
