'use client';

import React, { useEffect, useState } from 'react';
import HudSystemState from './HudSystemState';
import HudTransition from './HudTransition';
import { CityScanMoment } from '@/lib/game-effects';
import { proceduralSoundEngine } from '@/lib/game-audio';

interface CityScanOverlayProps {
  moment: CityScanMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

export default function CityScanOverlay({
  moment,
  reducedMotion = false,
}: CityScanOverlayProps) {
  const [phase, setPhase] = useState<'scanning' | 'acquired'>('scanning');

  useEffect(() => {
    proceduralSoundEngine.playCityScan();

    const t1 = setTimeout(() => {
      setPhase('acquired');
    }, reducedMotion ? 300 : 500);

    return () => {
      clearTimeout(t1);
    };
  }, [reducedMotion]);

  const targetCount = moment.targetCount;
  const districtLabel = moment.district || 'CANTON DOWNTOWN & URBAN GRID';

  return (
    <div className="cq-field-effect cq-field-effect-passive">
      <HudTransition className="cq-field-panel" reducedMotion={reducedMotion}>
        <p className="cq-field-eyebrow">{districtLabel}</p>
        <HudSystemState
          state={phase === 'scanning' ? 'scanning' : 'confirmed'}
          label={phase === 'scanning' ? 'SCANNING CITY GRID...' : 'GRID SCAN COMPLETE'}
          detail={phase === 'scanning' ? 'Reading the current objective list.' :
            targetCount === undefined ? 'Objective list ready.' : `${targetCount} TARGETS ONLINE`}
          reducedMotion={reducedMotion}
        />
      </HudTransition>
    </div>
  );
}
