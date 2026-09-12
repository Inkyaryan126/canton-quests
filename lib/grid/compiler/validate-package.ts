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

// Coordinate order for every geometry handled in this file is GeoJSON
// [longitude, latitude], matching the rest of lib/grid/geo per the compiler
// plan (docs/superpowers/plans/2026-09-12-the-grid-city-compiler-canton-geography.md §5.2).

type Ring = GeoJSON.Position[];

function ringIsClosed(ring: Ring): boolean {
  if (ring.length < 4) return false;
  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  return firstLng === lastLng && firstLat === lastLat;
}

function orientation(
  [ax, ay]: GeoJSON.Position,
  [bx, by]: GeoJSON.Position,
  [cx, cy]: GeoJSON.Position
): number {
  return (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
}

function onSegment(
  [px, py]: GeoJSON.Position,
  [qx, qy]: GeoJSON.Position,
  [rx, ry]: GeoJSON.Position
): boolean {
  return (
    Math.min(px, rx) <= qx &&
    qx <= Math.max(px, rx) &&
    Math.min(py, ry) <= qy &&
    qy <= Math.max(py, ry)
  );
}

function segmentsIntersect(
  p1: GeoJSON.Position,
  p2: GeoJSON.Position,
  p3: GeoJSON.Position,
  p4: GeoJSON.Position
): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);

  if (o1 === 0 && onSegment(p1, p3, p2)) return true;
  if (o2 === 0 && onSegment(p1, p4, p2)) return true;
  if (o3 === 0 && onSegment(p3, p1, p4)) return true;
  if (o4 === 0 && onSegment(p3, p2, p4)) return true;

  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function ringIsSimple(ring: Ring): boolean {
  const edgeCount = ring.length - 1;
  if (edgeCount < 3) return false;

  for (let i = 0; i < edgeCount; i++) {
    for (let j = i + 1; j < edgeCount; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === edgeCount - 1);
      if (adjacent) continue;

      if (segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])) {
        return false;
      }
    }
  }

  return true;
}

function isValidPolygonGeometry(geom: GeoJSON.MultiPolygon | GeoJSON.Polygon): boolean {
  if (!geom || typeof geom !== 'object') return false;

  if (geom.type === 'Polygon') {
    if (!geom.coordinates || geom.coordinates.length === 0) return false;
    for (const ring of geom.coordinates) {
      if (!ringIsClosed(ring) || !ringIsSimple(ring)) return false;
    }
    return true;
  }

  if (geom.type === 'MultiPolygon') {
    if (!geom.coordinates || geom.coordinates.length === 0) return false;
    for (const polygon of geom.coordinates) {
      if (!polygon || polygon.length === 0) return false;
      for (const ring of polygon) {
        if (!ringIsClosed(ring) || !ringIsSimple(ring)) return false;
      }
    }
    return true;
  }

  return false;
}

function pointInRing([px, py]: GeoJSON.Position, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: GeoJSON.Position, rings: Ring[]): boolean {
  if (rings.length === 0) return false;
  if (!pointInRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(point, rings[i])) return false;
  }
  return true;
}

function pointInMultiPolygon(point: GeoJSON.Position, geom: GeoJSON.MultiPolygon | GeoJSON.Polygon): boolean {
  if (geom.type === 'Polygon') {
    return pointInPolygon(point, geom.coordinates);
  }
  if (geom.type === 'MultiPolygon') {
    for (const polygon of geom.coordinates) {
      if (pointInPolygon(point, polygon)) return true;
    }
  }
  return false;
}

function ringVertices(ring: Ring): GeoJSON.Position[] {
  return ring.slice(0, -1);
}

function isWithinBounds(
  geom: GeoJSON.MultiPolygon | GeoJSON.Polygon,
  bounds: GeoJSON.MultiPolygon | GeoJSON.Polygon
): boolean {
  const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const vertex of ringVertices(ring)) {
        if (!pointInMultiPolygon(vertex, bounds)) return false;
      }
    }
  }
  return true;
}

function shoelaceArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function polygonArea(geom: GeoJSON.MultiPolygon): number {
  let total = 0;
  for (const polygon of geom.coordinates) {
    polygon.forEach((ring, index) => {
      const area = shoelaceArea(ring);
      total += index === 0 ? area : -area;
    });
  }
  return total;
}

function lineIntersection(
  [ax, ay]: GeoJSON.Position,
  [bx, by]: GeoJSON.Position,
  [cx, cy]: GeoJSON.Position,
  [dx, dy]: GeoJSON.Position
): GeoJSON.Position {
  const a1 = by - ay;
  const b1 = ax - bx;
  const c1 = a1 * ax + b1 * ay;
  const a2 = dy - cy;
  const b2 = cx - dx;
  const c2 = a2 * cx + b2 * cy;
  const determinant = a1 * b2 - a2 * b1;
  if (determinant === 0) return [ax, ay];
  return [(b2 * c1 - b1 * c2) / determinant, (a1 * c2 - a2 * c1) / determinant];
}

function clipConvexPolygon(subject: GeoJSON.Position[], clip: Ring): GeoJSON.Position[] {
  let output = subject;
  const clipEdges = ringVertices(clip);

  for (let i = 0; i < clipEdges.length; i++) {
    const clipStart = clipEdges[i];
    const clipEnd = clipEdges[(i + 1) % clipEdges.length];
    const input = output;
    output = [];
    if (input.length === 0) break;

    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const previous = input[(j + input.length - 1) % input.length];
      const currentInside = orientation(clipStart, clipEnd, current) <= 0;
      const previousInside = orientation(clipStart, clipEnd, previous) <= 0;

      if (currentInside) {
        if (!previousInside) {
          output.push(lineIntersection(previous, current, clipStart, clipEnd));
        }
        output.push(current);
      } else if (previousInside) {
        output.push(lineIntersection(previous, current, clipStart, clipEnd));
      }
    }
  }

  return output;
}

function overlapAreaRatio(a: GeoJSON.MultiPolygon, b: GeoJSON.MultiPolygon): number {
  const areaA = polygonArea(a);
  const areaB = polygonArea(b);
  const smaller = Math.min(areaA, areaB);
  if (smaller === 0) return 0;

  let intersectionArea = 0;
  for (const polyA of a.coordinates) {
    for (const polyB of b.coordinates) {
      const outerA = ringVertices(polyA[0]);
      const outerB = polyB[0];
      const clipped = clipConvexPolygon(outerA, outerB);
      if (clipped.length >= 3) {
        intersectionArea += shoelaceArea([...clipped, clipped[0]]);
      }
    }
  }

  return intersectionArea / smaller;
}

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
    for (const slug of duplicates(slugs)) {
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
