// Coordinate order: every GeoJSON structure in this module (and everywhere
// else in lib/grid/geo and lib/grid/compiler) uses the GeoJSON-standard
// [longitude, latitude] order. `GridLatLng` ({ lat, lng }) is only used for
// point-like fields at the package boundary (map centers, landmark points);
// convert between the two forms with `toLngLatTuple`/`fromLngLatTuple` below
// rather than ad hoc `[x.lng, x.lat]` literals scattered across files.
import type { GridLatLng } from '../core/types';
import { feature, featureCollection } from '@turf/helpers';
import booleanValid from '@turf/boolean-valid';
import centroid from '@turf/centroid';
import bbox from '@turf/bbox';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import booleanIntersects from '@turf/boolean-intersects';
import area from '@turf/area';
import intersect from '@turf/intersect';

// Relative tolerance for the floating-point area comparison in
// isWithinBounds -- geodesic area calculations accumulate rounding noise
// well below this threshold for real-world polygon sizes.
const CONTAINMENT_AREA_TOLERANCE = 1e-6;

export function toLngLatTuple(point: GridLatLng): [number, number] {
  return [point.lng, point.lat];
}

export function fromLngLatTuple(tuple: readonly [number, number]): GridLatLng {
  const [lng, lat] = tuple;
  return { lat, lng };
}

/**
 * Backed by @turf/boolean-valid. Returns a plain boolean and never mutates
 * or repairs the input -- an invalid geometry must be reported and excluded
 * by the caller (see normalize.ts), never patched.
 */
export function isValidPolygonGeometry(
  geom: GeoJSON.MultiPolygon | GeoJSON.Polygon
): boolean {
  try {
    return booleanValid(geom);
  } catch {
    return false;
  }
}

export function computeCentroid(geom: GeoJSON.MultiPolygon): GridLatLng {
  const result = centroid(geom);
  return fromLngLatTuple(result.geometry.coordinates as [number, number]);
}

export function computeBBox(
  geom: GeoJSON.MultiPolygon
): [number, number, number, number] {
  const [minX, minY, maxX, maxY] = bbox(geom);
  return [minX, minY, maxX, maxY];
}

function intersectionArea(a: GeoJSON.MultiPolygon, b: GeoJSON.MultiPolygon): number {
  const clipped = intersect(featureCollection([feature(a), feature(b)]));
  return clipped ? area(clipped) : 0;
}

/**
 * True iff `geom` lies entirely within `bounds`. Uses an area-based
 * containment check (intersection area vs. geom's own area) rather than a
 * vertex-only check, so a geometry whose boundary crosses `bounds` without
 * any vertex falling inside it is still correctly rejected.
 */
export function isWithinBounds(
  geom: GeoJSON.MultiPolygon,
  bounds: GeoJSON.MultiPolygon
): boolean {
  const geomArea = area(geom);
  if (geomArea === 0) {
    return geom.coordinates.every((polygon) =>
      polygon.every((ring) =>
        ring.every((position) => booleanPointInPolygon(position, bounds))
      )
    );
  }
  const overlap = intersectionArea(geom, bounds);
  return overlap >= geomArea * (1 - CONTAINMENT_AREA_TOLERANCE);
}

/** True iff `a` and `b` share any point, including a touching boundary. */
export function polygonsIntersect(
  a: GeoJSON.MultiPolygon,
  b: GeoJSON.MultiPolygon
): boolean {
  return booleanIntersects(a, b);
}

/** Overlap area as a fraction (0..1) of the smaller polygon's own area. */
export function overlapAreaRatio(
  a: GeoJSON.MultiPolygon,
  b: GeoJSON.MultiPolygon
): number {
  const smaller = Math.min(area(a), area(b));
  if (smaller === 0) return 0;
  return intersectionArea(a, b) / smaller;
}
