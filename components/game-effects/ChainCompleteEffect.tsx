'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Layers, ArrowRight, Sparkles, CheckCheck } from 'lucide-react';
import { ChainCompleteMoment } from '@/lib/game-effects';
import HudParticlesCanvas from './HudParticlesCanvas';
import { proceduralSoundEngine } from '@/lib/game-audio';

interface ChainCompleteEffectProps {
  moment: ChainCompleteMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

export default function ChainCompleteEffect({
  moment,
  onDismiss,
  reducedMotion = false,
}: ChainCompleteEffectProps) {
  useEffect(() => {
    proceduralSoundEngine.playQuestComplete(moment.bonusXp || 350);
  }, [moment.bonusXp]);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg select-none"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
    >
      <HudParticlesCanvas
        mode="gold-embers"
        color="#fbbf24"
        reducedMotion={reducedMotion}
      />

      <div className="relative z-10 max-w-md w-full bg-[#07090e]/95 border-2 border-amber-400 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-[0_0_60px_rgba(251,191,36,0.4)] overflow-hidden">
        {/* Chain Icon */}
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-amber-400/40 animate-ping" />
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.5)]">
            <Layers size={28} />
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-widest bg-amber-950/80 border border-amber-500/60 text-amber-300">
            <CheckCheck size={14} className="text-amber-400" />
            <span>QUEST CHAIN COMPLETE</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight uppercase leading-snug">
            {moment.chainTitle}
          </h2>
          <p className="text-xs text-stone-300 font-mono">
            System updated. All intermediate steps verified.
          </p>
        </div>

        {/* Next Objective if Unlocked */}
        {moment.nextObjectiveTitle && (
          <div className="p-4 bg-cyan-950/40 border border-cyan-500/40 rounded-2xl text-left space-y-1.5">
            <div className="flex items-center gap-2 text-cyan-300 text-[10px] font-mono font-bold uppercase tracking-wider">
              <Sparkles size={13} />
              <span>NEW OBJECTIVE AVAILABLE</span>
            </div>
            <strong className="text-sm text-white block font-display">{moment.nextObjectiveTitle}</strong>
            {moment.nextObjectiveUrl && (
              <Link
                href={moment.nextObjectiveUrl}
                onClick={onDismiss}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold pt-1"
              >
                <span>Track New Mission</span>
                <ArrowRight size={13} />
              </Link>
            )}
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-black flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition-transform active:scale-95 cursor-pointer hover:brightness-110"
        >
          <span>CONTINUE EXPEDITION</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
