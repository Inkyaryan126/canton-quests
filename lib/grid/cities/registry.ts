import type { GridCityPackage } from '../core/types';
import { cantonFoundingSeasonPackage } from './canton/founding-season';

const packages = new Map<string, GridCityPackage>([
  [cantonFoundingSeasonPackage.city.slug, cantonFoundingSeasonPackage],
]);

export function getGridCityPackage(
  citySlug: string
): GridCityPackage | undefined {
  return packages.get(citySlug);
}

export function listGridCityPackages(): GridCityPackage[] {
  return [...packages.values()];
}
