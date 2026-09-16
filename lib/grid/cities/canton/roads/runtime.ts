import { cantonRawGeography } from '../geography/raw-geography';
import { buildRoadAccessIndex } from '../../../roads/access';
import { buildRoadAccessDistanceMatrix } from '../../../roads/distance-matrix';
import { buildRoadNetwork } from '../../../roads/network';
import { createRoadNetworkSnapshot } from '../../../roads/snapshot';
import type {
  GridRoadAccessDistanceMatrix,
  GridRoadAccessIndex,
  GridRoadNetwork,
  GridRoadNetworkSnapshot,
} from '../../../roads/types';
import { cantonRoadAccessTargets } from './access';
import { loadCantonRoadSourceFeatures } from './source';

export interface CantonRoadRuntime {
  network: GridRoadNetwork;
  accessIndex: GridRoadAccessIndex;
  distanceMatrix: GridRoadAccessDistanceMatrix;
  snapshot: GridRoadNetworkSnapshot;
}

export interface CantonRoadRuntimeOptions {
  cellSizeDegrees?: number;
  maxAccessDistanceMeters?: number;
  snapshotVersion?: string;
}
export function buildCantonRoadRuntime(
  options: CantonRoadRuntimeOptions = {},
): CantonRoadRuntime {
  const cellSizeDegrees = options.cellSizeDegrees ?? 0.002;
  const maxAccessDistanceMeters = options.maxAccessDistanceMeters ?? 250;
  const snapshotVersion = options.snapshotVersion ?? 'canton-roads-v1';

  const territories = cantonRawGeography.territories.map((territory) => ({
    slug: territory.slug,
    geometry: territory.geometry,
  }));
  const network = buildRoadNetwork(loadCantonRoadSourceFeatures(), {
    cellSizeDegrees,
    territories,
  });
  const accessIndex = buildRoadAccessIndex(
    network.graph,
    network.spatialIndex,
    cantonRoadAccessTargets(),
    maxAccessDistanceMeters,
  );
  const distanceMatrix = buildRoadAccessDistanceMatrix(
    accessIndex,
    network.routingIndex,
  );
  const snapshot = createRoadNetworkSnapshot(network, snapshotVersion);

  return { network, accessIndex, distanceMatrix, snapshot };
}
