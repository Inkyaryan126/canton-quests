import { createHash } from 'crypto';
import type {
  GridCityPackage,
  GridDistrictDefinition,
  GridLandmarkDefinition,
  GridPropertyDefinition,
  GridTerritoryDefinition,
  GridTerritoryEdgeDefinition,
} from '../core/types';
import type { GridCompilerOptions, GridValidationIssue } from './types';
import type { NormalizedGeography } from './normalize';
import { computeAdjacency } from '../geo/adjacency';

const DEFAULT_ADJACENCY_TOLERANCE_METERS = 5;

function edgeKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

/**
 * JSON.stringify with object keys sorted, so semantically identical payloads
 * always serialize to the same string regardless of property insertion
 * order -- required for the checksum to be a pure function of content.
 * Mirrors JSON.stringify's own undefined-handling (dropped from objects,
 * nulled inside arrays) so the checksum input stays a faithful, stable
 * projection of what JSON.stringify would eventually emit for the package.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => (entry === undefined ? 'null' : stableStringify(entry))).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
}

function computeChecksum(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

/**
 * Assigns normalized geography into the GridCityPackage shape, computes or
 * cross-checks adjacency, and stamps compiler/provenance metadata. Always
 * produces status: 'draft' -- promotion to 'ready' is a deliberate, separate,
 * human-reviewed step this function never performs.
 */
export function mapToCityPackage(
  normalized: NormalizedGeography,
  seasonTemplate: GridCityPackage['seasonTemplate'],
  cityMeta: GridCityPackage['city'],
  options: GridCompilerOptions,
): GridCityPackage {
  const districts: GridDistrictDefinition[] = normalized.districts.map((district) => ({
    slug: district.slug,
    name: district.name,
    geometry: district.geometry,
    sourceRefs: district.sourceRefs,
  }));

  const territories: GridTerritoryDefinition[] = normalized.territories.map((territory) => ({
    slug: territory.slug,
    name: territory.name,
    districtSlug: territory.districtSlug,
    baseValue: territory.baseValue ?? 0,
    geometry: territory.geometry,
    historical: territory.historical,
    sourceRefs: territory.sourceRefs,
  }));

  const properties: GridPropertyDefinition[] = normalized.properties.map((property) => ({
    slug: property.slug,
    name: property.name,
    territorySlug: property.territorySlug,
    baseValue: 0,
    publicNameSafe: property.publicNameSafe,
    geometry: property.geometry,
    point: property.point,
    privacyClass: property.privacyClass,
    historical: property.historical,
    sourceRefs: property.sourceRefs,
  }));

  const landmarks: GridLandmarkDefinition[] = normalized.landmarks.map((landmark) => ({
    slug: landmark.slug,
    name: landmark.name,
    territorySlug: landmark.territorySlug,
    point: landmark.point,
    privacyClass: landmark.privacyClass,
    historical: landmark.historical,
    sourceRefs: landmark.sourceRefs,
  }));

  // Source-validated adjacency (normalized.edges) is authoritative when
  // present -- it is kept verbatim, never silently overridden by computed
  // adjacency, even when the two disagree (see computeAdjacencyMismatchIssues).
  const edges: GridTerritoryEdgeDefinition[] =
    normalized.edges !== undefined
      ? normalized.edges
      : computeAdjacency(
          normalized.territories.map((territory) => ({ slug: territory.slug, geometry: territory.geometry })),
          options.adjacencyToleranceMeters ?? DEFAULT_ADJACENCY_TOLERANCE_METERS,
        );

  const payload: Omit<GridCityPackage, 'generatedAt' | 'checksum'> = {
    schemaVersion: 1,
    packageVersion: 1,
    status: 'draft',
    city: cityMeta,
    seasonTemplate,
    districts,
    territories,
    edges,
    properties,
    landmarks,
    compilerVersion: options.compilerVersion,
    sourceSnapshotVersion: options.sourceSnapshotVersion,
    provenance: normalized.provenance,
  };

  const checksum = computeChecksum(payload);
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  return {
    ...payload,
    generatedAt,
    checksum,
  };
}

/**
 * When normalized.edges was supplied by the source, cross-checks it against
 * geometry-computed adjacency and reports any disagreement as INFO-severity
 * notes -- the explicit list is never overridden (see mapToCityPackage), so
 * this is purely informational surfacing of a discrepancy for human review.
 * Returns an empty array when no explicit edges were supplied, since there is
 * nothing to cross-check against.
 */
export function computeAdjacencyMismatchIssues(
  normalized: NormalizedGeography,
  toleranceMeters?: number,
): GridValidationIssue[] {
  if (normalized.edges === undefined) return [];

  const computed = computeAdjacency(
    normalized.territories.map((territory) => ({ slug: territory.slug, geometry: territory.geometry })),
    toleranceMeters ?? DEFAULT_ADJACENCY_TOLERANCE_METERS,
  );
  const computedKeys = new Set(computed.map((edge) => edgeKey(edge.a, edge.b)));
  const explicitKeys = new Set(normalized.edges.map((edge) => edgeKey(edge.a, edge.b)));

  const mismatchKeys = new Set<string>();
  for (const key of computedKeys) if (!explicitKeys.has(key)) mismatchKeys.add(key);
  for (const key of explicitKeys) if (!computedKeys.has(key)) mismatchKeys.add(key);

  return [...mismatchKeys].sort().map((key): GridValidationIssue => {
    const [a, b] = key.split('::');
    const message = explicitKeys.has(key)
      ? `explicit edge ${a} <-> ${b} is not confirmed by computed adjacency`
      : `computed adjacency ${a} <-> ${b} is not present in the explicit edge list`;
    return {
      severity: 'INFO',
      code: 'ADJACENCY_MISMATCH',
      message,
      assetType: 'edge',
      assetSlug: key,
    };
  });
}
