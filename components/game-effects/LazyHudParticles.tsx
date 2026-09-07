'use client';

import React, { lazy, Suspense } from 'react';
import { useReducedMotion } from '@/lib/motion/use-reduced-motion';
import type { HudParticlesCanvasProps } from './HudParticlesCanvas';
export type { ParticleMode } from './HudParticlesCanvas';

const ParticleCanvas = lazy(() => import('./HudParticlesCanvas'));

export default function LazyHudParticles(props: HudParticlesCanvasProps) {
  const reducedMotion = useReducedMotion();
  if (props.reducedMotion || reducedMotion) return null;
  return <Suspense fallback={null}><ParticleCanvas {...props} /></Suspense>;
}
