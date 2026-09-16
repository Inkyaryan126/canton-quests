import type {
  GridMapDistrictScene,
  GridMapPropertyScene,
  GridMapScene,
  GridMapTerritoryScene,
} from './scene-types';

export type GridMapGlow = 'none' | 'soft' | 'strong';
export type GridMapBorderRole =
  | 'quiet'
  | 'owned'
  | 'hostile'
  | 'claimable'
  | 'contested';

export type GridMapFillRole =
  | 'neutral'
  | 'controlled-you'
  | 'controlled-rival'
  | 'contested';

export type GridMapConditionBand =
  | 'healthy'
  | 'worn'
  | 'damaged'
  | 'critical';

export interface GridMapTerritoryPresentation {
  slug: string;
  fillRole: GridMapFillRole;
  borderRole: GridMapBorderRole;
  glow: GridMapGlow;
  pulse: boolean;
  focused: boolean;
}
export type GridMapDistrictControlRole =
  | 'neutral'
  | 'you'
  | 'rival'
  | 'mixed'
  | 'contested';

export interface GridMapDistrictPresentation {
  slug: string;
  controlRole: GridMapDistrictControlRole;
  glow: GridMapGlow;
  focused: boolean;
}

export interface GridMapPropertyPresentation {
  slug: string;
  conditionBand: GridMapConditionBand;
  glow: GridMapGlow;
  focused: boolean;
  virtualBuildingVisible: boolean;
  heightUnits: number;
}

export interface GridMapPresentation {
  version: 1;
  districts: GridMapDistrictPresentation[];
  territories: GridMapTerritoryPresentation[];
  properties: GridMapPropertyPresentation[];
}

export function gridMapConditionBand(conditionBps: number): GridMapConditionBand {
  if (!Number.isInteger(conditionBps) || conditionBps < 0 || conditionBps > 10_000) {
    throw new Error('Grid property condition must be an integer from 0..10000');
  }
  if (conditionBps >= 8_500) return 'healthy';
  if (conditionBps >= 6_500) return 'worn';
  if (conditionBps >= 4_000) return 'damaged';
  return 'critical';
}
function territoryPresentation(
  territory: GridMapTerritoryScene,
): GridMapTerritoryPresentation {
  const fillRole: GridMapFillRole = territory.contested
    ? 'contested'
    : territory.ownership === 'you'
      ? 'controlled-you'
      : territory.ownership === 'occupied'
        ? 'controlled-rival'
        : 'neutral';

  const borderRole: GridMapBorderRole = territory.contested
    ? 'contested'
    : territory.claimable
      ? 'claimable'
      : territory.ownership === 'you'
        ? 'owned'
        : territory.ownership === 'occupied'
          ? 'hostile'
          : 'quiet';

  const glow: GridMapGlow =
    territory.contested || territory.focused
      ? 'strong'
      : territory.claimable || territory.ownership === 'you'
        ? 'soft'
        : 'none';

  return {
    slug: territory.slug,
    fillRole,
    borderRole,
    glow,
    pulse: territory.contested,
    focused: territory.focused,
  };
}
function districtControlRole(
  district: GridMapDistrictScene,
): GridMapDistrictControlRole {
  if (district.contestedTerritories > 0) return 'contested';

  const controlledSides =
    Number(district.yourTerritories > 0) +
    Number(district.occupiedTerritories > 0);

  if (controlledSides === 0) return 'neutral';
  if (controlledSides === 2) return 'mixed';
  if (district.yourTerritories > 0) return 'you';
  return 'rival';
}

function districtPresentation(
  district: GridMapDistrictScene,
): GridMapDistrictPresentation {
  const controlRole = districtControlRole(district);
  const glow: GridMapGlow =
    district.focused || controlRole === 'contested'
      ? 'strong'
      : controlRole === 'you' || controlRole === 'mixed'
        ? 'soft'
        : 'none';

  return {
    slug: district.slug,
    controlRole,
    glow,
    focused: district.focused,
  };
}
function propertyPresentation(
  property: GridMapPropertyScene,
  virtualBuildingsVisible: boolean,
): GridMapPropertyPresentation {
  const conditionBand = gridMapConditionBand(property.conditionBps);
  const glow: GridMapGlow = property.focused
    ? 'strong'
    : property.ownership === 'you'
      ? 'soft'
      : 'none';

  return {
    slug: property.slug,
    conditionBand,
    glow,
    focused: property.focused,
    virtualBuildingVisible:
      virtualBuildingsVisible && property.developmentLevel > 0,
    heightUnits: property.heightUnits,
  };
}

export function buildGridMapPresentation(
  scene: GridMapScene,
): GridMapPresentation {
  return {
    version: 1,
    districts: scene.districts
      .map(districtPresentation)
      .sort((a, b) => a.slug.localeCompare(b.slug)),
    territories: scene.territories
      .map(territoryPresentation)
      .sort((a, b) => a.slug.localeCompare(b.slug)),
    properties: scene.properties
      .map((property) =>
        propertyPresentation(
          property,
          scene.visibility.virtualBuildings,
        ),
      )
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}
