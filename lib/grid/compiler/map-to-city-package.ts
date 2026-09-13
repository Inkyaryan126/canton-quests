import crypto from 'node:crypto';
import { computeAdjacency } from '../geo/adjacency';
import type {
  GridCityPackage,
  GridDistrictDefinition,
  GridPropertyDefinition,
  GridLandmarkDefinition,
  GridTerritoryDefinition,
  GridTerritoryEdgeDefinition,
} from '../core/types';
import type {
  GridCompilerOptions,
  GridValidationIssue,
} from './types';
import type { NormalizedGeography } from './normalize';

/**
 * Cross-checks explicit geography edges against computed geometric adjacency.
 * Returns INFO-severity issues for any edges that exist in one set but not the other.
 */
export function crossCheckAdjacency(
  explicitEdges: GridTerritoryEdgeDefinition[],
  computedEdges: GridTerritoryEdgeDefinition[],
): GridValidationIssue[] {
  const explicitKeys = new Set(
    explicitEdges.map((e) => [e.a, e.b].sort().join('::')),
  );
  const computedKeys = new Set(
    computedEdges.map((e) => [e.a, e.b].sort().join('::')),
  );

  const issues: GridValidationIssue[] = [];

  for (const key of [...explicitKeys].sort()) {
    if (!computedKeys.has(key)) {
      issues.push({
        severity: 'INFO',
        code: 'ADJACENCY_CROSS_CHECK_MISMATCH',
        message: `explicit edge ${key} was not found by geometric adjacency computation`,
        assetType: 'edge',
        assetSlug: key,
      });
    }
  }

  for (const key of [...computedKeys].sort()) {
    if (!explicitKeys.has(key)) {
      issues.push({
        severity: 'INFO',
        code: 'ADJACENCY_CROSS_CHECK_MISMATCH',
        message: `computed geometric edge ${key} is not present in explicit edges list`,
        assetType: 'edge',
        assetSlug: key,
      });
    }
  }

  return issues;
}

/**
 * Recursively canonicalizes data structures so object keys are sorted alphabetically.
 * Ensures deterministic JSON serialization across platforms and runs.
 */
function canonicalize(val: unknown): unknown {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalize);
  }
  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    if (obj[key] !== undefined) {
      result[key] = canonicalize(obj[key]);
    }
  }
  return result;
}

/**
 * Maps normalized geography, season template, and city metadata into a draft GridCityPackage.
 *
 * Requirements:
 * - Always sets status to 'draft' (compiler never marks packages ready).
 * - Stamps compilerVersion, sourceSnapshotVersion, generatedAt, and sha256 checksum.
 * - If normalized.edges is present, it is preserved and cross-checked against computed adjacency;
 *   any differences are recorded as INFO issues rather than overriding source truth.
 * - If normalized.edges is absent, adjacency is computed geometrically.
 */
export function mapToCityPackage(
  normalized: NormalizedGeography,
  seasonTemplate: GridCityPackage['seasonTemplate'],
  cityMeta: GridCityPackage['city'],
  options: GridCompilerOptions,
  edgeIssuesOut?: GridValidationIssue[],
): GridCityPackage {
  const districts: GridDistrictDefinition[] = normalized.districts.map((d) => ({
    slug: d.slug,
    name: d.name,
    geometry: d.geometry,
    sourceRefs: d.sourceRefs ? [...d.sourceRefs] : [],
  }));

  const territories: GridTerritoryDefinition[] = normalized.territories.map((t) => ({
    slug: t.slug,
    name: t.name,
    districtSlug: t.districtSlug,
    baseValue: typeof t.baseValue === 'number' && Number.isFinite(t.baseValue) ? t.baseValue : 100,
    geometry: t.geometry,
    historical: t.historical ? { ...t.historical } : undefined,
    sourceRefs: t.sourceRefs ? [...t.sourceRefs] : [],
  }));

  const properties: GridPropertyDefinition[] = normalized.properties.map((p) => ({
    slug: p.slug,
    name: p.name,
    territorySlug: p.territorySlug,
    baseValue: 100,
    publicNameSafe: p.publicNameSafe,
    geometry: p.geometry,
    point: p.point,
    privacyClass: p.privacyClass,
    historical: p.historical ? { ...p.historical } : undefined,
    sourceRefs: p.sourceRefs ? [...p.sourceRefs] : [],
  }));

  const landmarks: GridLandmarkDefinition[] = normalized.landmarks.map((l) => ({
    slug: l.slug,
    name: l.name,
    territorySlug: l.territorySlug,
    point: l.point,
    privacyClass: l.privacyClass,
    historical: l.historical ? { ...l.historical } : undefined,
    sourceRefs: l.sourceRefs ? [...l.sourceRefs] : [],
  }));

  const territoryAdjacencyInputs = normalized.territories
    .filter((t) => t.geometry)
    .map((t) => ({ slug: t.slug, geometry: t.geometry }));

  const computedEdges = computeAdjacency(
    territoryAdjacencyInputs,
    options.adjacencyToleranceMeters,
  ).map((e) => {
    const [a, b] = [e.a, e.b].sort();
    return { ...e, a, b };
  }).sort((e1, e2) => e1.a.localeCompare(e2.a) || e1.b.localeCompare(e2.b));

  let finalEdges: GridTerritoryEdgeDefinition[];
  if (normalized.edges !== undefined) {
    finalEdges = normalized.edges.map((e) => {
      const [a, b] = [e.a, e.b].sort();
      return { ...e, a, b };
    }).sort((e1, e2) => e1.a.localeCompare(e2.a) || e1.b.localeCompare(e2.b));

    const edgeMismatches = crossCheckAdjacency(finalEdges, computedEdges);
    if (edgeIssuesOut) {
      edgeIssuesOut.push(...edgeMismatches);
    }
  } else {
    finalEdges = computedEdges;
  }

  const generatedAt = options.generatedAt ?? new Date().toISOString();

  // Payload for checksum calculation excludes generatedAt and checksum itself
  const preChecksumPayload = {
    schemaVersion: 1 as const,
    packageVersion: 1,
    status: 'draft' as const,
    city: cityMeta,
    seasonTemplate,
    districts,
    territories,
    edges: finalEdges,
    properties,
    landmarks,
    compilerVersion: options.compilerVersion,
    sourceSnapshotVersion: options.sourceSnapshotVersion,
    provenance: normalized.provenance ? [...normalized.provenance] : [],
  };

  const serialized = JSON.stringify(canonicalize(preChecksumPayload));
  const checksum = crypto.createHash('sha256').update(serialized).digest('hex');

  const pkg: GridCityPackage = {
    ...preChecksumPayload,
    generatedAt,
    checksum,
  };

  return pkg;
}
