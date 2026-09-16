import type {
  GridRoadGraph,
  GridRoadGraphComponent,
  GridRoadGraphEdge,
  GridRoadNode,
  GridRoadSegment,
} from './types';

const EARTH_RADIUS_METERS = 6_371_008.8;
const DEFAULT_COORDINATE_PRECISION = 7;

function roundCoordinate(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function coordinateText(value: number, precision: number): string {
  return roundCoordinate(value, precision).toFixed(precision);
}

export function roadNodeId(
  position: GeoJSON.Position,
  precision = DEFAULT_COORDINATE_PRECISION,
): string {
  const [lng, lat] = position;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error('road graph position must contain finite longitude/latitude');
  }
  return `road-node:${coordinateText(lng, precision)}:${coordinateText(lat, precision)}`;
}
function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function edgeLengthMillimeters(a: GridRoadNode, b: GridRoadNode): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const haversine = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const meters = 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
  return Math.max(1, Math.round(meters * 1000));
}

function nodeFromPosition(position: GeoJSON.Position, precision: number): GridRoadNode {
  return {
    id: roadNodeId(position, precision),
    lng: roundCoordinate(position[0], precision),
    lat: roundCoordinate(position[1], precision),
  };
}

function componentId(nodeIds: string[]): string {
  return `road-component:${nodeIds[0]}`;
}
function buildComponents(nodes: GridRoadNode[], edges: GridRoadGraphEdge[]): GridRoadGraphComponent[] {
  const neighbors = new Map<string, string[]>();
  const edgeIdsByNode = new Map<string, string[]>();
  for (const node of nodes) {
    neighbors.set(node.id, []);
    edgeIdsByNode.set(node.id, []);
  }

  for (const edge of edges) {
    neighbors.get(edge.fromNodeId)!.push(edge.toNodeId);
    neighbors.get(edge.toNodeId)!.push(edge.fromNodeId);
    edgeIdsByNode.get(edge.fromNodeId)!.push(edge.id);
    edgeIdsByNode.get(edge.toNodeId)!.push(edge.id);
  }
  for (const list of neighbors.values()) list.sort();
  for (const list of edgeIdsByNode.values()) list.sort();

  const visited = new Set<string>();
  const components: GridRoadGraphComponent[] = [];
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const queue = [node.id];
    const nodeIds: string[] = [];
    const edgeIds = new Set<string>();
    visited.add(node.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      nodeIds.push(current);
      for (const edgeId of edgeIdsByNode.get(current) ?? []) edgeIds.add(edgeId);
      for (const next of neighbors.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    nodeIds.sort();
    components.push({ id: componentId(nodeIds), nodeIds, edgeIds: [...edgeIds].sort() });
  }

  return components.sort((a, b) => {
    const sizeDelta = b.nodeIds.length - a.nodeIds.length;
    return sizeDelta !== 0 ? sizeDelta : a.id.localeCompare(b.id);
  });
}
export function buildRoadGraph(
  segments: GridRoadSegment[],
  coordinatePrecision = DEFAULT_COORDINATE_PRECISION,
): GridRoadGraph {
  if (!Number.isInteger(coordinatePrecision) || coordinatePrecision < 0 || coordinatePrecision > 12) {
    throw new Error('road graph coordinate precision must be an integer from 0 to 12');
  }

  const nodesById = new Map<string, GridRoadNode>();
  const edges: GridRoadGraphEdge[] = [];

  for (const segment of segments) {
    for (let index = 0; index < segment.coordinates.length - 1; index += 1) {
      const from = nodeFromPosition(segment.coordinates[index], coordinatePrecision);
      const to = nodeFromPosition(segment.coordinates[index + 1], coordinatePrecision);
      if (from.id === to.id) continue;
      nodesById.set(from.id, from);
      nodesById.set(to.id, to);
      edges.push({
        id: `road-edge:${segment.id}:${index}`,
        fromNodeId: from.id,
        toNodeId: to.id,
        roadClass: segment.roadClass,
        sourceSegmentId: segment.id,
        sourceVertexIndex: index,
        name: segment.name,
        mtfcc: segment.mtfcc,
        routeType: segment.routeType,
        lengthMillimeters: edgeLengthMillimeters(from, to),
      });
    }
  }

  const nodes = [...nodesById.values()].sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => a.id.localeCompare(b.id));
  return {
    coordinatePrecision,
    nodes,
    edges,
    components: buildComponents(nodes, edges),
  };
}
