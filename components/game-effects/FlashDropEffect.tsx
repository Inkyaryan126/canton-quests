'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Zap, Radio, MapPin, ArrowRight } from 'lucide-react';
import { FlashDropMoment } from '@/lib/game-effects';
import { proceduralSoundEngine } from '@/lib/game-audio';

interface FlashDropEffectProps {
  moment: FlashDropMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

export default function FlashDropEffect({
  moment,
  onDismiss,
  reducedMotion = false,
}: FlashDropEffectProps) {
  useEffect(() => {
    proceduralSoundEngine.playFlashDrop();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none"
      aria-live="assertive"
      role="alertdialog"
    >
      {/* Emergency red/gold pulsing perimeter */}
      {!reducedMotion && (
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(239,68,68,0.5)] animate-pulse" />
      )}

      {/* Main HUD Alert Card */}
      <div className="relative z-10 max-w-md w-full bg-[#07090e]/95 border-2 border-red-500/80 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-[0_0_60px_rgba(239,68,68,0.4)] overflow-hidden">
        {/* Top Warning Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-widest bg-red-950/80 border border-red-500/70 text-red-300 animate-pulse">
          <Radio size={13} className="text-red-400" />
          <span>LIVE DROP DETECTED</span>
        </div>

        {/* Quest Title & Details */}
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight uppercase leading-snug">
            {moment.questTitle}
          </h2>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <span className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 font-mono font-bold text-xs flex items-center gap-1">
              <Zap size={14} />
              +{moment.pointValue} XP ACTIVE
            </span>

            {moment.district && (
              <span className="px-3 py-1 rounded-lg bg-stone-900 border border-stone-700 text-stone-300 font-mono text-xs flex items-center gap-1">
                <MapPin size={13} className="text-amber-400" />
                {moment.district}
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-stone-300 font-mono leading-relaxed bg-stone-950/60 p-3 rounded-xl border border-stone-800">
          A limited-time flash quest has dropped live into the Canton grid. Move swiftly to verify before time expires.
        </p>

        {/* Action Button */}
        {moment.questUrl ? (
          <Link
            href={moment.questUrl}
            onClick={onDismiss}
            className="w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider bg-gradient-to-r from-red-500 to-amber-500 text-black flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(239,68,68,0.4)] transition-transform active:scale-95 cursor-pointer hover:brightness-110"
          >
            <span>INTERCEPT FLASH QUEST</span>
            <ArrowRight size={17} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider bg-gradient-to-r from-red-500 to-amber-500 text-black flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(239,68,68,0.4)] transition-transform active:scale-95 cursor-pointer hover:brightness-110"
          >
            <span>ACKNOWLEDGE TRANSMISSION</span>
            <ArrowRight size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
