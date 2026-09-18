import type { GridWorldProjection } from '../server/world-projection';
import {
  buildGridMapCameraPlan,
  type GridMapCameraPlan,
} from './camera';
import {
  diffGridMapRenderPackets,
  type GridMapRenderDelta,
} from './delta';
import {
  deriveGridMapEffectCues,
  type GridMapEffectCue,
} from './effects';
import {
  buildGridMapLayerManifest,
  type GridMapLayerDescriptor,
} from './layers';
import type { GridMapInteractionTarget, GridMapRenderPacket } from './render-packet';
import { buildGridMapRenderPacket } from './render-packet';
import {
  buildGridMapScene,
  type GridMapSceneOptions,
} from './scene';
import type { GridMapScene } from './scene-types';
import {
  resolveGridMapSelection,
  type GridMapSelectionDetails,
} from './selection';

export interface GridMapFrame {
  version: 1;
  scene: GridMapScene;
  packet: GridMapRenderPacket;
  layers: GridMapLayerDescriptor[];
  delta: GridMapRenderDelta | null;
  effects: GridMapEffectCue[];
}

export interface GridMapFrameInteraction {
  target: GridMapInteractionTarget;
  selection: GridMapSelectionDetails;
  camera: GridMapCameraPlan;
}

export function buildGridMapFrame(
  projection: GridWorldProjection,
  options: GridMapSceneOptions,
  previousPacket: GridMapRenderPacket | null = null,
): GridMapFrame {
  const scene = buildGridMapScene(projection, options);
  const packet = buildGridMapRenderPacket(scene);
  const layers = buildGridMapLayerManifest(packet);

  return {
    version: 1,
    scene,
    packet,
    layers,
    delta: previousPacket
      ? diffGridMapRenderPackets(previousPacket, packet)
      : null,
    effects: previousPacket
      ? deriveGridMapEffectCues(previousPacket, packet)
      : [],
  };
}
function sameTarget(
  left: GridMapInteractionTarget,
  right: GridMapInteractionTarget,
): boolean {
  return (
    left.kind === right.kind &&
    left.slug === right.slug &&
    left.districtSlug === right.districtSlug &&
    left.territorySlug === right.territorySlug &&
    left.propertySlug === right.propertySlug
  );
}

export function resolveGridMapFrameInteraction(
  frame: GridMapFrame,
  target: GridMapInteractionTarget,
): GridMapFrameInteraction {
  const present = frame.packet.interactionTargets.some(
    (candidate) => sameTarget(candidate, target),
  );
  if (!present) {
    throw new Error('Grid map interaction target is not present in this frame');
  }

  const selection = resolveGridMapSelection(frame.packet, target);
  if (!selection) {
    throw new Error('Grid map interaction target has no selection details');
  }

  return {
    target,
    selection,
    camera: buildGridMapCameraPlan(frame.packet, target),
  };
}
