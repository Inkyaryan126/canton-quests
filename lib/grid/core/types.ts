import type { GridProvenanceRecord } from '../compiler/types';

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

export type GridConfidenceLevel = 'confirmed' | 'approximate' | 'unknown';

export interface GridHistoricalMetadata {
  era?: string;
  activationYear?: number;
  builtYear?: number;
  openedYear?: number;
  retiredYear?: number;
  demolishedYear?: number;
  predecessorSlug?: string;
  successorSlug?: string;
  sourceRefs?: string[];
  confidence?: GridConfidenceLevel;
}

export type GridPrivacyClass =
  | 'PUBLIC_CIVIC'
  | 'COMMERCIAL'
  | 'CULTURAL'
  | 'PARK'
  | 'INFRASTRUCTURE'
  | 'RESIDENTIAL_BACKGROUND'
  | 'PRIVATE_EXCLUDED'
  | 'UNKNOWN_REVIEW_REQUIRED';

export interface GridDistrictDefinition {
  slug: string;
  name: string;
  geometry?: GeoJSON.MultiPolygon;
  config?: Record<string, unknown>;
  sourceRefs?: string[];
}

export interface GridTerritoryDefinition {
  slug: string;
  name: string;
  districtSlug: string;
  baseValue: number;
  geometry?: GeoJSON.MultiPolygon;
  config?: Record<string, unknown>;
  historical?: GridHistoricalMetadata;
  sourceRefs?: string[];
}

export interface GridTerritoryEdgeDefinition {
  a: string;
  b: string;
  edgeType?: 'border' | 'corridor';
  historical?: Pick<GridHistoricalMetadata, 'openedYear' | 'retiredYear' | 'confidence' | 'sourceRefs'>;
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
  privacyClass?: GridPrivacyClass;
  historical?: GridHistoricalMetadata;
  sourceRefs?: string[];
}

export interface GridLandmarkDefinition {
  slug: string;
  name: string;
  territorySlug: string;
  point: GridLatLng;
  config?: Record<string, unknown>;
  privacyClass?: GridPrivacyClass;
  historical?: GridHistoricalMetadata;
  sourceRefs?: string[];
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

  compilerVersion?: string;
  sourceSnapshotVersion?: string;
  generatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  checksum?: string;
  provenance?: GridProvenanceRecord[];
}

export interface GridPackageValidation {
  ok: boolean;
  errors: string[];
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GRID_FOUNDATION_ENABLED?: string;
    }
  }
}

