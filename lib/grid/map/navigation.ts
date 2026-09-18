import type { GridMapInteractionTarget } from './render-packet';
import { GRID_MAP_ZOOM_THRESHOLDS } from './scene';

export interface GridMapNavigationIntent {
  zoom: number;
  focusDistrictSlug: string | null;
  focusTerritorySlug: string | null;
  focusPropertySlug: string | null;
}

function invalidTarget(): never {
  throw new Error('Invalid Grid map interaction target');
}

export function buildGridMapNavigationIntent(
  target: GridMapInteractionTarget,
): GridMapNavigationIntent {
  if (target.kind === 'district') {
    if (
      !target.districtSlug ||
      target.districtSlug !== target.slug ||
      target.territorySlug ||
      target.propertySlug
    ) invalidTarget();

    return {
      zoom: GRID_MAP_ZOOM_THRESHOLDS.district,
      focusDistrictSlug: target.districtSlug,
      focusTerritorySlug: null,
      focusPropertySlug: null,
    };
  }

  if (target.kind === 'territory') {
    if (
      !target.districtSlug ||
      !target.territorySlug ||
      target.territorySlug !== target.slug ||
      target.propertySlug
    ) invalidTarget();

    return {
      zoom: GRID_MAP_ZOOM_THRESHOLDS.property,
      focusDistrictSlug: target.districtSlug,
      focusTerritorySlug: target.territorySlug,
      focusPropertySlug: null,
    };
  }

  if (
    target.kind !== 'property' ||
    !target.districtSlug ||
    !target.territorySlug ||
    !target.propertySlug ||
    target.propertySlug !== target.slug
  ) invalidTarget();

  return {
    zoom: GRID_MAP_ZOOM_THRESHOLDS.property,
    focusDistrictSlug: target.districtSlug,
    focusTerritorySlug: target.territorySlug,
    focusPropertySlug: target.propertySlug,
  };
}
