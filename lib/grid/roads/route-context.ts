import type {
  GridRoadGraph,
  GridRoadRoute,
  GridRoadRouteContext,
  GridRoadTerritoryIndex,
} from './types';

function sameTerritories(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function buildRoadRouteContext(
  graph: GridRoadGraph,
  route: GridRoadRoute,
  territoryIndex?: GridRoadTerritoryIndex,
): GridRoadRouteContext {
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const roadSteps: GridRoadRouteContext['roadSteps'] = [];
  const territorySteps: GridRoadRouteContext['territorySteps'] = [];
  let unassignedEdgeCount = 0;

  route.edgeIds.forEach((edgeId, edgeIndex) => {
    const edge = edgeById.get(edgeId);
    if (!edge) throw new Error(`road route references missing edge: ${edgeId}`);

    const previousRoad = roadSteps.at(-1);
    if (!previousRoad || previousRoad.roadClass !== edge.roadClass || previousRoad.name !== edge.name) {
      roadSteps.push({ edgeIndex, roadClass: edge.roadClass, name: edge.name });
    }
    if (territoryIndex) {
      const territories = territoryIndex.edgeTerritories[edgeId] ?? [];
      if (territories.length === 0) unassignedEdgeCount += 1;
      const previousTerritory = territorySteps.at(-1);
      if (!previousTerritory || !sameTerritories(previousTerritory.territorySlugs, territories)) {
        territorySteps.push({ edgeIndex, territorySlugs: territories.slice() });
      }
    }
  });

  return { roadSteps, territorySteps, unassignedEdgeCount };
}
