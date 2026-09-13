import { isValidPolygonGeometry } from '../geo/geometry';
import type {
  GridRawDistrict,
  GridRawGeography,
  GridRawProperty,
  GridRawTerritory,
  GridValidationIssue,
} from './types';

export interface NormalizedGeography extends GridRawGeography {
  droppedFeatures: GridValidationIssue[];
}

/**
 * Normalizes raw city geography before package mapping.
 *
 * Validates polygon geometry across districts, territories, and properties.
 * Features with invalid polygon geometry are dropped (never silently repaired)
 * and recorded in `droppedFeatures` as ERROR-severity GEOMETRY_INVALID issues.
 *
 * Structural authoring errors (missing citySlug, missing or malformed boundary,
 * non-array collections) throw an Error immediately.
 */
export function normalizeRawGeography(raw: GridRawGeography): NormalizedGeography {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid raw geography: input must be a valid object');
  }

  if (typeof raw.citySlug !== 'string' || !raw.citySlug.trim()) {
    throw new Error('Invalid raw geography: missing or empty citySlug');
  }

  if (!raw.cityBoundary || !isValidPolygonGeometry(raw.cityBoundary)) {
    throw new Error('Invalid raw geography: missing or invalid cityBoundary');
  }

  if (!Array.isArray(raw.districts)) {
    throw new Error('Invalid raw geography: districts must be an array');
  }

  if (!Array.isArray(raw.territories)) {
    throw new Error('Invalid raw geography: territories must be an array');
  }

  if (!Array.isArray(raw.properties)) {
    throw new Error('Invalid raw geography: properties must be an array');
  }

  if (!Array.isArray(raw.landmarks)) {
    throw new Error('Invalid raw geography: landmarks must be an array');
  }

  if (!Array.isArray(raw.provenance)) {
    throw new Error('Invalid raw geography: provenance must be an array');
  }

  const droppedFeatures: GridValidationIssue[] = [];

  const validDistricts: GridRawDistrict[] = [];
  for (const district of raw.districts) {
    if (district.geometry && isValidPolygonGeometry(district.geometry)) {
      validDistricts.push(district);
    } else {
      droppedFeatures.push({
        severity: 'ERROR',
        code: 'GEOMETRY_INVALID',
        message: `district ${district.slug} has invalid polygon geometry`,
        assetType: 'district',
        assetSlug: district.slug,
      });
    }
  }

  const validTerritories: GridRawTerritory[] = [];
  for (const territory of raw.territories) {
    if (territory.geometry && isValidPolygonGeometry(territory.geometry)) {
      validTerritories.push(territory);
    } else {
      droppedFeatures.push({
        severity: 'ERROR',
        code: 'GEOMETRY_INVALID',
        message: `territory ${territory.slug} has invalid polygon geometry`,
        assetType: 'territory',
        assetSlug: territory.slug,
      });
    }
  }

  const validProperties: GridRawProperty[] = [];
  for (const property of raw.properties) {
    if (property.geometry !== undefined) {
      if (isValidPolygonGeometry(property.geometry)) {
        validProperties.push(property);
      } else {
        droppedFeatures.push({
          severity: 'ERROR',
          code: 'GEOMETRY_INVALID',
          message: `property ${property.slug} has invalid polygon geometry`,
          assetType: 'property',
          assetSlug: property.slug,
        });
      }
    } else {
      validProperties.push(property);
    }
  }

  return {
    citySlug: raw.citySlug,
    cityBoundary: raw.cityBoundary,
    districts: validDistricts,
    territories: validTerritories,
    edges: raw.edges ? [...raw.edges] : undefined,
    properties: validProperties,
    landmarks: [...raw.landmarks],
    provenance: [...raw.provenance],
    droppedFeatures,
  };
}
