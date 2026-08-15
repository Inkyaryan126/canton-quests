'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Zap, Trophy, Ticket, ArrowRight, Sparkles } from 'lucide-react';
import { QuestCompleteMoment } from '@/lib/game-effects';
import HudParticlesCanvas from './HudParticlesCanvas';
import { proceduralSoundEngine } from '@/lib/game-audio';

interface QuestCompleteEffectProps {
  moment: QuestCompleteMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

export default function QuestCompleteEffect({
  moment,
  onDismiss,
  reducedMotion = false,
}: QuestCompleteEffectProps) {
  const [displayXp, setDisplayXp] = useState(reducedMotion ? moment.xpAwarded : 0);
  const [stage, setStage] = useState<'impact' | 'counted'>('impact');

  useEffect(() => {
    proceduralSoundEngine.playQuestComplete(moment.xpAwarded);

    if (reducedMotion) {
      setDisplayXp(moment.xpAwarded);
      setStage('counted');
      return;
    }

    // Smooth XP count-up
    const targetXp = moment.xpAwarded;
    const duration = 750;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const current = Math.round(targetXp * progress);
      setDisplayXp(current);

      if (progress >= 1) {
        clearInterval(interval);
        setStage('counted');
      }
    }, 20);

    return () => {
      clearInterval(interval);
    };
  }, [moment.xpAwarded, reducedMotion]);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
    >
      {/* Particle celebration sparks */}
      <HudParticlesCanvas
        mode="xp-burst"
        color="#f59e0b"
        count={50}
        reducedMotion={reducedMotion}
      />

      {/* Screen edge flash */}
      {!reducedMotion && (
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(245,158,11,0.4)] animate-pulse" />
      )}

      {/* Main HUD Reward Panel */}
      <div className="relative z-10 max-w-md w-full bg-[#07090e]/95 border-2 border-amber-500/80 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-[0_0_60px_rgba(245,158,11,0.35)] overflow-hidden">
        {/* Verification Icon */}
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]">
            <CheckCircle2 size={32} />
          </div>
        </div>

        {/* Verification Headline */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-widest bg-amber-950/60 border border-amber-500/50 text-amber-300">
            <Sparkles size={12} className="text-amber-400" />
            <span>SERVER VERIFIED & COMPLETE</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight leading-snug">
            {moment.questTitle}
          </h2>
        </div>

        {/* Big XP Counter Box */}
        <div className="py-4 px-6 bg-gradient-to-b from-amber-950/60 to-stone-950 border border-amber-500/50 rounded-2xl relative overflow-hidden shadow-inner">
          <div className="flex items-center justify-center gap-2 text-amber-400">
            <Zap size={22} className="fill-amber-400 animate-bounce" />
            <span className="font-mono text-xs uppercase tracking-widest font-bold">XP REWARD ISSUED</span>
          </div>
          <div className="font-display font-black text-4xl sm:text-5xl text-amber-300 tracking-tight mt-1 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]">
            +{displayXp} <span className="text-xl text-amber-400/80 font-mono">XP</span>
          </div>

          {moment.drawingEntriesAwarded && moment.drawingEntriesAwarded > 0 ? (
            <div className="mt-2.5 pt-2.5 border-t border-amber-500/30 flex items-center justify-center gap-2 text-xs font-mono text-amber-200">
              <Ticket size={14} className="text-amber-400" />
              <span>+{moment.drawingEntriesAwarded} Prize Drawing Ticket{moment.drawingEntriesAwarded > 1 ? 's' : ''} Locked</span>
            </div>
          ) : null}
        </div>

        {/* Unlocked Next Quest in Chain Banner */}
        {moment.unlockedQuestTitle && (
          <div className="p-3.5 bg-cyan-950/40 border border-cyan-500/40 rounded-xl text-left space-y-1">
            <span className="text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-wider block">
              🔓 UNLOCKED IN CHAIN:
            </span>
            <strong className="text-xs text-white block">{moment.unlockedQuestTitle}</strong>
            {moment.unlockedQuestUrl && (
              <Link
                href={moment.unlockedQuestUrl}
                onClick={onDismiss}
                className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold pt-0.5"
              >
                <span>Proceed to Next Quest</span>
                <ArrowRight size={12} />
              </Link>
            )}
          </div>
        )}

        {/* Action / Dismiss Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-black flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition-transform active:scale-95 cursor-pointer hover:brightness-110"
        >
          <span>CONTINUE</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
