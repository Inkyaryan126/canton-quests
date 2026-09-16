import { findNearestRoadNode } from './spatial';
import type {
  GridRoadAccessIndex,
  GridRoadAccessTarget,
  GridRoadGraph,
  GridRoadSpatialIndex,
} from './types';

export function buildRoadAccessIndex(
  graph: GridRoadGraph,
  spatialIndex: GridRoadSpatialIndex,
  targets: GridRoadAccessTarget[],
  maxSnapDistanceMeters: number,
): GridRoadAccessIndex {
  if (!Number.isFinite(maxSnapDistanceMeters) || maxSnapDistanceMeters < 0) {
    throw new Error('road access max snap distance must be a finite value >= 0');
  }

  const ids = targets.map((target) => target.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('road access targets require unique ids');
  }

  const records = targets
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((target) => ({
      targetId: target.id,
      kind: target.kind,
      point: { ...target.point },
      snap: findNearestRoadNode(
        graph,
        spatialIndex,
        target.point,
        maxSnapDistanceMeters,
      ),
    }));
  const resolvedTargetIds = records
    .filter((record) => record.snap)
    .map((record) => record.targetId);
  const unresolvedTargetIds = records
    .filter((record) => !record.snap)
    .map((record) => record.targetId);

  return {
    maxSnapDistanceMeters,
    records,
    resolvedTargetIds,
    unresolvedTargetIds,
  };
}
