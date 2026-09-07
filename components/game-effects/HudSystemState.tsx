'use client';

import React from 'react';
import SystemStatusBadge, { SystemStatus } from './SystemStatusBadge';

export type HudState = SystemStatus;

interface HudSystemStateProps {
  state: HudState;
  label?: string;
  detail?: string;
  size?: 'sm' | 'md';
  className?: string;
  reducedMotion?: boolean;
}

export default function HudSystemState({
  state,
  label,
  detail,
  size = 'md',
  className = '',
  reducedMotion = false,
}: HudSystemStateProps) {
  return (
    <div
      className={`cq-hud-system-state ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-state={state}
      data-reduced-motion={reducedMotion}
    >
      <SystemStatusBadge status={state} label={label} size={size} />
      {detail && <span className="cq-hud-system-state-detail">{detail}</span>}
    </div>
  );
}

export { SystemStatusBadge };
export type { SystemStatus };
