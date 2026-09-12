// Canonical GeoJSON coordinate order throughout Canton Quests: [longitude, latitude].

import { area } from '@turf/area';
import { bbox } from '@turf/bbox';
import { booleanIntersects } from '@turf/boolean-intersects';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { booleanValid } from '@turf/boolean-valid';
import { centroid } from '@turf/centroid';
import { feature, featureCollection } from '@turf/helpers';
import { intersect } from '@turf/intersect';
import type { GridLatLng } from '../core/types';

/**
 * Converts a GridLatLng point ({lat, lng}) into a GeoJSON [longitude, latitude] coordinate tuple.
 */
export function toLngLatTuple(point: GridLatLng): [number, number] {
  return [point.lng, point.lat];
}

/**
 * Converts a GeoJSON [longitude, latitude] coordinate tuple into a GridLatLng point ({lat, lng}).
 */
export function fromLngLatTuple(coords: [number, number] | number[]): GridLatLng {
  return {
    lat: coords[1],
    lng: coords[0],
  };
}

/**
 * Checks if two line segments (a1-a2 and b1-b2) intersect.
 */
function segmentsIntersect(
  a1: [number, number],
  a2: [number, number],
  b1: [number, number],
  b2: [number, number],
): boolean {
  function ccw(p1: [number, number], p2: [number, number], p3: [number, number]): number {
    return (p3[1] - p1[1]) * (p2[0] - p1[0]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
  }

  const d1 = ccw(a1, a2, b1);
  const d2 = ccw(a1, a2, b2);
  const d3 = ccw(b1, b2, a1);
  const d4 = ccw(b1, b2, a2);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }

  function onSegment(p: [number, number], q: [number, number], r: [number, number]): boolean {
    return (
      q[0] <= Math.max(p[0], r[0]) &&
      q[0] >= Math.min(p[0], r[0]) &&
      q[1] <= Math.max(p[1], r[1]) &&
      q[1] >= Math.min(p[1], r[1])
    );
  }

  if (Math.abs(d1) < 1e-12 && onSegment(a1, b1, a2)) return true;
  if (Math.abs(d2) < 1e-12 && onSegment(a1, b2, a2)) return true;
  if (Math.abs(d3) < 1e-12 && onSegment(b1, a1, b2)) return true;
  if (Math.abs(d4) < 1e-12 && onSegment(b1, a2, b2)) return true;

  return false;
}

/**
 * Checks if a linear ring self-intersects (e.g. bowtie or figure-8).
 */
function ringHasSelfIntersection(ring: number[][]): boolean {
  const n = ring.length - 1; // Last point must equal first
  if (n < 3) return true;

  for (let i = 0; i < n; i++) {
    const a1 = ring[i] as [number, number];
    const a2 = ring[i + 1] as [number, number];

    for (let j = i + 1; j < n; j++) {
      // Consecutive segments naturally share a vertex; first and last also share vertex
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) {
        continue;
      }
      const b1 = ring[j] as [number, number];
      const b2 = ring[j + 1] as [number, number];

      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validates whether a GeoJSON Polygon or MultiPolygon geometry is structurally sound and topologically valid.
 *
 * Checks:
 * - Valid type ('Polygon' or 'MultiPolygon')
 * - Non-empty coordinate hierarchy
 * - All rings have >= 4 coordinates and are closed (first == last)
 * - All coordinates are finite numbers
 * - Rings do not self-intersect (e.g. bowties)
 * - Conforms to OGC / GeoJSON validity via @turf/boolean-valid
 *
 * Never silently repairs invalid geometry; returns false instead.
 */
export function isValidPolygonGeometry(geom: GeoJSON.MultiPolygon | GeoJSON.Polygon): boolean {
  if (!geom || typeof geom !== 'object') {
    return false;
  }

  if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') {
    return false;
  }

  if (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0) {
    return false;
  }

  const polygonRingsList: number[][][][] =
    geom.type === 'Polygon'
      ? [geom.coordinates as number[][][]]
      : (geom.coordinates as number[][][][]);

  for (const polygonRings of polygonRingsList) {
    if (!Array.isArray(polygonRings) || polygonRings.length === 0) {
      return false;
    }

    for (const ring of polygonRings) {
      if (!Array.isArray(ring) || ring.length < 4) {
        return false;
      }

      // Check closed ring
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (
        !Array.isArray(first) ||
        !Array.isArray(last) ||
        first.length < 2 ||
        last.length < 2 ||
        first[0] !== last[0] ||
        first[1] !== last[1]
      ) {
        return false;
      }

      // Check all coordinates are finite numbers
      for (const pt of ring) {
        if (
          !Array.isArray(pt) ||
          pt.length < 2 ||
          typeof pt[0] !== 'number' ||
          typeof pt[1] !== 'number' ||
          !Number.isFinite(pt[0]) ||
          !Number.isFinite(pt[1])
        ) {
          return false;
        }
      }

      // Check for self-intersections (e.g. bowtie)
      if (ringHasSelfIntersection(ring)) {
        return false;
      }
    }
  }

  try {
    return booleanValid(geom);
  } catch {
    return false;
  }
}

/**
 * Computes the centroid point ({lat, lng}) of a MultiPolygon geometry.
 * Returns coordinates as GridLatLng.
 */
export function computeCentroid(geom: GeoJSON.MultiPolygon): GridLatLng {
  const c = centroid(geom);
  return fromLngLatTuple(c.geometry.coordinates);
}

/**
 * Computes the 2D bounding box of a MultiPolygon geometry in GeoJSON order:
 * [minLng, minLat, maxLng, maxLat].
 */
export function computeBBox(geom: GeoJSON.MultiPolygon): [number, number, number, number] {
  const b = bbox(geom);
  return [b[0], b[1], b[2], b[3]];
}

/**
 * Determines whether a MultiPolygon geometry is entirely contained within the given bounds MultiPolygon.
 *
 * Rules:
 * - All vertices of geom must lie inside or on the boundary of bounds.
 * - The intersection area must cover virtually the entire area of geom (>= 99.9%).
 */
export function isWithinBounds(geom: GeoJSON.MultiPolygon, bounds: GeoJSON.MultiPolygon): boolean {
  if (!geom?.coordinates?.length || !bounds?.coordinates?.length) {
    return false;
  }

  // All vertices of geom must fall within or on the edge of bounds
  for (const polygon of geom.coordinates) {
    for (const ring of polygon) {
      for (const coord of ring) {
        if (!booleanPointInPolygon(coord, bounds)) {
          return false;
        }
      }
    }
  }

  // Verify full area containment
  try {
    const inter = intersect(featureCollection([feature(geom), feature(bounds)]));
    if (!inter) return false;

    const geomArea = area(geom);
    if (geomArea <= 0) return false;

    const interArea = area(inter);
    return interArea / geomArea >= 0.999;
  } catch {
    // If intersection calculation encounters a topological singularity on valid geometries,
    // trust the vertex check result.
    return true;
  }
}

/**
 * Checks whether two MultiPolygon geometries intersect (including sharing an edge or point).
 */
export function polygonsIntersect(a: GeoJSON.MultiPolygon, b: GeoJSON.MultiPolygon): boolean {
  try {
    return booleanIntersects(a, b);
  } catch {
    return false;
  }
}

/**
 * Calculates the overlap area ratio between two MultiPolygon geometries as a fraction (0..1)
 * of the smaller polygon's area.
 *
 * Returns 0 if geometries are disjoint or touch only along an edge/point.
 */
export function overlapAreaRatio(a: GeoJSON.MultiPolygon, b: GeoJSON.MultiPolygon): number {
  try {
    const areaA = area(a);
    const areaB = area(b);
    const minArea = Math.min(areaA, areaB);

    if (minArea <= 0) {
      return 0;
    }

    const inter = intersect(featureCollection([feature(a), feature(b)]));
    if (!inter) {
      return 0;
    }

    const interArea = area(inter);
    return Math.max(0, Math.min(1, interArea / minArea));
  } catch {
    return 0;
  }
}
