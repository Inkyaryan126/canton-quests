'use client';

import React, { useEffect } from 'react';
import { ArrowUpRight, Crown, Medal, Trophy, Sparkles, ArrowRight } from 'lucide-react';
import { RankUpMoment, RankTier } from '@/lib/game-effects';
import HudParticlesCanvas from './HudParticlesCanvas';
import { proceduralSoundEngine } from '@/lib/game-audio';

interface RankUpEffectProps {
  moment: RankUpMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

const TIER_CONFIG = {
  first: {
    badge: '👑 CITY APEX — RANK #1 ACHIEVED',
    title: 'RANK #1 OVERALL',
    sub: 'You hold the highest verified XP score in Canton!',
    color: '#fbbf24',
    bgGlow: 'rgba(251, 191, 36, 0.6)',
    icon: Crown,
  },
  top3: {
    badge: '🏆 PODIUM REACHED',
    title: 'TOP 3 CITY STANDING',
    sub: 'You have broken onto the official Canton podium!',
    color: '#f59e0b',
    bgGlow: 'rgba(245, 158, 11, 0.45)',
    icon: Trophy,
  },
  top10: {
    badge: '⭐ TOP 10 SECURED',
    title: 'TOP 10 AGENT',
    sub: 'Elite city performance ranking in the Top 10.',
    color: '#06b6d4',
    bgGlow: 'rgba(6, 182, 212, 0.4)',
    icon: Medal,
  },
  normal: {
    badge: '⚡ LEADERBOARD ADVANCEMENT',
    title: 'RANK ASCENSION',
    sub: 'Verified scoring moved you up the city leaderboard.',
    color: '#f59e0b',
    bgGlow: 'rgba(245, 158, 11, 0.3)',
    icon: ArrowUpRight,
  },
};

export default function RankUpEffect({
  moment,
  onDismiss,
  reducedMotion = false,
}: RankUpEffectProps) {
  const tier: RankTier = moment.tier || 'normal';
  const config = TIER_CONFIG[tier] || TIER_CONFIG.normal;
  const Icon = config.icon;

  useEffect(() => {
    proceduralSoundEngine.playRankUp(tier);
  }, [tier]);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
    >
      <HudParticlesCanvas
        mode="xp-burst"
        color={config.color}
        reducedMotion={reducedMotion}
      />

      {/* Main HUD Rank Card */}
      <div
        className="relative z-10 max-w-md w-full bg-[#07090e]/95 border-2 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl overflow-hidden"
        style={{
          borderColor: config.color,
          boxShadow: `0 0 60px ${config.bgGlow}`,
        }}
      >
        {/* Tier Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-widest bg-stone-900 border border-stone-700 text-stone-200">
          <Icon size={14} style={{ color: config.color }} />
          <span>{config.badge}</span>
        </div>

        {/* Big Rank Transition: #17 -> #11 */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 py-4 px-4 bg-stone-950/80 border border-stone-800 rounded-2xl">
          {/* Old Rank */}
          <div className="text-center">
            <span className="text-[10px] font-mono text-stone-400 uppercase block mb-1">PREVIOUS</span>
            <span className="font-display font-bold text-2xl sm:text-3xl text-stone-400 line-through">
              #{moment.oldRank}
            </span>
          </div>

          {/* Ascending Arrow */}
          <div className="flex flex-col items-center justify-center text-amber-400 animate-pulse">
            <ArrowUpRight size={32} style={{ color: config.color }} />
            <span className="text-[9px] font-mono font-bold tracking-tighter uppercase" style={{ color: config.color }}>
              ADVANCED
            </span>
          </div>

          {/* New Rank */}
          <div className="text-center">
            <span className="text-[10px] font-mono uppercase block mb-1 font-bold" style={{ color: config.color }}>
              NEW STANDING
            </span>
            <span
              className="font-display font-black text-4xl sm:text-5xl tracking-tight block"
              style={{
                color: config.color,
                textShadow: `0 0 20px ${config.bgGlow}`,
              }}
            >
              #{moment.newRank}
            </span>
          </div>
        </div>

        {/* Description & Detail */}
        <div className="space-y-1">
          <h3 className="text-xl font-black font-display text-white tracking-tight uppercase">
            {config.title}
          </h3>
          <p className="text-xs text-stone-300 font-mono">
            {config.sub}
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider text-black flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer hover:brightness-110"
          style={{
            backgroundColor: config.color,
            boxShadow: `0 4px 20px ${config.bgGlow}`,
          }}
        >
          <span>VIEW CITY STANDINGS</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
