import type { GridRawGeography, GridValidationIssue } from './types';
import { isValidPolygonGeometry } from '../geo/geometry';

export interface NormalizedGeography extends GridRawGeography {
  droppedFeatures: GridValidationIssue[];
}

function assertStructurallyValid(raw: GridRawGeography): void {
  if (!raw || typeof raw.citySlug !== 'string' || raw.citySlug.length === 0) {
    throw new Error('normalizeRawGeography: raw.citySlug is required and must be a non-empty string');
  }
  if (!raw.cityBoundary || raw.cityBoundary.type !== 'MultiPolygon') {
    throw new Error('normalizeRawGeography: raw.cityBoundary is required and must be a MultiPolygon');
  }
  if (
    !Array.isArray(raw.districts) ||
    !Array.isArray(raw.territories) ||
    !Array.isArray(raw.properties) ||
    !Array.isArray(raw.landmarks) ||
    !Array.isArray(raw.provenance)
  ) {
    throw new Error(
      'normalizeRawGeography: raw.districts/territories/properties/landmarks/provenance must all be arrays',
    );
  }
  if (raw.edges !== undefined && !Array.isArray(raw.edges)) {
    throw new Error('normalizeRawGeography: raw.edges, when present, must be an array');
  }
}

function droppedIssue(
  assetType: NonNullable<GridValidationIssue['assetType']>,
  assetSlug: string,
): GridValidationIssue {
  return {
    severity: 'ERROR',
    code: 'GEOMETRY_INVALID',
    message: `${assetType} ${assetSlug} has invalid polygon geometry and was dropped during normalization`,
    assetType,
    assetSlug,
  };
}

/**
 * Validates and normalizes raw geography ahead of city-package mapping.
 *
 * Invalid geometry is dropped (excluded from the returned arrays) and
 * recorded in droppedFeatures -- never repaired -- so a self-intersecting
 * or malformed polygon never silently becomes a "fixed" shape with a
 * different meaning than what the source actually described. A
 * structurally malformed input (missing citySlug, non-array collections,
 * etc.) throws instead, since that is an authoring error the compiler
 * should refuse to run on, not a data-quality issue it should tolerate.
 */
export function normalizeRawGeography(raw: GridRawGeography): NormalizedGeography {
  assertStructurallyValid(raw);

  const droppedFeatures: GridValidationIssue[] = [];

  const districts = raw.districts.filter((district) => {
    if (isValidPolygonGeometry(district.geometry)) return true;
    droppedFeatures.push(droppedIssue('district', district.slug));
    return false;
  });

  const territories = raw.territories.filter((territory) => {
    if (isValidPolygonGeometry(territory.geometry)) return true;
    droppedFeatures.push(droppedIssue('territory', territory.slug));
    return false;
  });

  const properties = raw.properties.filter((property) => {
    if (!property.geometry || isValidPolygonGeometry(property.geometry)) return true;
    droppedFeatures.push(droppedIssue('property', property.slug));
    return false;
  });

  return {
    ...raw,
    districts,
    territories,
    properties,
    landmarks: raw.landmarks,
    droppedFeatures,
  };
}
