import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import type {
  GridRoadGraph,
  GridRoadPoint,
  GridRoadTerritoryDefinition,
  GridRoadTerritoryIndex,
} from './types';

interface PreparedTerritory extends GridRoadTerritoryDefinition {
  bbox: [number, number, number, number];
}

function territoryBBox(geometry: GeoJSON.MultiPolygon): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

function matchingTerritories(point: GridRoadPoint, territories: PreparedTerritory[]): string[] {
  return territories
    .filter((territory) => {
      const [minLng, minLat, maxLng, maxLat] = territory.bbox;
      if (point.lng < minLng || point.lng > maxLng || point.lat < minLat || point.lat > maxLat) return false;
      return booleanPointInPolygon([point.lng, point.lat], territory.geometry);
    })
    .map((territory) => territory.slug)
    .sort();
}

function emptyLists(slugs: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const slug of slugs) result[slug] = [];
  return result;
}

export function buildRoadTerritoryIndex(
  graph: GridRoadGraph,
  definitions: GridRoadTerritoryDefinition[],
): GridRoadTerritoryIndex {
  const territories: PreparedTerritory[] = definitions
    .map((territory) => ({ ...territory, bbox: territoryBBox(territory.geometry) }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const slugs = territories.map((territory) => territory.slug);
  if (new Set(slugs).size !== slugs.length) throw new Error('road territory definitions require unique slugs');
  const nodeTerritories: Record<string, string[]> = {};
  const edgeTerritories: Record<string, string[]> = {};
  const territoryNodeIds = emptyLists(slugs);
  const territoryEdgeIds = emptyLists(slugs);
  const unassignedNodeIds: string[] = [];
  const unassignedEdgeIds: string[] = [];
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  for (const node of graph.nodes) {
    const matches = matchingTerritories(node, territories);
    nodeTerritories[node.id] = matches;
    if (matches.length === 0) unassignedNodeIds.push(node.id);
    for (const slug of matches) territoryNodeIds[slug].push(node.id);
  }

  for (const edge of graph.edges) {
    const from = nodeById.get(edge.fromNodeId);
    const to = nodeById.get(edge.toNodeId);
    if (!from || !to) throw new Error(`road territory indexing found missing edge endpoint: ${edge.id}`);
    const midpoint = { lng: (from.lng + to.lng) / 2, lat: (from.lat + to.lat) / 2 };
    const matches = matchingTerritories(midpoint, territories);
    edgeTerritories[edge.id] = matches;
    if (matches.length === 0) unassignedEdgeIds.push(edge.id);
    for (const slug of matches) territoryEdgeIds[slug].push(edge.id);
  }
  for (const slug of slugs) {
    territoryNodeIds[slug].sort();
    territoryEdgeIds[slug].sort();
  }
  unassignedNodeIds.sort();
  unassignedEdgeIds.sort();

  return {
    nodeTerritories,
    edgeTerritories,
    territoryNodeIds,
    territoryEdgeIds,
    unassignedNodeIds,
    unassignedEdgeIds,
  };
}
