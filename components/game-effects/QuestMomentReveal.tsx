'use client';

import React, { useEffect, useState } from 'react';
import CqTransition from './CqTransition';
import { useReducedMotion } from '@/lib/motion';

interface QuestMomentRevealProps {
  children: React.ReactNode;
  className?: string;
  /** An app-level reduced-motion flag, in addition to the OS preference. */
  reducedMotion?: boolean;
}

/**
 * Mount-triggered arrival for quest-start/quest-complete moments, built on
 * Phase 2's shared `CqTransition` reveal timing. Honors both the caller's
 * app-level `reducedMotion` flag and the live OS `prefers-reduced-motion`
 * preference — either one collapses the reveal to instant.
 */
export default function QuestMomentReveal({ children, className, reducedMotion = false }: QuestMomentRevealProps) {
  const systemReducedMotion = useReducedMotion();
  const instant = reducedMotion || systemReducedMotion;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (instant) return;
    let revealFrame = 0;
    // Let the initial (hidden) frame paint before applying the reveal, or
    // the opacity/transform transition never has anything to animate from.
    const paintFrame = requestAnimationFrame(() => {
      revealFrame = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(paintFrame);
      cancelAnimationFrame(revealFrame);
    };
  }, [instant]);

  return (
    <CqTransition show={instant || visible} reducedMotion={instant} className={className}>
      {children}
    </CqTransition>
  );
}
