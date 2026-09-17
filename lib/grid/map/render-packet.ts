import { computeCentroid } from '../geo/geometry';
import type { GridLatLng } from '../core/types';
import {
  buildGridMapPresentation,
  type GridMapDistrictPresentation,
  type GridMapPropertyPresentation,
  type GridMapTerritoryPresentation,
} from './presentation';
import type {
  GridMapContestFrontScene,
  GridMapScene,
  GridMapSkylineScene,
} from './scene-types';

export interface GridMapDistrictFeatureProperties
  extends GridMapDistrictPresentation {
  territoryCount: number;
  neutralTerritories: number;
  yourTerritories: number;
  occupiedTerritories: number;
  contestedTerritories: number;
}

export interface GridMapTerritoryFeatureProperties
  extends GridMapTerritoryPresentation {
  name: string;
  districtSlug: string;
  claimable: boolean;
  starterEligible: boolean;
  contested: boolean;
}

export interface GridMapPropertyFeatureProperties
  extends GridMapPropertyPresentation {
  name: string;
  territorySlug: string;
  ownership: 'neutral' | 'you' | 'occupied';
  developmentBranch: string | null;
  developmentLevel: number;
}

export interface GridMapVirtualBuilding {
  propertySlug: string;
  territorySlug: string;
  anchor: GridLatLng;
  heightUnits: number;
  developmentBranch: string | null;
  conditionBand: GridMapPropertyPresentation['conditionBand'];
  ownership: 'neutral' | 'you' | 'occupied';
  focused: boolean;
}

export interface GridMapContestFrontFeatureProperties {
  contestId: string;
  role: GridMapContestFrontScene['role'];
  roundNumber: number;
}

export interface GridMapInteractionTarget {
  kind: 'district' | 'territory' | 'property';
  slug: string;
  districtSlug: string | null;
  territorySlug: string | null;
  propertySlug: string | null;
}

export interface GridMapRenderPacket {
  version: 1;
  center: GridLatLng;
  zoom: number;
  zoomBand: GridMapScene['zoomBand'];
  districtSummaries: GridMapDistrictPresentation[];
  districts: GeoJSON.FeatureCollection<
    GeoJSON.MultiPolygon,
    GridMapDistrictFeatureProperties
  >;
  territories: GeoJSON.FeatureCollection<
    GeoJSON.MultiPolygon,
    GridMapTerritoryFeatureProperties
  >;
  properties: GeoJSON.FeatureCollection<
    GeoJSON.Geometry,
    GridMapPropertyFeatureProperties
  >;
  contestFronts: GeoJSON.FeatureCollection<
    GeoJSON.LineString,
    GridMapContestFrontFeatureProperties
  >;
  virtualBuildings: GridMapVirtualBuilding[];
  skylines: GridMapSkylineScene[];
  interactionTargets: GridMapInteractionTarget[];
}
function latLngToPosition(point: GridLatLng): [number, number] {
  return [point.lng, point.lat];
}

function propertyGeometry(
  geometry: GeoJSON.MultiPolygon | undefined,
  point: GridLatLng | undefined,
): GeoJSON.Geometry | null {
  if (geometry) return geometry;
  if (point) {
    return {
      type: 'Point',
      coordinates: latLngToPosition(point),
    };
  }
  return null;
}

function propertyAnchor(
  geometry: GeoJSON.MultiPolygon | undefined,
  point: GridLatLng | undefined,
): GridLatLng | null {
  if (point) return point;
  if (geometry) return computeCentroid(geometry);
  return null;
}

function interactionTargets(scene: GridMapScene): GridMapInteractionTarget[] {
  const districtTargets = scene.districts
    .filter((district) => Boolean(district.geometry))
    .map((district) => ({
      kind: 'district' as const,
      slug: district.slug,
      districtSlug: district.slug,
      territorySlug: null,
      propertySlug: null,
    }));

  const territoryTargets = scene.territories.map((territory) => ({
    kind: 'territory' as const,
    slug: territory.slug,
    districtSlug: territory.districtSlug,
    territorySlug: territory.slug,
    propertySlug: null,
  }));

  const territoryDistricts = new Map(
    scene.territories.map((territory) => [
      territory.slug,
      territory.districtSlug,
    ] as const),
  );

  const propertyTargets = scene.properties.map((property) => ({
    kind: 'property' as const,
    slug: property.slug,
    districtSlug: territoryDistricts.get(property.territorySlug) ?? null,
    territorySlug: property.territorySlug,
    propertySlug: property.slug,
  }));

  return [...districtTargets, ...territoryTargets, ...propertyTargets].sort((a, b) => {
    const kindOrder = a.kind.localeCompare(b.kind);
    return kindOrder || a.slug.localeCompare(b.slug);
  });
}
function contestFrontFeatures(
  scene: GridMapScene,
): Array<
  GeoJSON.Feature<GeoJSON.LineString, GridMapContestFrontFeatureProperties>
> {
  const territoryCenters = new Map<string, GridLatLng>();
  for (const territory of scene.territories) {
    if (!territory.geometry) continue;
    territoryCenters.set(
      territory.slug,
      computeCentroid(territory.geometry),
    );
  }

  return scene.contestFronts.flatMap((contest) => {
    const source = territoryCenters.get(contest.sourceTerritorySlug);
    const target = territoryCenters.get(contest.targetTerritorySlug);
    if (!source || !target) return [];

    return [{
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          latLngToPosition(source),
          latLngToPosition(target),
        ],
      },
      properties: {
        contestId: contest.contestId,
        role: contest.role,
        roundNumber: contest.roundNumber,
      },
    }];
  });
}

export function buildGridMapRenderPacket(
  scene: GridMapScene,
): GridMapRenderPacket {
  const presentation = buildGridMapPresentation(scene);
  const districtPresentationBySlug = new Map(
    presentation.districts.map((row) => [row.slug, row] as const),
  );
  const territoryPresentationBySlug = new Map(
    presentation.territories.map((row) => [row.slug, row] as const),
  );
  const propertyPresentationBySlug = new Map(
    presentation.properties.map((row) => [row.slug, row] as const),
  );

  const districts: GridMapRenderPacket['districts'] = {
    type: 'FeatureCollection',
    features: scene.districts.flatMap((district) => {
      const style = districtPresentationBySlug.get(district.slug);
      if (!district.geometry || !style) return [];
      return [{
        type: 'Feature' as const,
        geometry: district.geometry,
        properties: {
          ...style,
          territoryCount: district.territoryCount,
          neutralTerritories: district.neutralTerritories,
          yourTerritories: district.yourTerritories,
          occupiedTerritories: district.occupiedTerritories,
          contestedTerritories: district.contestedTerritories,
        },
      }];
    }),
  };

  const territories: GridMapRenderPacket['territories'] = {
    type: 'FeatureCollection',
    features: scene.territories.flatMap((territory) => {
      if (!territory.geometry) return [];
      const style = territoryPresentationBySlug.get(territory.slug);
      if (!style) return [];

      return [{
        type: 'Feature' as const,
        geometry: territory.geometry,
        properties: {
          ...style,
          name: territory.name,
          districtSlug: territory.districtSlug,
          claimable: territory.claimable,
          starterEligible: territory.starterEligible,
          contested: territory.contested,
        },
      }];
    }),
  };

  const properties: GridMapRenderPacket['properties'] = {
    type: 'FeatureCollection',
    features: scene.properties.flatMap((property) => {
      const geometry = propertyGeometry(property.geometry, property.point);
      const style = propertyPresentationBySlug.get(property.slug);
      if (!geometry || !style) return [];

      return [{
        type: 'Feature' as const,
        geometry,
        properties: {
          ...style,
          name: property.name,
          territorySlug: property.territorySlug,
          ownership: property.ownership,
          developmentBranch: property.developmentBranch,
          developmentLevel: property.developmentLevel,
        },
      }];
    }),
  };
  const virtualBuildings = scene.properties.flatMap((property) => {
    const style = propertyPresentationBySlug.get(property.slug);
    const anchor = propertyAnchor(property.geometry, property.point);
    if (!style?.virtualBuildingVisible || !anchor) return [];

    return [{
      propertySlug: property.slug,
      territorySlug: property.territorySlug,
      anchor,
      heightUnits: property.heightUnits,
      developmentBranch: property.developmentBranch,
      conditionBand: style.conditionBand,
      ownership: property.ownership,
      focused: property.focused,
    }];
  }).sort((a, b) => a.propertySlug.localeCompare(b.propertySlug));

  return {
    version: 1,
    center: scene.center,
    zoom: scene.zoom,
    zoomBand: scene.zoomBand,
    districtSummaries: [...presentation.districts],
    districts,
    territories,
    properties,
    contestFronts: {
      type: 'FeatureCollection',
      features: contestFrontFeatures(scene).sort((a, b) =>
        a.properties.contestId.localeCompare(b.properties.contestId),
      ),
    },
    virtualBuildings,
    skylines: scene.skylines.map((skyline) => ({
      propertySlugs: [...skyline.propertySlugs],
      territorySlugs: [...skyline.territorySlugs],
      totalDevelopmentLevel: skyline.totalDevelopmentLevel,
      ruleIds: [...skyline.ruleIds],
    })),
    interactionTargets: interactionTargets(scene),
  };
}
