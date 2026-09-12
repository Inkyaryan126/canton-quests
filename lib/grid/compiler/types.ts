import type {
  GridLatLng,
  GridCityPackage,
  GridDistrictDefinition,
  GridTerritoryDefinition,
  GridTerritoryEdgeDefinition,
  GridPropertyDefinition,
  GridLandmarkDefinition,
  GridHistoricalMetadata,
  GridPrivacyClass,
  GridConfidenceLevel,
} from '../core/types';

export interface GridProvenanceRecord {
  id: string;                 // referenced by sourceRefs on individual assets
  sourceName: string;
  sourceUrl: string;
  license: string;
  retrievedAt: string;        // ISO 8601 date
  transformation: string;     // plain-language description of what was done to the raw data
  attribution: string;        // exact attribution text required by the license
  confidence: GridConfidenceLevel;
}

export type GridValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface GridValidationIssue {
  severity: GridValidationSeverity;
  code: string;                // stable machine-readable code, e.g. 'GEOMETRY_INVALID'
  message: string;
  assetType?: 'city' | 'district' | 'territory' | 'edge' | 'property' | 'landmark';
  assetSlug?: string;
}

export interface GridValidationReport {
  ok: boolean;                 // true iff zero ERROR-severity issues
  issues: GridValidationIssue[];
}

// --- raw compiler input --------------------------------------------------

export interface GridRawDistrict {
  slug: string;
  name: string;
  geometry: GeoJSON.MultiPolygon;
  sourceRefs: string[];
}

export interface GridRawTerritory {
  slug: string;
  name: string;
  districtSlug: string;
  geometry: GeoJSON.MultiPolygon;
  baseValue?: number;
  historical?: GridHistoricalMetadata;
  sourceRefs: string[];
}

export interface GridRawProperty {
  slug: string;
  name: string;
  territorySlug: string;
  geometry?: GeoJSON.MultiPolygon;
  point?: GridLatLng;
  privacyClass: GridPrivacyClass;
  publicNameSafe: boolean;
  historical?: GridHistoricalMetadata;
  sourceRefs: string[];
}

export interface GridRawLandmark {
  slug: string;
  name: string;
  territorySlug: string;
  point: GridLatLng;
  privacyClass: GridPrivacyClass;
  historical?: GridHistoricalMetadata;
  sourceRefs: string[];
}

export interface GridRawGeography {
  citySlug: string;
  cityBoundary: GeoJSON.MultiPolygon;
  districts: GridRawDistrict[];
  territories: GridRawTerritory[];
  edges?: GridTerritoryEdgeDefinition[];   // explicit, source-validated adjacency; optional
  properties: GridRawProperty[];
  landmarks: GridRawLandmark[];
  provenance: GridProvenanceRecord[];
}

export interface GridCompilerOptions {
  compilerVersion: string;          // semver, bumped when normalization/mapping logic changes meaningfully
  sourceSnapshotVersion: string;    // identifies the raw-data snapshot, e.g. 'downtown-slice-v1'
  adjacencyToleranceMeters?: number;  // default 5
  overlapToleranceMeters?: number;    // default 1
  generatedAt?: string;             // injectable for deterministic tests; defaults to new Date().toISOString()
}

export interface GridCompiledPackageResult {
  package: GridCityPackage;         // status: 'draft'
  validation: GridValidationReport;
}
