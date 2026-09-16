import type {
  GridRoadGraph,
  GridRoadPoint,
  GridRoadSnap,
  GridRoadSpatialIndex,
} from './types';

const EARTH_RADIUS_METERS = 6_371_008.8;

function cellCoordinate(value: number, cellSizeDegrees: number): number {
  return Math.floor(value / cellSizeDegrees);
}

function cellKey(lngCell: number, latCell: number): string {
  return `${lngCell}:${latCell}`;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMillimeters(a: GridRoadPoint, b: GridRoadPoint): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const meters = 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.round(meters * 1000);
}
export function buildRoadSpatialIndex(
  graph: GridRoadGraph,
  cellSizeDegrees: number,
): GridRoadSpatialIndex {
  if (!Number.isFinite(cellSizeDegrees) || cellSizeDegrees <= 0 || cellSizeDegrees > 180) {
    throw new Error('road spatial index cell size must be a finite degree value > 0 and <= 180');
  }

  const cellMap = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const key = cellKey(
      cellCoordinate(node.lng, cellSizeDegrees),
      cellCoordinate(node.lat, cellSizeDegrees),
    );
    const list = cellMap.get(key) ?? [];
    list.push(node.id);
    cellMap.set(key, list);
  }

  const cells: Record<string, string[]> = {};
  for (const key of [...cellMap.keys()].sort()) {
    cells[key] = cellMap.get(key)!.slice().sort();
  }
  return { cellSizeDegrees, cells };
}
export function findNearestRoadNode(
  graph: GridRoadGraph,
  index: GridRoadSpatialIndex,
  point: GridRoadPoint,
  maxDistanceMeters: number,
): GridRoadSnap | null {
  if (!Number.isFinite(point.lng) || !Number.isFinite(point.lat)) {
    throw new Error('road snap point must contain finite longitude/latitude');
  }
  if (!Number.isFinite(maxDistanceMeters) || maxDistanceMeters < 0) {
    throw new Error('road snap max distance must be a finite value >= 0');
  }

  const latDelta = maxDistanceMeters / 111_320;
  const cosLat = Math.max(0.000001, Math.abs(Math.cos(toRadians(point.lat))));
  const lngDelta = maxDistanceMeters / (111_320 * cosLat);
  const minLngCell = cellCoordinate(point.lng - lngDelta, index.cellSizeDegrees);
  const maxLngCell = cellCoordinate(point.lng + lngDelta, index.cellSizeDegrees);
  const minLatCell = cellCoordinate(point.lat - latDelta, index.cellSizeDegrees);
  const maxLatCell = cellCoordinate(point.lat + latDelta, index.cellSizeDegrees);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const maxDistanceMillimeters = Math.round(maxDistanceMeters * 1000);
  let best: GridRoadSnap | null = null;

  for (let lngCell = minLngCell; lngCell <= maxLngCell; lngCell += 1) {
    for (let latCell = minLatCell; latCell <= maxLatCell; latCell += 1) {
      for (const nodeId of index.cells[cellKey(lngCell, latCell)] ?? []) {
        const node = nodeById.get(nodeId);
        if (!node) continue;
        const candidateDistance = distanceMillimeters(point, node);
        if (candidateDistance > maxDistanceMillimeters) continue;
        if (!best || candidateDistance < best.distanceMillimeters ||
          (candidateDistance === best.distanceMillimeters && node.id.localeCompare(best.nodeId) < 0)) {
          best = { nodeId: node.id, lng: node.lng, lat: node.lat, distanceMillimeters: candidateDistance };
        }
      }
    }
  }

  return best;
}
