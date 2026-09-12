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

// Lives here rather than in lib/grid/compiler/types.ts because
// GridCityPackage.provenance (below) needs to reference it, and
// lib/grid/core must never import from lib/grid/compiler (only the reverse) --
// putting it in compiler/types.ts would create a circular import between the
// two modules. lib/grid/compiler/types.ts imports/re-exports this type from
// here like every other core type it depends on.
export interface GridProvenanceRecord {
  id: string; // referenced by sourceRefs on individual assets
  sourceName: string;
  sourceUrl: string;
  license: string;
  retrievedAt: string; // ISO 8601 date
  transformation: string;
  attribution: string;
  confidence: GridConfidenceLevel;
}

export interface GridHistoricalMetadata {
  era?: string;
  activationYear?: number;
  builtYear?: number;
  openedYear?: number;
  retiredYear?: number;
  demolishedYear?: number;
  predecessorSlug?: string;
  successorSlug?: string;
  sourceRefs?: string[]; // GridProvenanceRecord ids
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
  privacyClass?: GridPrivacyClass; // absent = treated as UNKNOWN_REVIEW_REQUIRED by the validator
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

  // Compiler/provenance metadata -- all optional so an untouched
  // hand-authored package (e.g. a future city stub) stays valid without them.
  compilerVersion?: string;
  sourceSnapshotVersion?: string;
  generatedAt?: string; // ISO 8601
  approvedAt?: string; // ISO 8601, set only by a human review action
  approvedBy?: string;
  checksum?: string; // sha256 of the normalized pre-metadata payload
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

