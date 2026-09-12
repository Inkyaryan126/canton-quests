import type { GridTerritoryEdgeDefinition } from '../core/types';

// lib/grid/geo/geometry.ts (polygonsIntersect, computeBBox) does not exist in this tree yet,
// so the precise-geometry primitives this module needs are self-contained here rather than
// imported. Coordinates are GeoJSON order throughout: [longitude, latitude].
export interface AdjacencyInput {
  slug: string;
  geometry: GeoJSON.MultiPolygon;
}

type Point = [number, number];
type Ring = Point[];

const DEFAULT_TOLERANCE_METERS = 5;
const METERS_PER_DEGREE_LAT = 111_320;

function computeBBox(geometry: GeoJSON.MultiPolygon): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  return [minLng, minLat, maxLng, maxLat];
}

function bboxesWithinTolerance(
  a: [number, number, number, number],
  b: [number, number, number, number],
  toleranceMeters: number,
): boolean {
  const midLat = (a[1] + a[3] + b[1] + b[3]) / 4;
  const latToleranceDeg = toleranceMeters / METERS_PER_DEGREE_LAT;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.max(Math.cos((midLat * Math.PI) / 180), 0.01);
  const lngToleranceDeg = toleranceMeters / metersPerDegreeLng;

  return (
    a[0] - lngToleranceDeg <= b[2] &&
    b[0] - lngToleranceDeg <= a[2] &&
    a[1] - latToleranceDeg <= b[3] &&
    b[1] - latToleranceDeg <= a[3]
  );
}

function ringsOf(geometry: GeoJSON.MultiPolygon): Ring[] {
  const rings: Ring[] = [];
  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      rings.push(ring as Point[]);
    }
  }
  return rings;
}

function cross(origin: Point, a: Point, b: Point): number {
  return (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return (
    Math.min(a[0], b[0]) <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] &&
    p[1] <= Math.max(a[1], b[1])
  );
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;

  return false;
}

function pointInRing(point: Point, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInMultiPolygon(point: Point, geometry: GeoJSON.MultiPolygon): boolean {
  let inside = false;
  for (const ring of ringsOf(geometry)) {
    if (pointInRing(point, ring)) inside = !inside;
  }
  return inside;
}

/** True if the two polygons share any boundary point, cross, or one contains the other. */
function polygonsTouch(a: GeoJSON.MultiPolygon, b: GeoJSON.MultiPolygon): boolean {
  const ringsA = ringsOf(a);
  const ringsB = ringsOf(b);

  for (const ringA of ringsA) {
    for (let i = 0; i < ringA.length - 1; i++) {
      for (const ringB of ringsB) {
        for (let j = 0; j < ringB.length - 1; j++) {
          if (segmentsIntersect(ringA[i], ringA[i + 1], ringB[j], ringB[j + 1])) {
            return true;
          }
        }
      }
    }
  }

  for (const ring of ringsA) {
    if (ring.length > 0 && pointInMultiPolygon(ring[0], b)) return true;
  }
  for (const ring of ringsB) {
    if (ring.length > 0 && pointInMultiPolygon(ring[0], a)) return true;
  }

  return false;
}

/**
 * Bbox-prefiltered adjacency: cheap O(n^2) bbox comparisons narrow the field to
 * candidate pairs, and only those candidates pay for the precise polygon check --
 * turning an O(n^2) precise-geometry comparison into O(n^2) cheap ones plus O(k) precise ones.
 */
export function computeAdjacency(
  territories: AdjacencyInput[],
  toleranceMeters: number = DEFAULT_TOLERANCE_METERS,
): GridTerritoryEdgeDefinition[] {
  const bboxes = territories.map((territory) => computeBBox(territory.geometry));
  const edges: GridTerritoryEdgeDefinition[] = [];

  for (let i = 0; i < territories.length; i++) {
    for (let j = i + 1; j < territories.length; j++) {
      if (!bboxesWithinTolerance(bboxes[i], bboxes[j], toleranceMeters)) continue;
      if (polygonsTouch(territories[i].geometry, territories[j].geometry)) {
        const [a, b] = [territories[i].slug, territories[j].slug].sort();
        edges.push({ a, b });
      }
    }
  }

  return edges;
}
