import type { GridMapRenderPacket } from './render-packet';

export interface GridMapViewportBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

function validateViewportBounds(bounds: GridMapViewportBounds): void {
  const values = [bounds.west, bounds.south, bounds.east, bounds.north];
  if (
    values.some((value) => !Number.isFinite(value)) ||
    bounds.west > bounds.east ||
    bounds.south > bounds.north
  ) {
    throw new Error('Grid map viewport bounds are invalid');
  }
}

export function filterGridMapRenderPacketToViewport(
  packet: GridMapRenderPacket,
  bounds: GridMapViewportBounds,
): GridMapRenderPacket {
  validateViewportBounds(bounds);

  const geometryVisible = (geometry: GeoJSON.Geometry): boolean => {
    const geometryBounds = coordinateBounds(geometry);
    return geometryBounds ? envelopesIntersect(geometryBounds, bounds) : false;
  };

  const districts = packet.districts.features.filter((feature) =>
    geometryVisible(feature.geometry),
  );
  const territories = packet.territories.features.filter((feature) =>
    geometryVisible(feature.geometry),
  );
  const properties = packet.properties.features.filter((feature) =>
    geometryVisible(feature.geometry),
  );
  const contestFronts = packet.contestFronts.features.filter((feature) =>
    geometryVisible(feature.geometry),
  );

  const visibleDistricts = new Set(
    districts.map((feature) => feature.properties.slug),
  );
  const visibleTerritories = new Set(
    territories.map((feature) => feature.properties.slug),
  );
  const visibleProperties = new Set(
    properties.map((feature) => feature.properties.slug),
  );

  const virtualBuildings = packet.virtualBuildings.filter((building) =>
    building.anchor.lng >= bounds.west &&
    building.anchor.lng <= bounds.east &&
    building.anchor.lat >= bounds.south &&
    building.anchor.lat <= bounds.north,
  );

  return {
    ...packet,
    districts: { ...packet.districts, features: districts },
    territories: { ...packet.territories, features: territories },
    properties: { ...packet.properties, features: properties },
    contestFronts: { ...packet.contestFronts, features: contestFronts },
    virtualBuildings,
    skylines: packet.skylines.filter((skyline) =>
      skyline.territorySlugs.some((slug) => visibleTerritories.has(slug)) ||
      skyline.propertySlugs.some((slug) => visibleProperties.has(slug)),
    ),
    interactionTargets: packet.interactionTargets.filter((target) => {
      if (target.kind === 'district') return visibleDistricts.has(target.slug);
      if (target.kind === 'territory') return visibleTerritories.has(target.slug);
      return visibleProperties.has(target.slug);
    }),
  };
}

type GridMapGeometryBounds = [number, number, number, number];

function coordinateBounds(geometry: GeoJSON.Geometry): GridMapGeometryBounds | null {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      minLng = Math.min(minLng, value[0]);
      minLat = Math.min(minLat, value[1]);
      maxLng = Math.max(maxLng, value[0]);
      maxLat = Math.max(maxLat, value[1]);
      return;
    }
    for (const child of value) visit(child);
  };

  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) {
      const childBounds = coordinateBounds(child);
      if (!childBounds) continue;
      visit([childBounds[0], childBounds[1]]);
      visit([childBounds[2], childBounds[3]]);
    }
  } else {
    visit(geometry.coordinates);
  }

  if (!Number.isFinite(minLng)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function envelopesIntersect(
  geometryBounds: GridMapGeometryBounds,
  viewport: GridMapViewportBounds,
): boolean {
  return !(
    geometryBounds[2] < viewport.west ||
    geometryBounds[0] > viewport.east ||
    geometryBounds[3] < viewport.south ||
    geometryBounds[1] > viewport.north
  );
}
