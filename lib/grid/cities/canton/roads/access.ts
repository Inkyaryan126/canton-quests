import { cantonRawGeography } from '../geography/raw-geography';
import { buildRoadAccessIndex } from '../../../roads/access';
import type {
  GridRoadAccessIndex,
  GridRoadAccessTarget,
  GridRoadGraph,
  GridRoadSpatialIndex,
} from '../../../roads/types';

export function cantonRoadAccessTargets(): GridRoadAccessTarget[] {
  return [
    ...cantonRawGeography.properties.map((property) => ({
      id: `property:${property.slug}`,
      kind: 'property' as const,
      point: { ...property.point! },
    })),
    ...cantonRawGeography.landmarks.map((landmark) => ({
      id: `landmark:${landmark.slug}`,
      kind: 'landmark' as const,
      point: { ...landmark.point },
    })),
  ].sort((a, b) => a.id.localeCompare(b.id));
}

export function buildCantonRoadAccessIndex(
  graph: GridRoadGraph,
  spatialIndex: GridRoadSpatialIndex,
  maxSnapDistanceMeters: number,
): GridRoadAccessIndex {
  return buildRoadAccessIndex(
    graph,
    spatialIndex,
    cantonRoadAccessTargets(),
    maxSnapDistanceMeters,
  );
}
