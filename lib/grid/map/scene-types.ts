import type { GridDevelopmentBranch } from '../core/economy-types';
import type { GridLatLng } from '../core/types';
import type { GridWorldOwnership } from '../server/world-projection';

export type GridMapZoomBand = 'city' | 'district' | 'property';

export type GridMapTerritoryVisualState =
  | GridWorldOwnership
  | 'contested';

export interface GridMapSceneFocus {
  districtSlug: string | null;
  territorySlug: string | null;
  propertySlug: string | null;
}

export interface GridMapDistrictScene {
  slug: string;
  focused: boolean;
  territoryCount: number;
  neutralTerritories: number;
  yourTerritories: number;
  occupiedTerritories: number;
  contestedTerritories: number;
}
export interface GridMapTerritoryScene {
  slug: string;
  name: string;
  districtSlug: string;
  geometry?: GeoJSON.MultiPolygon;
  ownership: GridWorldOwnership;
  visualState: GridMapTerritoryVisualState;
  claimable: boolean;
  starterEligible: boolean;
  contested: boolean;
  focused: boolean;
  propertyCount: number;
  developedPropertyCount: number;
  totalDevelopmentLevel: number;
}

export interface GridMapPropertyScene {
  slug: string;
  name: string;
  territorySlug: string;
  point?: GridLatLng;
  geometry?: GeoJSON.MultiPolygon;
  ownership: GridWorldOwnership;
  developmentBranch: GridDevelopmentBranch | null;
  developmentLevel: number;
  conditionBps: number;
  heightUnits: number;
  damaged: boolean;
  focused: boolean;
}

export interface GridMapContestFrontScene {
  contestId: string;
  role: 'attacker' | 'defender';
  sourceTerritorySlug: string;
  targetTerritorySlug: string;
  roundNumber: number;
  yourRemainingInfluence: number;
  opponentRemainingInfluence: number;
  startedAt: string;
}

export interface GridMapSkylineScene {
  propertySlugs: string[];
  territorySlugs: string[];
  totalDevelopmentLevel: number;
  ruleIds: string[];
}

export interface GridMapScene {
  version: 1;
  zoom: number;
  zoomBand: GridMapZoomBand;
  center: GridLatLng;
  focus: GridMapSceneFocus;
  visibility: {
    streets: true;
    districts: true;
    territories: boolean;
    properties: boolean;
    virtualBuildings: boolean;
  };
  counts: {
    districts: number;
    territoriesVisible: number;
    propertiesVisible: number;
    contestedTerritories: number;
    activeParticipantContests: number;
  };
  districts: GridMapDistrictScene[];
  territories: GridMapTerritoryScene[];
  properties: GridMapPropertyScene[];
  contestFronts: GridMapContestFrontScene[];
  skylines: GridMapSkylineScene[];
}
