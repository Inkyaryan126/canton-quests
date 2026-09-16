import { buildRoadGraph } from './graph';
import { normalizeRoadSourceFeatures } from './normalize';
import { buildRoadSpatialIndex } from './spatial';
import { buildRoadTerritoryIndex } from './territories';
import type {
  GridRoadNetwork,
  GridRoadSourceFeature,
  GridRoadTerritoryDefinition,
} from './types';

export interface GridRoadNetworkBuildOptions {
  cellSizeDegrees: number;
  coordinatePrecision?: number;
  territories?: GridRoadTerritoryDefinition[];
}

export function buildRoadNetwork(
  features: GridRoadSourceFeature[],
  options: GridRoadNetworkBuildOptions,
): GridRoadNetwork {
  const segments = normalizeRoadSourceFeatures(features);
  const graph = buildRoadGraph(segments, options.coordinatePrecision);
  const spatialIndex = buildRoadSpatialIndex(graph, options.cellSizeDegrees);
  const territoryIndex = options.territories
    ? buildRoadTerritoryIndex(graph, options.territories)
    : undefined;
  return { segments, graph, spatialIndex, territoryIndex };
}
