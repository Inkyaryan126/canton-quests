import { describe, expect, it } from 'vitest';
import { buildGridMapLayerManifest } from '../lib/grid/map/layers';
import type { GridMapRenderPacket } from '../lib/grid/map/render-packet';

function emptyPacket(
  zoomBand: GridMapRenderPacket['zoomBand'],
): GridMapRenderPacket {
  return {
    version: 1,
    center: { lat: 40.7989, lng: -81.3748 },
    zoom: zoomBand === 'city' ? 9 : zoomBand === 'district' ? 12 : 16,
    zoomBand,
    districtSummaries: [],
    districts: { type: 'FeatureCollection', features: [] },
    territories: { type: 'FeatureCollection', features: [] },
    properties: { type: 'FeatureCollection', features: [] },
    contestFronts: { type: 'FeatureCollection', features: [] },
    virtualBuildings: [],
    skylines: [],
    interactionTargets: [],
  };
}
describe('Grid map renderer layer manifest', () => {
  it('keeps city zoom focused on district-scale layers', () => {
    const packet = emptyPacket('city');
    packet.districts.features.push({
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: [] },
      properties: {
        slug: 'downtown',
        controlRole: 'neutral',
        glow: 'none',
        focused: false,
        territoryCount: 20,
        neutralTerritories: 20,
        yourTerritories: 0,
        occupiedTerritories: 0,
        contestedTerritories: 0,
      },
    });

    expect(buildGridMapLayerManifest(packet).map((layer) => layer.id))
      .toEqual(['district-fill', 'district-outline']);
  });
  it('adds territory and contest-front layers at district zoom', () => {
    const packet = emptyPacket('district');
    packet.territories.features.push({
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: [] },
      properties: {
        slug: 'territory-1',
        fillRole: 'neutral',
        borderRole: 'claimable',
        glow: 'soft',
        pulse: false,
        focused: false,
        name: 'Territory 1',
        districtSlug: 'downtown',
        claimable: true,
        starterEligible: true,
        contested: false,
        propertyCount: 0,
        developedPropertyCount: 0,
        totalDevelopmentLevel: 0,
      },
    });
    packet.contestFronts.features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[-81.37, 40.79], [-81.36, 40.80]] },
      properties: { contestId: 'contest-1', role: 'attacker', roundNumber: 2 },
    });

    expect(buildGridMapLayerManifest(packet).map((layer) => layer.id))
      .toEqual(['territory-fill', 'territory-outline', 'contest-front']);
  });
  it('orders property detail and virtual structures above territory context', () => {
    const packet = emptyPacket('property');
    packet.properties.features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-81.37, 40.79] },
      properties: {
        slug: 'property-1',
        conditionBand: 'healthy',
        glow: 'soft',
        focused: false,
        virtualBuildingVisible: true,
        heightUnits: 3,
        name: 'Property 1',
        territorySlug: 'territory-1',
        ownership: 'you',
        developmentBranch: 'commerce',
        developmentLevel: 3,
      },
    });
    packet.virtualBuildings.push({
      propertySlug: 'property-1',
      territorySlug: 'territory-1',
      anchor: { lat: 40.79, lng: -81.37 },
      heightUnits: 3,
      developmentBranch: 'commerce',
      conditionBand: 'healthy',
      ownership: 'you',
      focused: false,
    });

    expect(buildGridMapLayerManifest(packet).map((layer) => layer.id))
      .toEqual(['property-footprint', 'virtual-building']);
  });

  it('marks only selectable geometry layers as interactive', () => {
    const packet = emptyPacket('property');
    packet.properties.features.push({
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
        territorySlug: 'territory-1',
        ownership: 'neutral',
        developmentBranch: null,
        developmentLevel: 0,
      },
    });

    const layers = buildGridMapLayerManifest(packet);
    expect(layers.find((layer) => layer.id === 'property-footprint')?.interactive)
      .toBe(true);
  });
});
