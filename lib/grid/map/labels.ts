import { computeCentroid } from '../geo/geometry';
import type { GridLatLng } from '../core/types';
import type { GridMapRenderPacket } from './render-packet';

export type GridMapLabelKind = 'district' | 'territory' | 'property';

export interface GridMapLabel {
  kind: GridMapLabelKind;
  slug: string;
  text: string;
  anchor: GridLatLng;
  priority: number;
  focused: boolean;
}

export interface GridMapLabelPlanOptions {
  maxLabels?: number;
}

const DEFAULT_LABEL_BUDGET: Record<GridMapRenderPacket['zoomBand'], number> = {
  city: 12,
  district: 24,
  property: 36,
};

function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
function geometryAnchor(geometry: GeoJSON.Geometry): GridLatLng | null {
  if (geometry.type === 'Point') {
    return {
      lng: geometry.coordinates[0],
      lat: geometry.coordinates[1],
    };
  }
  if (geometry.type === 'MultiPolygon') {
    return computeCentroid(geometry);
  }
  return null;
}

function districtPriority(
  properties: GridMapRenderPacket['districts']['features'][number]['properties'],
): number {
  let priority = properties.focused ? 1_000 : 0;
  if (properties.controlRole === 'contested') priority += 700;
  else if (properties.controlRole === 'you') priority += 350;
  else if (properties.controlRole === 'mixed') priority += 250;
  else if (properties.controlRole === 'rival') priority += 150;
  priority += Math.min(properties.territoryCount, 99);
  return priority;
}

function territoryPriority(
  properties: GridMapRenderPacket['territories']['features'][number]['properties'],
): number {
  let priority = properties.focused ? 1_000 : 0;
  if (properties.contested) priority += 700;
  if (properties.claimable) priority += 450;
  if (properties.fillRole === 'controlled-you') priority += 300;
  else if (properties.fillRole === 'controlled-rival') priority += 150;
  priority += Math.min(properties.totalDevelopmentLevel * 10, 120);
  return priority;
}
function propertyPriority(
  properties: GridMapRenderPacket['properties']['features'][number]['properties'],
): number {
  let priority = properties.focused ? 1_000 : 0;
  priority += Math.min(properties.developmentLevel * 100, 500);
  if (properties.ownership === 'you') priority += 75;
  else if (properties.ownership === 'occupied') priority += 25;
  return priority;
}

function districtLabels(packet: GridMapRenderPacket): GridMapLabel[] {
  return packet.districts.features.flatMap((feature) => {
    const anchor = geometryAnchor(feature.geometry);
    if (!anchor) return [];
    const p = feature.properties;
    return [{
      kind: 'district' as const,
      slug: p.slug,
      text: humanizeSlug(p.slug),
      anchor,
      priority: districtPriority(p),
      focused: p.focused,
    }];
  });
}

function territoryLabels(packet: GridMapRenderPacket): GridMapLabel[] {
  return packet.territories.features.flatMap((feature) => {
    const anchor = geometryAnchor(feature.geometry);
    if (!anchor) return [];
    const p = feature.properties;
    return [{
      kind: 'territory' as const,
      slug: p.slug,
      text: p.name,
      anchor,
      priority: territoryPriority(p),
      focused: p.focused,
    }];
  });
}
function propertyLabels(packet: GridMapRenderPacket): GridMapLabel[] {
  return packet.properties.features.flatMap((feature) => {
    const anchor = geometryAnchor(feature.geometry);
    if (!anchor) return [];
    const p = feature.properties;
    return [{
      kind: 'property' as const,
      slug: p.slug,
      text: p.name,
      anchor,
      priority: propertyPriority(p),
      focused: p.focused,
    }];
  });
}

export function buildGridMapLabelPlan(
  packet: GridMapRenderPacket,
  options: GridMapLabelPlanOptions = {},
): GridMapLabel[] {
  const maxLabels =
    options.maxLabels ?? DEFAULT_LABEL_BUDGET[packet.zoomBand];
  if (!Number.isInteger(maxLabels) || maxLabels < 0) {
    throw new Error('Grid map maxLabels must be a non-negative integer');
  }

  const labels =
    packet.zoomBand === 'city'
      ? districtLabels(packet)
      : packet.zoomBand === 'district'
        ? territoryLabels(packet)
        : propertyLabels(packet);

  return labels
    .sort((a, b) =>
      b.priority - a.priority ||
      a.slug.localeCompare(b.slug),
    )
    .slice(0, maxLabels);
}
