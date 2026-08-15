'use client';

import React, { useEffect, useState } from 'react';
import { Radar, Target, MapPin } from 'lucide-react';
import { CityScanMoment } from '@/lib/game-effects';
import { proceduralSoundEngine } from '@/lib/game-audio';

interface CityScanOverlayProps {
  moment: CityScanMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

export default function CityScanOverlay({
  moment,
  onDismiss,
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

  const targetCount = moment.targetCount || 12;
  const districtLabel = moment.district || 'CANTON DOWNTOWN & URBAN GRID';

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-300 pointer-events-none select-none"
      aria-live="polite"
      role="status"
    >
      {/* Sweeping Gold Laser Scan Line */}
      {!reducedMotion && (
        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_24px_#f59e0b] animate-[cqScanlineSweep_1.1s_cubic-bezier(0.4,0,0.2,1)_infinite]" />
      )}

      {/* Background Radar Grid Pattern */}
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.12)_0%,transparent_70%)]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(245, 158, 11, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(245, 158, 11, 0.08) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Central HUD Scanner Pod */}
      <div className="relative z-10 max-w-sm w-full bg-[#07090e]/95 border border-amber-500/50 rounded-2xl p-6 shadow-[0_0_50px_rgba(245,158,11,0.25)] text-center space-y-4 overflow-hidden">
        {/* HUD Corner Brackets */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-amber-400" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-amber-400" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-amber-400" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-amber-400" />

        {/* Radar Icon & Ping */}
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-amber-400/40 animate-ping" />
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-400/80 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            {phase === 'scanning' ? (
              <Radar className="w-7 h-7 animate-spin" />
            ) : (
              <Target className="w-7 h-7 text-amber-300" />
            )}
          </div>
        </div>

        {/* Scanning Text */}
        <div className="space-y-1">
          <span className="text-[10px] font-mono tracking-widest text-amber-400/80 font-bold uppercase block">
            {districtLabel}
          </span>
          <h3 className="text-xl font-black font-display text-white tracking-tight">
            {phase === 'scanning' ? 'SCANNING CITY GRID...' : 'TARGETS ACQUIRED'}
          </h3>
        </div>

        {/* Target Count & Details */}
        <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 text-amber-300">
            <MapPin size={14} />
            <span>OBJECTIVES ONLINE</span>
          </div>
          <span className="text-sm font-extrabold text-amber-400">
            {phase === 'scanning' ? '...' : `${targetCount} ACTIVE`}
          </span>
        </div>

        {/* Scanning progress telemetry bar */}
        <div className="w-full bg-stone-900 h-1.5 rounded-full overflow-hidden border border-stone-800">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
            style={{ width: phase === 'scanning' ? '45%' : '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
