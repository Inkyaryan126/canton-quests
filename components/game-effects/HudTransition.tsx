'use client';

import React from 'react';
import motion from '@/lib/motion/primitives.module.css';

/** One section arrival. No timers, navigation interception, or delayed content.
 * Use a key at the caller only when a new section should replay the arrival. */
export default function HudTransition({ children, reducedMotion = false, className = '' }: {
  children: React.ReactNode;
  reducedMotion?: boolean;
  className?: string;
}) {
  return <div className={`${motion['cq-motion-scope']} ${motion['cq-motion-open']} ${className}`}
    data-reduced-motion={reducedMotion}>{children}</div>;
}
