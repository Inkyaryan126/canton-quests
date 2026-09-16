import { cantonRawGeography } from '../geography/raw-geography';
import { buildRoadTerritoryIndex } from '../../../roads/territories';
import type { GridRoadGraph, GridRoadTerritoryIndex } from '../../../roads/types';

const cantonRoadTerritories = cantonRawGeography.territories.map((territory) => ({
  slug: territory.slug,
  geometry: territory.geometry,
}));

export function buildCantonRoadTerritoryIndex(graph: GridRoadGraph): GridRoadTerritoryIndex {
  return buildRoadTerritoryIndex(graph, cantonRoadTerritories);
}
