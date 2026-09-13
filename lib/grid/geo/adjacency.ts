import type { GridTerritoryEdgeDefinition } from '../core/types';
import { computeBBox, polygonsIntersect } from './geometry';

export interface AdjacencyInput {
  slug: string;
  geometry: GeoJSON.MultiPolygon;
}

const DEFAULT_TOLERANCE_METERS = 5;
const METERS_PER_DEGREE_LAT = 111_320;

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

/**
 * Bbox-prefiltered adjacency: cheap bbox comparisons narrow the field to
 * candidate pairs, and only those candidates pay for the precise polygon
 * check (reused from ./geometry, not reimplemented here) -- turning an
 * O(n^2) precise-geometry comparison into O(n^2) cheap ones plus O(k)
 * precise ones, where k is the number of bbox-adjacent pairs.
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
      if (polygonsIntersect(territories[i].geometry, territories[j].geometry)) {
        const [a, b] = [territories[i].slug, territories[j].slug].sort();
        edges.push({ a, b });
      }
    }
  }

  return edges;
}
