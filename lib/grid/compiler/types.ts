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
  GridProvenanceRecord,
} from '../core/types';

export type { GridProvenanceRecord };

export type GridValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface GridValidationIssue {
  severity: GridValidationSeverity;
  code: string;
  message: string;
  assetType?: 'city' | 'district' | 'territory' | 'edge' | 'property' | 'landmark';
  assetSlug?: string;
}

export interface GridValidationReport {
  ok: boolean;
  issues: GridValidationIssue[];
}

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
  edges?: GridTerritoryEdgeDefinition[];
  properties: GridRawProperty[];
  landmarks: GridRawLandmark[];
  provenance: GridProvenanceRecord[];
}

export interface GridCompilerOptions {
  compilerVersion: string;
  sourceSnapshotVersion: string;
  adjacencyToleranceMeters?: number;
  overlapToleranceMeters?: number;
  generatedAt?: string;
}

export interface GridCompiledPackageResult {
  package: GridCityPackage;
  validation: GridValidationReport;
}

// Re-exported for convenience so downstream compiler modules can import
// GridDistrictDefinition/GridTerritoryDefinition/etc. from this file instead
// of reaching back into lib/grid/core/types directly, without duplicating
// their definitions here.
export type {
  GridDistrictDefinition,
  GridTerritoryDefinition,
  GridTerritoryEdgeDefinition,
  GridPropertyDefinition,
  GridLandmarkDefinition,
  GridHistoricalMetadata,
  GridPrivacyClass,
  GridConfidenceLevel,
};
