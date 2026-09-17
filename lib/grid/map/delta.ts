import type { GridMapRenderPacket } from './render-packet';

export interface GridMapEntityDelta {
  added: string[];
  removed: string[];
  changed: string[];
}

export interface GridMapRenderDelta {
  cameraChanged: boolean;
  zoomBandChanged: boolean;
  skylinesChanged: boolean;
  districts: GridMapEntityDelta;
  territories: GridMapEntityDelta;
  properties: GridMapEntityDelta;
  contestFronts: GridMapEntityDelta;
  virtualBuildings: GridMapEntityDelta;
}

function entityDelta<T>(
  previous: readonly T[],
  next: readonly T[],
  idFor: (value: T) => string,
): GridMapEntityDelta {
  const previousById = new Map(
    previous.map((value) => [idFor(value), JSON.stringify(value)] as const),
  );
  const nextById = new Map(
    next.map((value) => [idFor(value), JSON.stringify(value)] as const),
  );

  const added = [...nextById.keys()]
    .filter((id) => !previousById.has(id))
    .sort();
  const removed = [...previousById.keys()]
    .filter((id) => !nextById.has(id))
    .sort();
  const changed = [...nextById.keys()]
    .filter((id) =>
      previousById.has(id) && previousById.get(id) !== nextById.get(id),
    )
    .sort();

  return { added, removed, changed };
}

export function diffGridMapRenderPackets(
  previous: GridMapRenderPacket,
  next: GridMapRenderPacket,
): GridMapRenderDelta {
  const districts = entityDelta(
    previous.districts.features,
    next.districts.features,
    (feature) => feature.properties.slug,
  );
  const territories = entityDelta(
    previous.territories.features,
    next.territories.features,
    (feature) => feature.properties.slug,
  );
  const properties = entityDelta(
    previous.properties.features,
    next.properties.features,
    (feature) => feature.properties.slug,
  );
  const contestFronts = entityDelta(
    previous.contestFronts.features,
    next.contestFronts.features,
    (feature) => feature.properties.contestId,
  );
  const virtualBuildings = entityDelta(
    previous.virtualBuildings,
    next.virtualBuildings,
    (building) => building.propertySlug,
  );

  return {
    cameraChanged:
      previous.zoom !== next.zoom ||
      previous.center.lat !== next.center.lat ||
      previous.center.lng !== next.center.lng,
    zoomBandChanged: previous.zoomBand !== next.zoomBand,
    skylinesChanged: JSON.stringify(previous.skylines) !== JSON.stringify(next.skylines),
    districts,
    territories,
    properties,
    contestFronts,
    virtualBuildings,
  };
}
