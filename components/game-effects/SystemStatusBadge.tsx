'use client';

import React from 'react';
import { Shield, Radar, CheckCircle2, ShieldAlert, LucideIcon } from 'lucide-react';

export type SystemStatus = 'armed' | 'scanning' | 'confirmed' | 'denied';

interface SystemStatusBadgeProps {
  status: SystemStatus;
  /** Override the default command-terminal label for this status. */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const DEFAULT_LABEL: Record<SystemStatus, string> = {
  armed: 'ARMED',
  scanning: 'SCANNING...',
  confirmed: 'CONFIRMED',
  denied: 'DENIED',
};

const ICON: Record<SystemStatus, LucideIcon> = {
  armed: Shield,
  scanning: Radar,
  confirmed: CheckCircle2,
  denied: ShieldAlert,
};

/**
 * Reusable covert-ops system-state pill: armed / scanning / confirmed / denied.
 * Color, icon, and the scanning spin all live in app/globals.css
 * (`.cq-status-badge`) so every consumer reads as one command-terminal
 * system rather than each component inventing its own confirm/deny styling.
 */
export default function SystemStatusBadge({
  status,
  label,
  size = 'md',
  className = '',
}: SystemStatusBadgeProps) {
  const Icon = ICON[status];

  return (
    // No ARIA live role here by default: when nested inside overlays that
    // already carry `role="status"`/`aria-live`, an extra live region
    // would double-announce every state change.
    <span className={`cq-status-badge is-${status} ${size === 'sm' ? 'is-sm' : ''} ${className}`}>
      <Icon size={size === 'sm' ? 11 : 13} className="cq-status-badge-icon" />
      <span>{label ?? DEFAULT_LABEL[status]}</span>
    </span>
  );
}
