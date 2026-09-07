'use client';

import React, { useEffect, useState } from 'react';
import CqTransition from './CqTransition';
import { useReducedMotion } from '@/lib/motion';

/** Mount arrival for quest moments, using Phase 2's shared timing and OS preference. */
export default function QuestMomentReveal({ children, className, reducedMotion = false }: {
  children: React.ReactNode;
  className?: string;
  reducedMotion?: boolean;
}) {
  const systemReducedMotion = useReducedMotion();
  const instant = reducedMotion || systemReducedMotion;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (instant) return;
    let revealFrame = 0;
    // Allow the initial frame to paint before applying the shared reveal.
    const paintFrame = requestAnimationFrame(() => {
      revealFrame = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(paintFrame);
      cancelAnimationFrame(revealFrame);
    };
  }, [instant]);

  return <CqTransition show={instant || visible} reducedMotion={instant} className={className}>
    {children}
  </CqTransition>;
}
