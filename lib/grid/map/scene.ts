import { computeCentroid } from '../geo/geometry';
import type { GridWorldProjection } from '../server/world-projection';
import type {
  GridMapContestFrontScene,
  GridMapDistrictScene,
  GridMapPropertyScene,
  GridMapScene,
  GridMapSceneFocus,
  GridMapSkylineScene,
  GridMapTerritoryScene,
  GridMapZoomBand,
} from './scene-types';

export const GRID_MAP_ZOOM_THRESHOLDS = {
  district: 11,
  property: 15,
} as const;

export interface GridMapSceneOptions {
  zoom: number;
  focusDistrictSlug?: string | null;
  focusTerritorySlug?: string | null;
  focusPropertySlug?: string | null;
}

export function gridMapZoomBand(zoom: number): GridMapZoomBand {
  if (!Number.isFinite(zoom) || zoom < 0) {
    throw new Error('Grid map zoom must be a finite non-negative number');
  }
  if (zoom >= GRID_MAP_ZOOM_THRESHOLDS.property) return 'property';
  if (zoom >= GRID_MAP_ZOOM_THRESHOLDS.district) return 'district';
  return 'city';
}
function resolveFocus(
  projection: GridWorldProjection,
  options: GridMapSceneOptions,
): GridMapSceneFocus {
  const territoryBySlug = new Map(
    projection.territories.map((territory) => [territory.slug, territory] as const),
  );
  const propertyBySlug = new Map(
    projection.properties.map((property) => [property.slug, property] as const),
  );
  const districtSlugs = new Set(
    projection.territories.map((territory) => territory.districtSlug),
  );

  let districtSlug = options.focusDistrictSlug ?? null;
  let territorySlug = options.focusTerritorySlug ?? null;
  const propertySlug = options.focusPropertySlug ?? null;

  if (propertySlug) {
    const property = propertyBySlug.get(propertySlug);
    if (!property) throw new Error(`Unknown Grid map property focus: ${propertySlug}`);
    if (territorySlug && territorySlug !== property.territorySlug) {
      throw new Error('Grid map property focus does not match territory focus');
    }
    territorySlug = property.territorySlug;
  }

  if (territorySlug) {
    const territory = territoryBySlug.get(territorySlug);
    if (!territory) throw new Error(`Unknown Grid map territory focus: ${territorySlug}`);
    if (districtSlug && districtSlug !== territory.districtSlug) {
      throw new Error('Grid map territory focus does not match district focus');
    }
    districtSlug = territory.districtSlug;
  }

  if (districtSlug && !districtSlugs.has(districtSlug)) {
    throw new Error(`Unknown Grid map district focus: ${districtSlug}`);
  }

  return { districtSlug, territorySlug, propertySlug };
}
function sceneCenter(
  projection: GridWorldProjection,
  focus: GridMapSceneFocus,
) {
  if (focus.propertySlug) {
    const property = projection.properties.find(
      (candidate) => candidate.slug === focus.propertySlug,
    );
    if (property?.point) return property.point;
    if (property?.geometry) return computeCentroid(property.geometry);
  }

  if (focus.territorySlug) {
    const territory = projection.territories.find(
      (candidate) => candidate.slug === focus.territorySlug,
    );
    if (territory?.geometry) return computeCentroid(territory.geometry);
  }

  return projection.city.mapCenter;
}

function districtScenes(
  projection: GridWorldProjection,
  focus: GridMapSceneFocus,
): GridMapDistrictScene[] {
  const grouped = new Map<string, GridMapDistrictScene>();

  for (const territory of projection.territories) {
    const current =
      grouped.get(territory.districtSlug) ??
      {
        slug: territory.districtSlug,
        focused: focus.districtSlug === territory.districtSlug,
        territoryCount: 0,
        neutralTerritories: 0,
        yourTerritories: 0,
        occupiedTerritories: 0,
        contestedTerritories: 0,
      };
    if (territory.geometry) {
      current.geometry = {
        type: 'MultiPolygon',
        coordinates: [
          ...(current.geometry?.coordinates ?? []),
          ...territory.geometry.coordinates,
        ],
      };
    }
    current.territoryCount += 1;
    if (territory.ownership === 'neutral') current.neutralTerritories += 1;
    if (territory.ownership === 'you') current.yourTerritories += 1;
    if (territory.ownership === 'occupied') current.occupiedTerritories += 1;
    if (territory.contested) current.contestedTerritories += 1;
    grouped.set(territory.districtSlug, current);
  }

  return [...grouped.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

function territoryScenes(
  projection: GridWorldProjection,
  focus: GridMapSceneFocus,
  zoomBand: GridMapZoomBand,
): GridMapTerritoryScene[] {
  if (zoomBand === 'city') return [];

  const propertiesByTerritory = new Map<
    string,
    GridWorldProjection['properties']
  >();
  for (const property of projection.properties) {
    const list = propertiesByTerritory.get(property.territorySlug) ?? [];
    list.push(property);
    propertiesByTerritory.set(property.territorySlug, list);
  }

  return projection.territories
    .filter((territory) => {
      if (zoomBand === 'property' && focus.territorySlug) {
        return territory.slug === focus.territorySlug;
      }
      return !focus.districtSlug || territory.districtSlug === focus.districtSlug;
    })
    .map((territory) => {
      const properties = propertiesByTerritory.get(territory.slug) ?? [];
      return {
        slug: territory.slug,
        name: territory.name,
        districtSlug: territory.districtSlug,
        geometry: territory.geometry,
        ownership: territory.ownership,
        visualState: (territory.contested ? 'contested' : territory.ownership) as GridMapTerritoryScene['visualState'],
        claimable: territory.claimable,
        starterEligible: territory.starterEligible,
        contested: territory.contested,
        focused: focus.territorySlug === territory.slug,
        propertyCount: properties.length,
        developedPropertyCount: properties.filter(
          (property) => property.developmentLevel > 0,
        ).length,
        totalDevelopmentLevel: properties.reduce(
          (sum, property) => sum + property.developmentLevel,
          0,
        ),
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function propertyScenes(
  projection: GridWorldProjection,
  focus: GridMapSceneFocus,
  zoomBand: GridMapZoomBand,
): GridMapPropertyScene[] {
  if (zoomBand !== 'property') return [];

  const territoryBySlug = new Map(
    projection.territories.map((territory) => [territory.slug, territory] as const),
  );

  return projection.properties
    .filter((property) => {
      if (focus.territorySlug) return property.territorySlug === focus.territorySlug;
      if (!focus.districtSlug) return true;
      return territoryBySlug.get(property.territorySlug)?.districtSlug === focus.districtSlug;
    })
    .map((property) => ({
      slug: property.slug,
      name: property.name,
      territorySlug: property.territorySlug,
      point: property.point,
      geometry: property.geometry,
      ownership: property.ownership,
      developmentBranch: property.developmentBranch,
      developmentLevel: property.developmentLevel,
      conditionBps: property.conditionBps,
      heightUnits: property.developmentLevel,
      damaged: property.conditionBps < 10_000,
      focused: focus.propertySlug === property.slug,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function contestFronts(
  projection: GridWorldProjection,
  visibleTerritorySlugs: Set<string>,
  zoomBand: GridMapZoomBand,
): GridMapContestFrontScene[] {
  return projection.player.activeContests
    .filter((contest) => {
      if (zoomBand === 'city') return true;
      return (
        visibleTerritorySlugs.has(contest.sourceTerritorySlug) ||
        visibleTerritorySlugs.has(contest.targetTerritorySlug)
      );
    })
    .map((contest) => ({ ...contest }))
    .sort((a, b) => a.contestId.localeCompare(b.contestId));
}

function skylineScenes(
  projection: GridWorldProjection,
  visibleTerritorySlugs: Set<string>,
  zoomBand: GridMapZoomBand,
): GridMapSkylineScene[] {
  return projection.yourSkylines
    .filter((skyline) => {
      if (zoomBand === 'city') return true;
      return skyline.territorySlugs.some((slug) =>
        visibleTerritorySlugs.has(slug),
      );
    })
    .map((skyline) => ({
      propertySlugs: [...skyline.propertySlugs].sort(),
      territorySlugs: [...skyline.territorySlugs].sort(),
      totalDevelopmentLevel: skyline.totalDevelopmentLevel,
      ruleIds: [...skyline.ruleIds].sort(),
    }))
    .sort((a, b) =>
      a.territorySlugs.join('::').localeCompare(b.territorySlugs.join('::')),
    );
}

export function buildGridMapScene(
  projection: GridWorldProjection,
  options: GridMapSceneOptions,
): GridMapScene {
  const zoomBand = gridMapZoomBand(options.zoom);
  const focus = resolveFocus(projection, options);
  const territories = territoryScenes(projection, focus, zoomBand);
  const properties = propertyScenes(projection, focus, zoomBand);
  const visibleTerritorySlugs = new Set(
    territories.map((territory) => territory.slug),
  );
  const districts = districtScenes(projection, focus);
  const contestFrontList = contestFronts(
    projection,
    visibleTerritorySlugs,
    zoomBand,
  );
  const skylines = skylineScenes(
    projection,
    visibleTerritorySlugs,
    zoomBand,
  );

  return {
    version: 1,
    zoom: options.zoom,
    zoomBand,
    center: sceneCenter(projection, focus),
    focus,
    visibility: {
      streets: true,
      districts: true,
      territories: zoomBand !== 'city',
      properties: zoomBand === 'property',
      virtualBuildings: zoomBand === 'property',
    },
    counts: {
      districts: districts.length,
      territoriesVisible: territories.length,
      propertiesVisible: properties.length,
      contestedTerritories: projection.territories.filter(
        (territory) => territory.contested,
      ).length,
      activeParticipantContests: contestFrontList.length,
    },
    districts,
    territories,
    properties,
    contestFronts: contestFrontList,
    skylines,
  };
}
