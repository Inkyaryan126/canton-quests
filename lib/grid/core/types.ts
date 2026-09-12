export type GridCityPackageStatus = 'draft' | 'ready';

export interface GridLatLng {
  lat: number;
  lng: number;
}

export interface GridBalanceConfig {
  startingCredits: number;
  startingInfluence: number;
  maxCommandPoints: number;
  commandPointRegenMinutes: number;
}

export interface GridDistrictDefinition {
  slug: string;
  name: string;
  geometry?: GeoJSON.MultiPolygon;
  config?: Record<string, unknown>;
}

export interface GridTerritoryDefinition {
  slug: string;
  name: string;
  districtSlug: string;
  baseValue: number;
  geometry?: GeoJSON.MultiPolygon;
  config?: Record<string, unknown>;
}

export interface GridTerritoryEdgeDefinition {
  a: string;
  b: string;
  edgeType?: 'border' | 'corridor';
}

export interface GridPropertyDefinition {
  slug: string;
  name: string;
  territorySlug: string;
  baseValue: number;
  publicNameSafe: boolean;
  geometry?: GeoJSON.MultiPolygon;
  point?: GridLatLng;
  config?: Record<string, unknown>;
}

export interface GridLandmarkDefinition {
  slug: string;
  name: string;
  territorySlug: string;
  point: GridLatLng;
  config?: Record<string, unknown>;
}

export interface GridCityPackage {
  schemaVersion: 1;
  packageVersion: number;
  status: GridCityPackageStatus;
  city: {
    slug: string;
    name: string;
    regionCode: string;
    countryCode: string;
    timezone: string;
    mapCenter: GridLatLng;
  };
  seasonTemplate: {
    slug: string;
    name: string;
    durationDays: number;
    surgeHours: number;
    balance: GridBalanceConfig;
  };
  districts: GridDistrictDefinition[];
  territories: GridTerritoryDefinition[];
  edges: GridTerritoryEdgeDefinition[];
  properties: GridPropertyDefinition[];
  landmarks: GridLandmarkDefinition[];
}

export interface GridPackageValidation {
  ok: boolean;
  errors: string[];
}
