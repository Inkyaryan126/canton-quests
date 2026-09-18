import type { GridMapRenderPacket } from './render-packet';

export type GridMapLayerId =
  | 'district-fill'
  | 'district-outline'
  | 'territory-fill'
  | 'territory-outline'
  | 'property-footprint'
  | 'contest-front'
  | 'virtual-building'
  | 'skyline-silhouette';

export type GridMapLayerSource =
  | 'districts'
  | 'territories'
  | 'properties'
  | 'contestFronts'
  | 'virtualBuildings'
  | 'skylines';

export type GridMapLayerKind =
  | 'fill'
  | 'line'
  | 'symbol'
  | 'extrusion';
export interface GridMapLayerDescriptor {
  id: GridMapLayerId;
  source: GridMapLayerSource;
  kind: GridMapLayerKind;
  order: number;
  interactive: boolean;
  animated: boolean;
}

function pushLayer(
  layers: GridMapLayerDescriptor[],
  descriptor: GridMapLayerDescriptor,
  hasData: boolean,
): void {
  if (hasData) layers.push(descriptor);
}

export function buildGridMapLayerManifest(
  packet: GridMapRenderPacket,
): GridMapLayerDescriptor[] {
  const layers: GridMapLayerDescriptor[] = [];
  pushLayer(layers, {
    id: 'district-fill',
    source: 'districts',
    kind: 'fill',
    order: 10,
    interactive: packet.zoomBand === 'city',
    animated: false,
  }, packet.districts.features.length > 0);

  pushLayer(layers, {
    id: 'district-outline',
    source: 'districts',
    kind: 'line',
    order: 20,
    interactive: false,
    animated: false,
  }, packet.districts.features.length > 0);

  pushLayer(layers, {
    id: 'territory-fill',
    source: 'territories',
    kind: 'fill',
    order: 30,
    interactive: true,
    animated: packet.territories.features.some(
      (feature) => feature.properties.pulse,
    ),
  }, packet.territories.features.length > 0);
  pushLayer(layers, {
    id: 'territory-outline',
    source: 'territories',
    kind: 'line',
    order: 40,
    interactive: false,
    animated: packet.territories.features.some(
      (feature) => feature.properties.pulse,
    ),
  }, packet.territories.features.length > 0);

  pushLayer(layers, {
    id: 'property-footprint',
    source: 'properties',
    kind: 'fill',
    order: 50,
    interactive: true,
    animated: false,
  }, packet.properties.features.length > 0);

  pushLayer(layers, {
    id: 'contest-front',
    source: 'contestFronts',
    kind: 'line',
    order: 60,
    interactive: false,
    animated: true,
  }, packet.contestFronts.features.length > 0);
  pushLayer(layers, {
    id: 'virtual-building',
    source: 'virtualBuildings',
    kind: 'extrusion',
    order: 70,
    interactive: false,
    animated: false,
  }, packet.virtualBuildings.length > 0);

  pushLayer(layers, {
    id: 'skyline-silhouette',
    source: 'skylines',
    kind: 'symbol',
    order: 80,
    interactive: false,
    animated: false,
  }, packet.skylines.length > 0);

  return layers.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
