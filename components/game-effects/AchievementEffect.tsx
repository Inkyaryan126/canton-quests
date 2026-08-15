'use client';

import React, { useEffect } from 'react';
import { Award, Zap, Ticket, ArrowRight, Sparkles } from 'lucide-react';
import { AchievementMoment } from '@/lib/game-effects';
import HudParticlesCanvas from './HudParticlesCanvas';
import { proceduralSoundEngine } from '@/lib/game-audio';

interface AchievementEffectProps {
  moment: AchievementMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

export default function AchievementEffect({
  moment,
  onDismiss,
  reducedMotion = false,
}: AchievementEffectProps) {
  useEffect(() => {
    proceduralSoundEngine.playAchievement();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
    >
      <HudParticlesCanvas
        mode="gold-embers"
        color="#fbbf24"
        reducedMotion={reducedMotion}
      />

      {/* Main HUD Card */}
      <div className="relative z-10 max-w-md w-full bg-[#07090e]/95 border-2 border-amber-400/80 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-[0_0_60px_rgba(251,191,36,0.35)] overflow-hidden">
        {/* Radial Badge Icon */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-amber-400/40 animate-ping" />
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400/30 via-amber-500/20 to-transparent border-2 border-amber-400 flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(245,158,11,0.6)]">
            {moment.icon || '🏆'}
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-widest bg-amber-950/70 border border-amber-400/50 text-amber-300">
            <Sparkles size={12} className="text-amber-400" />
            <span>ACHIEVEMENT UNLOCKED</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight leading-snug drop-shadow-md">
            {moment.title}
          </h2>
          <p className="text-xs text-stone-300 font-body leading-relaxed max-w-xs mx-auto">
            {moment.description}
          </p>
        </div>

        {/* Rewards pill if applicable */}
        {(moment.rewardXp || moment.rewardEntries) && (
          <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl flex items-center justify-center gap-4 text-xs font-mono text-amber-200">
            {moment.rewardXp ? (
              <div className="flex items-center gap-1.5">
                <Zap size={14} className="text-amber-400 fill-amber-400" />
                <span className="font-bold text-amber-300">+{moment.rewardXp} XP</span>
              </div>
            ) : null}
            {moment.rewardEntries ? (
              <div className="flex items-center gap-1.5">
                <Ticket size={14} className="text-amber-400" />
                <span className="font-bold text-amber-300">+{moment.rewardEntries} Drawing Ticket{moment.rewardEntries > 1 ? 's' : ''}</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-black flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition-transform active:scale-95 cursor-pointer hover:brightness-110"
        >
          <span>COLLECT & CONTINUE</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
