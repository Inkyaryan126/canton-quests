import type {
  GridRoadCorridor,
  GridRoadCorridorIndex,
  GridRoadGraph,
  GridRoadGraphEdge,
} from './types';

function normalizedName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function groupKey(edge: GridRoadGraphEdge): string | null {
  if (!edge.name?.trim()) return null;
  return `${edge.roadClass}::${normalizedName(edge.name)}`;
}

function corridorId(
  edge: GridRoadGraphEdge,
  displayName: string,
  anchorNodeId: string,
): string {
  return `road-corridor:${edge.roadClass}:${encodeURIComponent(normalizedName(displayName))}:${anchorNodeId}`;
}

function connectedEdgeGroups(edges: GridRoadGraphEdge[]): GridRoadGraphEdge[][] {
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  const edgeIdsByNode = new Map<string, string[]>();
  for (const edge of edges) {
    for (const nodeId of [edge.fromNodeId, edge.toNodeId]) {
      const list = edgeIdsByNode.get(nodeId) ?? [];
      list.push(edge.id);
      edgeIdsByNode.set(nodeId, list);
    }
  }  for (const list of edgeIdsByNode.values()) list.sort();
  const unvisited = new Set(edges.map((edge) => edge.id));
  const groups: GridRoadGraphEdge[][] = [];

  for (const startId of [...unvisited].sort()) {
    if (!unvisited.has(startId)) continue;
    const queue = [startId];
    const group: GridRoadGraphEdge[] = [];
    unvisited.delete(startId);

    while (queue.length > 0) {
      const edgeId = queue.shift()!;
      const edge = edgeById.get(edgeId)!;
      group.push(edge);
      for (const nodeId of [edge.fromNodeId, edge.toNodeId]) {
        for (const neighborId of edgeIdsByNode.get(nodeId) ?? []) {
          if (!unvisited.has(neighborId)) continue;
          unvisited.delete(neighborId);
          queue.push(neighborId);
        }
      }
    }
    group.sort((a, b) => a.id.localeCompare(b.id));
    groups.push(group);
  }

  return groups;
}
export function buildRoadCorridorIndex(graph: GridRoadGraph): GridRoadCorridorIndex {
  const grouped = new Map<string, GridRoadGraphEdge[]>();
  for (const edge of graph.edges) {
    const key = groupKey(edge);
    if (!key) continue;
    const list = grouped.get(key) ?? [];
    list.push(edge);
    grouped.set(key, list);
  }

  const corridors: GridRoadCorridor[] = [];
  const corridorByEdge: Record<string, string> = {};

  for (const key of [...grouped.keys()].sort()) {
    const edges = grouped.get(key)!;
    for (const component of connectedEdgeGroups(edges)) {
      const nodeIds = [...new Set(
        component.flatMap((edge) => [edge.fromNodeId, edge.toNodeId]),
      )].sort();
      const names = component
        .map((edge) => edge.name?.trim())
        .filter((name): name is string => Boolean(name))
        .sort((a, b) => a.localeCompare(b));
      const displayName = names[0];
      const id = corridorId(component[0], displayName, nodeIds[0]);
      const corridor: GridRoadCorridor = {
        id,
        roadClass: component[0].roadClass,
        name: displayName,
        edgeIds: component.map((edge) => edge.id).sort(),
        nodeIds,
        totalLengthMillimeters: component.reduce(
          (total, edge) => total + edge.lengthMillimeters,
          0,
        ),
      };
      corridors.push(corridor);
      for (const edge of component) corridorByEdge[edge.id] = id;
    }
  }
  corridors.sort((a, b) => {
    const classDelta = a.roadClass.localeCompare(b.roadClass);
    if (classDelta !== 0) return classDelta;
    const nameDelta = a.name.localeCompare(b.name);
    return nameDelta !== 0 ? nameDelta : a.id.localeCompare(b.id);
  });
  return { corridors, corridorByEdge };
}
