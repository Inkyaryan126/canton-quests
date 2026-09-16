import { buildRoadRouteContext } from './route-context';
import { shortestRoadRoute } from './routing';
import type {
  GridRoadAccessIndex,
  GridRoadAccessJourney,
  GridRoadGraph,
  GridRoadTerritoryIndex,
} from './types';

export function buildRoadAccessJourney(
  graph: GridRoadGraph,
  accessIndex: GridRoadAccessIndex,
  fromTargetId: string,
  toTargetId: string,
  territoryIndex?: GridRoadTerritoryIndex,
): GridRoadAccessJourney | null {
  const byTarget = new Map(accessIndex.records.map((record) => [record.targetId, record]));
  const from = byTarget.get(fromTargetId);
  const to = byTarget.get(toTargetId);
  if (!from || !to || !from.snap || !to.snap) return null;

  const route = shortestRoadRoute(graph, from.snap.nodeId, to.snap.nodeId);
  if (!route) return null;
  return {
    fromTargetId,
    toTargetId,
    fromSnap: from.snap,
    toSnap: to.snap,
    route,
    context: buildRoadRouteContext(graph, route, territoryIndex),
  };
}
