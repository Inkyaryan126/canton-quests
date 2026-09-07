'use client';

import React from 'react';

interface CqTransitionProps {
  /** Mount reveal state — false renders the pre-transition (hidden) frame. */
  show?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Merged onto the same element as any other inline style the caller needs
   *  (border color, glow, a stage-driven scale transform, etc). */
  style?: React.CSSProperties;
  /** An app-level reduced-motion flag (e.g. gameMomentManager's), in addition
   *  to the OS `prefers-reduced-motion` media query the CSS already honors. */
  reducedMotion?: boolean;
}

/**
 * The shared section/overlay reveal transition (`.cq-transition-reveal` in
 * app/globals.css, built on the `--cq-motion-*` tokens). Renders a single
 * element — pass the caller's own visual className/style and they land on
 * the same node, so this never adds an extra wrapper box to the layout.
 * Use it instead of a one-off inline `transition-all duration-*` so every
 * HUD moment arrives with the same command-terminal timing.
 */
export default function CqTransition({
  show = true,
  children,
  className = '',
  style,
  reducedMotion = false,
}: CqTransitionProps) {
  return (
    <div
      className={`cq-transition-reveal ${show ? 'is-visible' : ''} ${className}`}
      style={reducedMotion ? { ...style, transition: 'none', opacity: 1 } : style}
      data-reduced-motion={reducedMotion}
    >
      {children}
    </div>
  );
}

export { CqTransition as HudTransition };
