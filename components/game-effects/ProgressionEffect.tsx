'use client';

import React, { useEffect } from 'react';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { LeaderboardMilestoneMoment } from '@/lib/game-effects';
import HudParticlesCanvas from './HudParticlesCanvas';
import { cqSoundManager } from '@/lib/audio';

interface ProgressionEffectProps {
  moment: LeaderboardMilestoneMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

/**
 * PROGRESSION template family — currently covers leaderboard milestones.
 * Personal rank changes already have their own home (RankUpEffect /
 * GameMomentType 'rank-up') and Three Locks progress its own
 * (ThreeLocksFragmentEffect) — neither is duplicated here.
 */
export default function ProgressionEffect({ moment, onDismiss, reducedMotion = false }: ProgressionEffectProps) {
  const color = moment.pathColor && /^#/.test(moment.pathColor) ? moment.pathColor : '#f59e0b';

  useEffect(() => {
    cqSoundManager.play('rank_up');
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
    >
      <HudParticlesCanvas mode="xp-burst" color={color} reducedMotion={reducedMotion} />

      <div
        className="relative z-10 max-w-sm w-full max-h-[90vh] overflow-y-auto bg-[#07090e]/95 border-2 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl"
        style={{ borderColor: color, boxShadow: `0 0 50px ${color}55` }}
      >
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl border-2 flex items-center justify-center" style={{ borderColor: color, background: `${color}22` }}>
            <TrendingUp size={26} style={{ color }} />
          </div>
        </div>

        <div className="space-y-1">
          <span className="inline-block text-[10px] font-mono font-black uppercase tracking-widest px-3 py-1 rounded-full border" style={{ borderColor: color, color, backgroundColor: `${color}18` }}>
            LEADERBOARD MILESTONE
          </span>
          <h2 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight">{moment.headline}</h2>
          {moment.secondaryText && <p className="text-xs text-stone-300 font-mono">{moment.secondaryText}</p>}
        </div>

        {moment.progress && (
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-stone-900 border border-stone-800 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((moment.progress.current / Math.max(1, moment.progress.total)) * 100))}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
              {moment.progress.label || 'Progress'}: {moment.progress.current} / {moment.progress.total}
            </span>
          </div>
        )}

        {moment.primaryText && <p className="text-sm text-stone-200 font-mono">{moment.primaryText}</p>}

        <button
          type="button"
          onClick={onDismiss}
          className="w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider text-black flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer hover:brightness-110 min-h-[48px]"
          style={{ backgroundColor: color }}
        >
          <span>{moment.cta || 'VIEW LEADERBOARD'}</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
