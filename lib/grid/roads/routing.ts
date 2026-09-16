import { findNearestRoadNode } from './spatial';
import type {
  GridRoadGraph,
  GridRoadGraphEdge,
  GridRoadPoint,
  GridRoadRoute,
  GridRoadRoutingIndex,
  GridRoadSnappedRoute,
  GridRoadSpatialIndex,
} from './types';

interface QueueEntry {
  nodeId: string;
  distance: number;
}

class MinQueue {
  private readonly items: QueueEntry[] = [];

  push(entry: QueueEntry): void {
    this.items.push(entry);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!this.less(index, parent)) break;
      [this.items[index], this.items[parent]] = [this.items[parent], this.items[index]];
      index = parent;
    }
  }

  pop(): QueueEntry | undefined {
    if (this.items.length === 0) return undefined;
    const first = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.sink(0);
    }
    return first;
  }
  private less(a: number, b: number): boolean {
    const left = this.items[a];
    const right = this.items[b];
    return left.distance < right.distance ||
      (left.distance === right.distance && left.nodeId.localeCompare(right.nodeId) < 0);
  }

  private sink(start: number): void {
    let index = start;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.items.length && this.less(left, smallest)) smallest = left;
      if (right < this.items.length && this.less(right, smallest)) smallest = right;
      if (smallest === index) return;
      [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
      index = smallest;
    }
  }
}

function buildAdjacency(graph: GridRoadGraph): Map<string, GridRoadGraphEdge[]> {
  const adjacency = new Map<string, GridRoadGraphEdge[]>();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const edge of graph.edges) {
    adjacency.get(edge.fromNodeId)?.push(edge);
    adjacency.get(edge.toNodeId)?.push(edge);
  }
  for (const edges of adjacency.values()) edges.sort((a, b) => a.id.localeCompare(b.id));
  return adjacency;
}
export function shortestRoadRoute(
  graph: GridRoadGraph,
  fromNodeId: string,
  toNodeId: string,
): GridRoadRoute | null {
  if (fromNodeId === toNodeId) {
    const exists = graph.nodes.some((node) => node.id === fromNodeId);
    return exists ? { fromNodeId, toNodeId, nodeIds: [fromNodeId], edgeIds: [], totalLengthMillimeters: 0 } : null;
  }

  const adjacency = buildAdjacency(graph);
  if (!adjacency.has(fromNodeId) || !adjacency.has(toNodeId)) return null;

  const distance = new Map<string, number>([[fromNodeId, 0]]);
  const previous = new Map<string, { nodeId: string; edgeId: string }>();
  const queue = new MinQueue();
  queue.push({ nodeId: fromNodeId, distance: 0 });

  while (true) {
    const current = queue.pop();
    if (!current) break;
    if (current.distance !== distance.get(current.nodeId)) continue;
    if (current.nodeId === toNodeId) break;

    for (const edge of adjacency.get(current.nodeId) ?? []) {
      const next = edge.fromNodeId === current.nodeId ? edge.toNodeId : edge.fromNodeId;
      const candidate = current.distance + edge.lengthMillimeters;
      const known = distance.get(next);
      const prior = previous.get(next);
      const betterTie = known === candidate && prior && edge.id.localeCompare(prior.edgeId) < 0;
      if (known !== undefined && candidate > known) continue;
      if (known === candidate && !betterTie) continue;
      distance.set(next, candidate);
      previous.set(next, { nodeId: current.nodeId, edgeId: edge.id });
      queue.push({ nodeId: next, distance: candidate });
    }
  }
  const totalLengthMillimeters = distance.get(toNodeId);
  if (totalLengthMillimeters === undefined) return null;

  const nodeIds = [toNodeId];
  const edgeIds: string[] = [];
  let cursor = toNodeId;
  while (cursor !== fromNodeId) {
    const step = previous.get(cursor);
    if (!step) return null;
    edgeIds.push(step.edgeId);
    cursor = step.nodeId;
    nodeIds.push(cursor);
  }

  nodeIds.reverse();
  edgeIds.reverse();
  return { fromNodeId, toNodeId, nodeIds, edgeIds, totalLengthMillimeters };
}

export function shortestRoadRouteBetweenPoints(
  graph: GridRoadGraph,
  index: GridRoadSpatialIndex,
  fromPoint: GridRoadPoint,
  toPoint: GridRoadPoint,
  maxSnapDistanceMeters: number,
): GridRoadSnappedRoute | null {
  const fromSnap = findNearestRoadNode(graph, index, fromPoint, maxSnapDistanceMeters);
  if (!fromSnap) return null;
  const toSnap = findNearestRoadNode(graph, index, toPoint, maxSnapDistanceMeters);
  if (!toSnap) return null;
  const route = shortestRoadRoute(graph, fromSnap.nodeId, toSnap.nodeId);
  if (!route) return null;
  return { fromSnap, toSnap, route };
}

export function buildRoadRoutingIndex(graph: GridRoadGraph): GridRoadRoutingIndex {
  const adjacency: GridRoadRoutingIndex['adjacency'] = {};
  const componentByNode: GridRoadRoutingIndex['componentByNode'] = {};
  for (const node of graph.nodes) adjacency[node.id] = [];

  for (const edge of graph.edges) {
    adjacency[edge.fromNodeId]?.push({
      edgeId: edge.id,
      toNodeId: edge.toNodeId,
      lengthMillimeters: edge.lengthMillimeters,
    });
    adjacency[edge.toNodeId]?.push({
      edgeId: edge.id,
      toNodeId: edge.fromNodeId,
      lengthMillimeters: edge.lengthMillimeters,
    });
  }

  for (const nodeId of Object.keys(adjacency)) {
    adjacency[nodeId].sort((a, b) => {
      const nodeDelta = a.toNodeId.localeCompare(b.toNodeId);
      return nodeDelta !== 0 ? nodeDelta : a.edgeId.localeCompare(b.edgeId);
    });
  }
  for (const component of graph.components) {
    for (const nodeId of component.nodeIds) componentByNode[nodeId] = component.id;
  }

  return { adjacency, componentByNode };
}

export function shortestRoadRouteIndexed(
  graph: GridRoadGraph,
  index: GridRoadRoutingIndex,
  fromNodeId: string,
  toNodeId: string,
): GridRoadRoute | null {
  if (fromNodeId === toNodeId) {
    return index.adjacency[fromNodeId]
      ? { fromNodeId, toNodeId, nodeIds: [fromNodeId], edgeIds: [], totalLengthMillimeters: 0 }
      : null;
  }
  if (!index.adjacency[fromNodeId] || !index.adjacency[toNodeId]) return null;
  if (index.componentByNode[fromNodeId] !== index.componentByNode[toNodeId]) return null;

  const distance = new Map<string, number>([[fromNodeId, 0]]);
  const previous = new Map<string, { nodeId: string; edgeId: string }>();
  const queue = new MinQueue();
  queue.push({ nodeId: fromNodeId, distance: 0 });
  while (true) {
    const current = queue.pop();
    if (!current) break;
    if (current.distance !== distance.get(current.nodeId)) continue;
    if (current.nodeId === toNodeId) break;

    for (const arc of index.adjacency[current.nodeId] ?? []) {
      const candidate = current.distance + arc.lengthMillimeters;
      const known = distance.get(arc.toNodeId);
      const prior = previous.get(arc.toNodeId);
      const betterTie =
        known === candidate && prior && arc.edgeId.localeCompare(prior.edgeId) < 0;
      if (known !== undefined && candidate > known) continue;
      if (known === candidate && !betterTie) continue;
      distance.set(arc.toNodeId, candidate);
      previous.set(arc.toNodeId, { nodeId: current.nodeId, edgeId: arc.edgeId });
      queue.push({ nodeId: arc.toNodeId, distance: candidate });
    }
  }

  const totalLengthMillimeters = distance.get(toNodeId);
  if (totalLengthMillimeters === undefined) return null;
  const nodeIds = [toNodeId];
  const edgeIds: string[] = [];
  let cursor = toNodeId;
  while (cursor !== fromNodeId) {
    const step = previous.get(cursor);
    if (!step) return null;
    edgeIds.push(step.edgeId);
    cursor = step.nodeId;
    nodeIds.push(cursor);
  }
  nodeIds.reverse();
  edgeIds.reverse();
  return { fromNodeId, toNodeId, nodeIds, edgeIds, totalLengthMillimeters };
}
