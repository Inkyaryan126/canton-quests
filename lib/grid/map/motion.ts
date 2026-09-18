import type { GridMapFrame } from './frame';
import type { GridMapLayerId } from './layers';

export type GridMapMotionMode = 'full' | 'reduced';

export interface GridMapMotionOptions {
  reducedMotion: boolean;
}

export interface GridMapEffectTiming {
  effectId: string;
  durationMs: number;
}

export interface GridMapMotionPlan {
  mode: GridMapMotionMode;
  cameraTransitionMs: number;
  animatedLayerIds: GridMapLayerId[];
  pulsingTerritorySlugs: string[];
  effectTimings: GridMapEffectTiming[];
}

const FULL_CAMERA_TRANSITION_MS = 450;
const STRONG_EFFECT_MS = 700;
const SOFT_EFFECT_MS = 350;

export function buildGridMapMotionPlan(
  frame: GridMapFrame,
  options: GridMapMotionOptions,
): GridMapMotionPlan {
  const reduced = options.reducedMotion;
  const animatedLayerIds = reduced
    ? []
    : frame.layers
        .filter((layer) => layer.animated)
        .map((layer) => layer.id);

  const pulsingTerritorySlugs = reduced
    ? []
    : frame.packet.territories.features
        .filter((feature) => feature.properties.pulse)
        .map((feature) => feature.properties.slug)
        .sort();

  const effectTimings = frame.effects.map((effect) => ({
    effectId: effect.id,
    durationMs: reduced
      ? 0
      : effect.intensity === 'strong'
        ? STRONG_EFFECT_MS
        : SOFT_EFFECT_MS,
  }));

  return {
    mode: reduced ? 'reduced' : 'full',
    cameraTransitionMs: reduced ? 0 : FULL_CAMERA_TRANSITION_MS,
    animatedLayerIds,
    pulsingTerritorySlugs,
    effectTimings,
  };
}
