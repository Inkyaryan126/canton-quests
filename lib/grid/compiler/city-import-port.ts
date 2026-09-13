import type { GridCityPackage } from '../core/types';

export interface GridCityImportResult {
  citySlug: string;
  districtsUpserted: number;
  territoriesUpserted: number;
  edgesUpserted: number;
  propertiesUpserted: number;
  landmarksUpserted: number;
}

export interface GridCityImportPort {
  importCityPackage(pkg: GridCityPackage): Promise<GridCityImportResult>;
}
