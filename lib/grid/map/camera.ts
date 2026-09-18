import { computeCentroid } from '../geo/geometry';
import type { GridLatLng } from '../core/types';
import {
  buildGridMapNavigationIntent,
  type GridMapNavigationIntent,
} from './navigation';
import type {
  GridMapInteractionTarget,
  GridMapRenderPacket,
} from './render-packet';
import type { GridMapViewportBounds } from './viewport';

export interface GridMapCameraPlan {
  navigation: GridMapNavigationIntent;
  center: GridLatLng;
  fitBounds: GridMapViewportBounds | null;
}

function pointCenter(geometry: GeoJSON.Point): GridLatLng {
  return {
    lng: geometry.coordinates[0],
    lat: geometry.coordinates[1],
  };
}
function geometryBounds(
  geometry: GeoJSON.Geometry,
): GridMapViewportBounds | null {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      west = Math.min(west, value[0]);
      south = Math.min(south, value[1]);
      east = Math.max(east, value[0]);
      north = Math.max(north, value[1]);
      return;
    }
    for (const child of value) visit(child);
  };
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) {
      const bounds = geometryBounds(child);
      if (!bounds) continue;
      visit([bounds.west, bounds.south]);
      visit([bounds.east, bounds.north]);
    }
  } else {
    visit(geometry.coordinates);
  }

  if (!Number.isFinite(west)) return null;
  return { west, south, east, north };
}

function geometryCenter(geometry: GeoJSON.Geometry): GridLatLng | null {
  if (geometry.type === 'Point') return pointCenter(geometry);
  if (geometry.type === 'MultiPolygon') return computeCentroid(geometry);

  const bounds = geometryBounds(geometry);
  if (!bounds) return null;
  return {
    lat: (bounds.south + bounds.north) / 2,
    lng: (bounds.west + bounds.east) / 2,
  };
}
function geometryForTarget(
  packet: GridMapRenderPacket,
  target: GridMapInteractionTarget,
): GeoJSON.Geometry | null {
  if (target.kind === 'district') {
    return packet.districts.features.find(
      (feature) => feature.properties.slug === target.slug,
    )?.geometry ?? null;
  }

  if (target.kind === 'territory') {
    return packet.territories.features.find(
      (feature) => feature.properties.slug === target.slug,
    )?.geometry ?? null;
  }

  return packet.properties.features.find(
    (feature) => feature.properties.slug === target.slug,
  )?.geometry ?? null;
}

export function buildGridMapCameraPlan(
  packet: GridMapRenderPacket,
  target: GridMapInteractionTarget,
): GridMapCameraPlan {
  const navigation = buildGridMapNavigationIntent(target);
  const geometry = geometryForTarget(packet, target);
  if (!geometry) {
    throw new Error('Grid map navigation target is not present in the render packet');
  }

  const center = geometryCenter(geometry);
  if (!center) {
    throw new Error('Grid map navigation target has no usable geometry');
  }

  return {
    navigation,
    center,
    fitBounds: geometry.type === 'Point' ? null : geometryBounds(geometry),
  };
}
