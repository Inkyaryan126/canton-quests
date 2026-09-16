import { roadDistancesFromNodeIndexed } from './routing';
import type {
  GridRoadAccessCandidate,
  GridRoadAccessIndex,
  GridRoadAccessRankingOptions,
  GridRoadAccessTargetKind,
  GridRoadRoutingIndex,
} from './types';

function normalizeLimit(limit: number | undefined): number | undefined {
  if (limit === undefined) return undefined;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error('road access ranking limit must be an integer >= 0');
  }
  return limit;
}

function maxDistanceMillimeters(maxDistanceMeters: number | undefined): number | undefined {
  if (maxDistanceMeters === undefined) return undefined;
  if (!Number.isFinite(maxDistanceMeters) || maxDistanceMeters < 0) {
    throw new Error('road access ranking max distance must be finite and >= 0');
  }
  return Math.round(maxDistanceMeters * 1000);
}

function allowedKinds(kinds: GridRoadAccessTargetKind[] | undefined): Set<GridRoadAccessTargetKind> | null {
  return kinds ? new Set(kinds) : null;
}
export function rankReachableRoadAccessTargets(
  accessIndex: GridRoadAccessIndex,
  routingIndex: GridRoadRoutingIndex,
  fromNodeId: string,
  options: GridRoadAccessRankingOptions = {},
): GridRoadAccessCandidate[] {
  const limit = normalizeLimit(options.limit);
  if (limit === 0) return [];
  const maxDistance = maxDistanceMillimeters(options.maxDistanceMeters);
  const kinds = allowedKinds(options.kinds);
  const excluded = new Set(options.excludeTargetIds ?? []);
  const resolved = accessIndex.records.filter((record) => record.snap);
  const nodeIds = resolved.map((record) => record.snap!.nodeId);
  const distances = roadDistancesFromNodeIndexed(routingIndex, fromNodeId, nodeIds);

  const candidates = resolved
    .filter((record) => !excluded.has(record.targetId))
    .filter((record) => !kinds || kinds.has(record.kind))
    .map((record): GridRoadAccessCandidate | null => {
      const snap = record.snap!;
      const distanceMillimeters = distances[snap.nodeId];
      if (distanceMillimeters === null || distanceMillimeters === undefined) return null;
      if (maxDistance !== undefined && distanceMillimeters > maxDistance) return null;
      return {
        targetId: record.targetId,
        kind: record.kind,
        snapNodeId: snap.nodeId,
        distanceMillimeters,
      };
    })
    .filter((candidate): candidate is GridRoadAccessCandidate => candidate !== null);
  candidates.sort((a, b) => {
    const distanceDelta = a.distanceMillimeters - b.distanceMillimeters;
    return distanceDelta !== 0 ? distanceDelta : a.targetId.localeCompare(b.targetId);
  });
  return limit === undefined ? candidates : candidates.slice(0, limit);
}

export function rankReachableRoadAccessTargetsFromTarget(
  accessIndex: GridRoadAccessIndex,
  routingIndex: GridRoadRoutingIndex,
  fromTargetId: string,
  options: GridRoadAccessRankingOptions = {},
): GridRoadAccessCandidate[] {
  const source = accessIndex.records.find((record) => record.targetId === fromTargetId);
  if (!source?.snap) return [];
  const excludeTargetIds = [
    fromTargetId,
    ...(options.excludeTargetIds ?? []),
  ];
  return rankReachableRoadAccessTargets(
    accessIndex,
    routingIndex,
    source.snap.nodeId,
    { ...options, excludeTargetIds },
  );
}
