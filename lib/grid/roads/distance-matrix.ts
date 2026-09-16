import { roadDistancesFromNodeIndexed } from './routing';
import type {
  GridRoadAccessDistanceMatrix,
  GridRoadAccessIndex,
  GridRoadRoutingIndex,
} from './types';

export function buildRoadAccessDistanceMatrix(
  accessIndex: GridRoadAccessIndex,
  routingIndex: GridRoadRoutingIndex,
): GridRoadAccessDistanceMatrix {
  const records = accessIndex.records.slice().sort((a, b) => a.targetId.localeCompare(b.targetId));
  const targetIds = records.map((record) => record.targetId);
  const distancesMillimeters: Record<string, Record<string, number | null>> = {};
  const resolvedNodeIds = records
    .map((record) => record.snap?.nodeId)
    .filter((nodeId): nodeId is string => Boolean(nodeId));

  for (const from of records) {
    const row: Record<string, number | null> = {};
    distancesMillimeters[from.targetId] = row;
    if (!from.snap) {
      for (const to of records) row[to.targetId] = null;
      continue;
    }

    const nodeDistances = roadDistancesFromNodeIndexed(
      routingIndex,
      from.snap.nodeId,
      resolvedNodeIds,
    );
    for (const to of records) {
      row[to.targetId] = to.snap ? nodeDistances[to.snap.nodeId] ?? null : null;
    }
  }

  return { targetIds, distancesMillimeters };
}

export function roadAccessDistance(
  matrix: GridRoadAccessDistanceMatrix,
  fromTargetId: string,
  toTargetId: string,
): number | null {
  return matrix.distancesMillimeters[fromTargetId]?.[toTargetId] ?? null;
}
