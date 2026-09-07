'use client';

import React from 'react';
import { Crosshair, Radar, Check, ShieldX } from 'lucide-react';
import motion from '@/lib/motion/primitives.module.css';

export type HudState = 'armed' | 'scanning' | 'confirmed' | 'denied';

interface HudSystemStateProps {
  state: HudState;
  /** Describe the actual caller result; this component never infers verification. */
  label: string;
  detail?: string;
  reducedMotion?: boolean;
}

const icons = { armed: Crosshair, scanning: Radar, confirmed: Check, denied: ShieldX };

export default function HudSystemState({ state, label, detail, reducedMotion = false }: HudSystemStateProps) {
  const Icon = icons[state];
  return (
    <div className={`cq-hud-state ${motion['cq-motion-scope']}`} data-state={state}
      data-reduced-motion={reducedMotion} role="status" aria-live="polite" aria-atomic="true">
      <span className="cq-hud-state-marker" aria-hidden="true"><Icon size={20} /></span>
      <span className="cq-hud-state-copy">
        <strong>{label}</strong>
        {detail && <span>{detail}</span>}
      </span>
      {state === 'scanning' && <span className="cq-hud-state-sweep" aria-hidden="true" />}
    </div>
  );
}
