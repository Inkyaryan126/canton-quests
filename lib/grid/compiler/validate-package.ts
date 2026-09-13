import type { GridCityPackage } from '../core/types';
import type {
  GridDistrictDefinition,
  GridTerritoryDefinition,
  GridPropertyDefinition,
  GridHistoricalMetadata,
  GridValidationIssue,
  GridValidationReport,
  GridRawGeography,
} from './types';
import {
  isValidPolygonGeometry,
  isWithinBounds,
  overlapAreaRatio,
} from '../geo/geometry';
import { findDuplicateSlugs } from '../geo/ids';

// Geometry validation and overlap calculations deliberately reuse the canonical
// city-agnostic helpers from lib/grid/geo so compiler validation and adjacency
// share one implementation and one GeoJSON [longitude, latitude] convention.

const OVERLAP_RATIO_THRESHOLD = 0.05;

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes].sort();
}

function hasProvenance(sourceRefs: string[] | undefined, provenanceIds: Set<string>): boolean {
  return !!sourceRefs && sourceRefs.length > 0 && sourceRefs.every((ref) => provenanceIds.has(ref));
}

function isPrivacyUnclassified(privacyClass: string | undefined): boolean {
  return !privacyClass || privacyClass === 'UNKNOWN_REVIEW_REQUIRED';
}

interface HistoricalOwner {
  slug: string;
  assetType: GridValidationIssue['assetType'];
  historical: GridHistoricalMetadata;
}

function collectHistoricalOwners(pkg: GridCityPackage): HistoricalOwner[] {
  const owners: HistoricalOwner[] = [];
  for (const territory of pkg.territories) {
    if (territory.historical) {
      owners.push({ slug: territory.slug, assetType: 'territory', historical: territory.historical });
    }
  }
  for (const property of pkg.properties) {
    if (property.historical) {
      owners.push({ slug: property.slug, assetType: 'property', historical: property.historical });
    }
  }
  for (const landmark of pkg.landmarks) {
    if (landmark.historical) {
      owners.push({ slug: landmark.slug, assetType: 'landmark', historical: landmark.historical });
    }
  }
  return owners;
}

export function runCityValidation(
  pkg: GridCityPackage,
  raw?: GridRawGeography
): GridValidationReport {
  const issues: GridValidationIssue[] = [];
  const push = (issue: GridValidationIssue) => issues.push(issue);

  const districtSlugs = new Set(pkg.districts.map((d) => d.slug));
  const territorySlugs = new Set(pkg.territories.map((t) => t.slug));
  const provenanceIds = new Set((pkg.provenance ?? []).map((p) => p.id));

  // GEOMETRY_INVALID
  const geometryOwners: Array<{
    slug: string;
    assetType: GridValidationIssue['assetType'];
    geometry?: GeoJSON.MultiPolygon;
  }> = [
    ...pkg.districts.map((d: GridDistrictDefinition) => ({ slug: d.slug, assetType: 'district' as const, geometry: d.geometry })),
    ...pkg.territories.map((t: GridTerritoryDefinition) => ({ slug: t.slug, assetType: 'territory' as const, geometry: t.geometry })),
    ...pkg.properties.map((p: GridPropertyDefinition) => ({ slug: p.slug, assetType: 'property' as const, geometry: p.geometry })),
  ];
  for (const owner of geometryOwners) {
    if (owner.geometry && !isValidPolygonGeometry(owner.geometry)) {
      push({
        severity: 'ERROR',
        code: 'GEOMETRY_INVALID',
        message: `${owner.assetType} ${owner.slug} has invalid polygon geometry`,
        assetType: owner.assetType,
        assetSlug: owner.slug,
      });
    }
  }

  // DUPLICATE_SLUG
  const slugSources: Array<[GridValidationIssue['assetType'], string[]]> = [
    ['district', pkg.districts.map((d) => d.slug)],
    ['territory', pkg.territories.map((t) => t.slug)],
    ['property', pkg.properties.map((p) => p.slug)],
    ['landmark', pkg.landmarks.map((l) => l.slug)],
  ];
  for (const [assetType, slugs] of slugSources) {
    for (const slug of findDuplicateSlugs(slugs)) {
      push({
        severity: 'ERROR',
        code: 'DUPLICATE_SLUG',
        message: `duplicate ${assetType} slug: ${slug}`,
        assetType,
        assetSlug: slug,
      });
    }
  }

  // DUPLICATE_ID (provenance record ids)
  for (const id of duplicates((pkg.provenance ?? []).map((p) => p.id))) {
    push({
      severity: 'ERROR',
      code: 'DUPLICATE_ID',
      message: `duplicate provenance record id: ${id}`,
    });
  }

  // TERRITORY_OUT_OF_BOUNDS (requires raw.cityBoundary)
  if (raw?.cityBoundary) {
    for (const territory of pkg.territories) {
      if (territory.geometry && !isWithinBounds(territory.geometry, raw.cityBoundary)) {
        push({
          severity: 'ERROR',
          code: 'TERRITORY_OUT_OF_BOUNDS',
          message: `territory ${territory.slug} lies outside the city boundary`,
          assetType: 'territory',
          assetSlug: territory.slug,
        });
      }
    }
  }

  // TERRITORY_ISLAND
  if (pkg.territories.length > 1) {
    const connected = new Set<string>();
    for (const edge of pkg.edges) {
      connected.add(edge.a);
      connected.add(edge.b);
    }
    for (const territory of pkg.territories) {
      if (!connected.has(territory.slug)) {
        push({
          severity: 'WARNING',
          code: 'TERRITORY_ISLAND',
          message: `territory ${territory.slug} has no adjacency edges`,
          assetType: 'territory',
          assetSlug: territory.slug,
        });
      }
    }
  }

  // SELF_ADJACENCY / CROSS_CITY_ADJACENCY
  for (const edge of pkg.edges) {
    if (edge.a === edge.b) {
      push({
        severity: 'ERROR',
        code: 'SELF_ADJACENCY',
        message: `edge cannot connect ${edge.a} to itself`,
        assetType: 'edge',
        assetSlug: edge.a,
      });
      continue;
    }

    if (!territorySlugs.has(edge.a) || !territorySlugs.has(edge.b)) {
      push({
        severity: 'ERROR',
        code: 'CROSS_CITY_ADJACENCY',
        message: `edge ${edge.a} -> ${edge.b} references a territory outside this city's package`,
        assetType: 'edge',
        assetSlug: `${edge.a}::${edge.b}`,
      });
    }
  }

  // MISSING_DISTRICT_REF
  for (const territory of pkg.territories) {
    if (!districtSlugs.has(territory.districtSlug)) {
      push({
        severity: 'ERROR',
        code: 'MISSING_DISTRICT_REF',
        message: `territory ${territory.slug} references unknown district ${territory.districtSlug}`,
        assetType: 'territory',
        assetSlug: territory.slug,
      });
    }
  }

  // OVERLAP_TOLERANCE_EXCEEDED
  const territoriesWithGeometry = pkg.territories.filter((t) => t.geometry);
  for (let i = 0; i < territoriesWithGeometry.length; i++) {
    for (let j = i + 1; j < territoriesWithGeometry.length; j++) {
      const a = territoriesWithGeometry[i];
      const b = territoriesWithGeometry[j];
      const ratio = overlapAreaRatio(a.geometry!, b.geometry!);
      if (ratio > OVERLAP_RATIO_THRESHOLD) {
        push({
          severity: 'WARNING',
          code: 'OVERLAP_TOLERANCE_EXCEEDED',
          message: `territories ${a.slug} and ${b.slug} overlap beyond tolerance (${(ratio * 100).toFixed(1)}%)`,
          assetType: 'territory',
          assetSlug: `${a.slug}::${b.slug}`,
        });
      }
    }
  }

  // PROPERTY_MISSING_TERRITORY / LANDMARK_MISSING_TERRITORY
  for (const property of pkg.properties) {
    if (!territorySlugs.has(property.territorySlug)) {
      push({
        severity: 'ERROR',
        code: 'PROPERTY_MISSING_TERRITORY',
        message: `property ${property.slug} references unknown territory ${property.territorySlug}`,
        assetType: 'property',
        assetSlug: property.slug,
      });
    }
  }
  for (const landmark of pkg.landmarks) {
    if (!territorySlugs.has(landmark.territorySlug)) {
      push({
        severity: 'ERROR',
        code: 'LANDMARK_MISSING_TERRITORY',
        message: `landmark ${landmark.slug} references unknown territory ${landmark.territorySlug}`,
        assetType: 'landmark',
        assetSlug: landmark.slug,
      });
    }
  }

  // MISSING_PROVENANCE (status-aware: WARNING draft / ERROR ready)
  const provenanceSeverity = pkg.status === 'ready' ? 'ERROR' : 'WARNING';
  const provenanceOwners: Array<{ slug: string; assetType: GridValidationIssue['assetType']; sourceRefs?: string[] }> = [
    ...pkg.districts.map((d) => ({ slug: d.slug, assetType: 'district' as const, sourceRefs: d.sourceRefs })),
    ...pkg.territories.map((t) => ({ slug: t.slug, assetType: 'territory' as const, sourceRefs: t.sourceRefs })),
    ...pkg.properties.map((p) => ({ slug: p.slug, assetType: 'property' as const, sourceRefs: p.sourceRefs })),
    ...pkg.landmarks.map((l) => ({ slug: l.slug, assetType: 'landmark' as const, sourceRefs: l.sourceRefs })),
  ];
  for (const owner of provenanceOwners) {
    if (!hasProvenance(owner.sourceRefs, provenanceIds)) {
      push({
        severity: provenanceSeverity,
        code: 'MISSING_PROVENANCE',
        message: `${owner.assetType} ${owner.slug} has no sourceRefs resolving to a provenance record`,
        assetType: owner.assetType,
        assetSlug: owner.slug,
      });
    }
  }

  // PRIVACY_UNCLASSIFIED (status-aware: WARNING draft / ERROR ready)
  const privacySeverity = pkg.status === 'ready' ? 'ERROR' : 'WARNING';
  const privacyOwners: Array<{ slug: string; assetType: GridValidationIssue['assetType']; privacyClass?: string }> = [
    ...pkg.properties.map((p) => ({ slug: p.slug, assetType: 'property' as const, privacyClass: p.privacyClass })),
    ...pkg.landmarks.map((l) => ({ slug: l.slug, assetType: 'landmark' as const, privacyClass: l.privacyClass })),
  ];
  for (const owner of privacyOwners) {
    if (isPrivacyUnclassified(owner.privacyClass)) {
      push({
        severity: privacySeverity,
        code: 'PRIVACY_UNCLASSIFIED',
        message: `${owner.assetType} ${owner.slug} has no privacy classification`,
        assetType: owner.assetType,
        assetSlug: owner.slug,
      });
    }
  }

  // RESIDENTIAL_EXPOSURE (always ERROR, draft or ready)
  for (const property of pkg.properties) {
    if (
      property.privacyClass &&
      (property.privacyClass === 'RESIDENTIAL_BACKGROUND' || property.privacyClass === 'PRIVATE_EXCLUDED') &&
      property.publicNameSafe
    ) {
      push({
        severity: 'ERROR',
        code: 'RESIDENTIAL_EXPOSURE',
        message: `property ${property.slug} is ${property.privacyClass} but marked publicNameSafe`,
        assetType: 'property',
        assetSlug: property.slug,
      });
    }
  }
  for (const landmark of pkg.landmarks) {
    if (
      landmark.privacyClass &&
      (landmark.privacyClass === 'RESIDENTIAL_BACKGROUND' || landmark.privacyClass === 'PRIVATE_EXCLUDED')
    ) {
      push({
        severity: 'ERROR',
        code: 'RESIDENTIAL_EXPOSURE',
        message: `landmark ${landmark.slug} is ${landmark.privacyClass} but always shown by name`,
        assetType: 'landmark',
        assetSlug: landmark.slug,
      });
    }
  }

  // FAKE_PLACEHOLDER_GEOGRAPHY (ready only)
  if (pkg.status === 'ready') {
    const readyOwners: Array<{ slug: string; assetType: GridValidationIssue['assetType']; sourceRefs?: string[] }> = [
      ...pkg.territories.map((t) => ({ slug: t.slug, assetType: 'territory' as const, sourceRefs: t.sourceRefs })),
      ...pkg.properties.map((p) => ({ slug: p.slug, assetType: 'property' as const, sourceRefs: p.sourceRefs })),
      ...pkg.landmarks.map((l) => ({ slug: l.slug, assetType: 'landmark' as const, sourceRefs: l.sourceRefs })),
    ];
    for (const owner of readyOwners) {
      if (!owner.sourceRefs || owner.sourceRefs.length === 0) {
        push({
          severity: 'ERROR',
          code: 'FAKE_PLACEHOLDER_GEOGRAPHY',
          message: `${owner.assetType} ${owner.slug} has no sourceRefs and cannot ship as ready`,
          assetType: owner.assetType,
          assetSlug: owner.slug,
        });
      }
    }

    // EMPTY_READY_PACKAGE
    if (pkg.territories.length === 0) {
      push({
        severity: 'ERROR',
        code: 'EMPTY_READY_PACKAGE',
        message: 'ready package has zero territories',
        assetType: 'city',
        assetSlug: pkg.city.slug,
      });
    }
  }

  // HISTORICAL_CHRONOLOGY_INVALID
  const historicalOwners = collectHistoricalOwners(pkg);
  for (const owner of historicalOwners) {
    const { builtYear, openedYear, activationYear, retiredYear, demolishedYear } = owner.historical;
    const startYear = builtYear ?? openedYear ?? activationYear;
    const endYear = retiredYear ?? demolishedYear;
    if (startYear !== undefined && endYear !== undefined && endYear < startYear) {
      push({
        severity: 'ERROR',
        code: 'HISTORICAL_CHRONOLOGY_INVALID',
        message: `${owner.assetType} ${owner.slug} has a retirement/demolition year before its built/opened/activation year`,
        assetType: owner.assetType,
        assetSlug: owner.slug,
      });
    }
  }

  // HISTORICAL_REFERENCE_DANGLING / HISTORICAL_REFERENCE_LOOP
  const allSlugs = new Set<string>([
    ...districtSlugs,
    ...territorySlugs,
    ...pkg.properties.map((p) => p.slug),
    ...pkg.landmarks.map((l) => l.slug),
  ]);
  const adjacency = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string) => {
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    adjacency.get(from)!.add(to);
  };

  for (const owner of historicalOwners) {
    const { predecessorSlug, successorSlug } = owner.historical;
    if (predecessorSlug !== undefined) {
      if (!allSlugs.has(predecessorSlug)) {
        push({
          severity: 'ERROR',
          code: 'HISTORICAL_REFERENCE_DANGLING',
          message: `${owner.assetType} ${owner.slug} has a predecessorSlug (${predecessorSlug}) that does not exist in this package`,
          assetType: owner.assetType,
          assetSlug: owner.slug,
        });
      } else {
        addEdge(predecessorSlug, owner.slug);
      }
    }
    if (successorSlug !== undefined) {
      if (!allSlugs.has(successorSlug)) {
        push({
          severity: 'ERROR',
          code: 'HISTORICAL_REFERENCE_DANGLING',
          message: `${owner.assetType} ${owner.slug} has a successorSlug (${successorSlug}) that does not exist in this package`,
          assetType: owner.assetType,
          assetSlug: owner.slug,
        });
      } else {
        addEdge(owner.slug, successorSlug);
      }
    }
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const cyclicSlugs = new Set<string>();

  const visit = (node: string): boolean => {
    color.set(node, GRAY);
    for (const next of adjacency.get(node) ?? []) {
      const state = color.get(next) ?? WHITE;
      if (state === GRAY) {
        cyclicSlugs.add(node);
        cyclicSlugs.add(next);
        return true;
      }
      if (state === WHITE && visit(next)) {
        cyclicSlugs.add(node);
        return true;
      }
    }
    color.set(node, BLACK);
    return false;
  };

  for (const node of adjacency.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      visit(node);
    }
  }

  if (cyclicSlugs.size > 0) {
    const slugToOwner = new Map(historicalOwners.map((owner): [string, HistoricalOwner] => [owner.slug, owner]));
    for (const slug of [...cyclicSlugs].sort()) {
      const owner = slugToOwner.get(slug);
      push({
        severity: 'ERROR',
        code: 'HISTORICAL_REFERENCE_LOOP',
        message: `${slug} is part of a predecessor/successor reference cycle`,
        assetType: owner?.assetType,
        assetSlug: slug,
      });
    }
  }

  return { ok: issues.every((issue) => issue.severity !== 'ERROR'), issues };
}
