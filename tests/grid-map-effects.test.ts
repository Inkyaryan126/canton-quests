import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { deriveGridMapEffectCues } from '../lib/grid/map/effects';
import {
  buildGridMapRenderPacket,
  type GridMapRenderPacket,
} from '../lib/grid/map/render-packet';
import { buildGridMapScene } from '../lib/grid/map/scene';
import { buildGridWorldProjection } from '../lib/grid/server/world-projection';

function packet(): GridMapRenderPacket {
  const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
  const districtSlug = projection.territories[0].districtSlug;
  return buildGridMapRenderPacket(buildGridMapScene(projection, {
    zoom: 12,
    focusDistrictSlug: districtSlug,
  }));
}

function clone(value: GridMapRenderPacket): GridMapRenderPacket {
  return JSON.parse(JSON.stringify(value)) as GridMapRenderPacket;
}

describe('Grid living-map effect cues', () => {
  it('emits no effects for equivalent renderer packets', () => {
    const previous = packet();
    expect(deriveGridMapEffectCues(previous, clone(previous))).toEqual([]);
  });
  it('emits a stable territory-control cue when visible control changes', () => {
    const previous = packet();
    const next = clone(previous);
    const feature = next.territories.features[0];
    const slug = feature.properties.slug;
    feature.properties.fillRole = 'controlled-you';

    expect(deriveGridMapEffectCues(previous, next)).toContainEqual({
      id: `territory-control:${slug}:neutral:controlled-you`,
      kind: 'territory-control-changed',
      entityId: slug,
      intensity: 'strong',
      from: 'neutral',
      to: 'controlled-you',
    });
  });

  it('signals contest fronts entering and leaving the map', () => {
    const previous = packet();
    const started = clone(previous);
    started.contestFronts.features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[-81.38, 40.79], [-81.37, 40.80]],
      },
      properties: {
        contestId: 'contest-1',
        role: 'attacker',
        roundNumber: 1,
      },
    });

    expect(deriveGridMapEffectCues(previous, started))
      .toContainEqual(expect.objectContaining({
        id: 'contest-started:contest-1',
        kind: 'contest-started',
        entityId: 'contest-1',
        intensity: 'strong',
      }));
    expect(deriveGridMapEffectCues(started, previous))
      .toContainEqual(expect.objectContaining({
        id: 'contest-ended:contest-1',
        kind: 'contest-ended',
        entityId: 'contest-1',
        intensity: 'soft',
      }));
  });

  it('turns virtual-building height changes into rise or lower cues', () => {
    const previous = packet();
    previous.virtualBuildings.push({
      propertySlug: 'property-1',
      territorySlug: 'territory-1',
      anchor: { lat: 40.79, lng: -81.37 },
      heightUnits: 2,
      developmentBranch: 'commerce',
      conditionBand: 'healthy',
      ownership: 'you',
      focused: false,
    });
    const next = clone(previous);
    next.virtualBuildings[0].heightUnits = 5;

    expect(deriveGridMapEffectCues(previous, next))
      .toContainEqual(expect.objectContaining({
        id: 'building-height:property-1:2:5',
        kind: 'building-risen',
        entityId: 'property-1',
        from: 2,
        to: 5,
      }));

    expect(deriveGridMapEffectCues(next, previous))
      .toContainEqual(expect.objectContaining({
        id: 'building-height:property-1:5:2',
        kind: 'building-lowered',
        entityId: 'property-1',
      }));
  });
  it('signals property condition changes and skyline recomposition', () => {
    const previous = packet();
    const next = clone(previous);
    if (next.properties.features.length === 0) {
      next.properties.features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-81.37, 40.79] },
        properties: {
          slug: 'property-1',
          conditionBand: 'healthy',
          glow: 'none',
          focused: false,
          virtualBuildingVisible: false,
          heightUnits: 0,
          name: 'Property 1',
          territorySlug: next.territories.features[0].properties.slug,
          ownership: 'neutral',
          developmentBranch: null,
          developmentLevel: 0,
        },
      });
    }
    const property = next.properties.features[0];
    const propertySlug = property.properties.slug;
    const priorWithProperty = clone(next);
    property.properties.conditionBand = 'damaged';
    next.skylines = [{
      propertySlugs: [propertySlug],
      territorySlugs: [property.properties.territorySlug],
      totalDevelopmentLevel: 3,
      ruleIds: ['rule-1'],
    }];

    const cues = deriveGridMapEffectCues(priorWithProperty, next);
    expect(cues).toContainEqual(expect.objectContaining({
      id: `property-condition:${propertySlug}:healthy:damaged`,
      kind: 'property-condition-changed',
      entityId: propertySlug,
      from: 'healthy',
      to: 'damaged',
    }));
    expect(cues).toContainEqual(expect.objectContaining({
      id: 'skyline-changed',
      kind: 'skyline-changed',
      entityId: 'skyline',
    }));
  });
  it('returns cues in deterministic priority and id order', () => {
    const previous = packet();
    const next = clone(previous);
    const slug = next.territories.features[0].properties.slug;
    next.territories.features[0].properties.fillRole = 'controlled-rival';
    next.contestFronts.features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[-81.38, 40.79], [-81.37, 40.80]],
      },
      properties: {
        contestId: 'contest-z',
        role: 'defender',
        roundNumber: 1,
      },
    });

    const first = deriveGridMapEffectCues(previous, next);
    const second = deriveGridMapEffectCues(previous, next);

    expect(first).toEqual(second);
    expect(first.map((cue) => cue.kind)).toEqual([
      'contest-started',
      'territory-control-changed',
    ]);
    expect(first.some((cue) => cue.entityId === slug)).toBe(true);
  });
});
