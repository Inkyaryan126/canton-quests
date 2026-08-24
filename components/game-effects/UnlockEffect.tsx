'use client';

import React, { useEffect } from 'react';
import { Gem, KeyRound, ArrowRight } from 'lucide-react';
import { UnlockMoment } from '@/lib/game-effects';
import HudParticlesCanvas from './HudParticlesCanvas';
import { cqSoundManager } from '@/lib/audio';

interface UnlockEffectProps {
  moment: UnlockMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

const KIND_CONFIG = {
  collectible: { icon: Gem, label: 'COLLECTIBLE FOUND', color: '#06b6d4', sound: 'badge_unlock' as const },
  secret: { icon: KeyRound, label: 'SECRET UNLOCKED', color: '#8b5cf6', sound: 'secret_reveal' as const },
};

const RARITY_LABEL: Record<string, string> = {
  common: 'COMMON',
  rare: 'RARE',
  legendary: 'LEGENDARY',
};

/**
 * UNLOCK template family — collectibles and secret-quest unlocks (badges
 * already have their own home: components/game-effects/AchievementEffect.tsx,
 * triggered as GameMomentType 'achievement' — not duplicated here).
 */
export default function UnlockEffect({ moment, onDismiss, reducedMotion = false }: UnlockEffectProps) {
  const config = KIND_CONFIG[moment.kind];
  const Icon = config.icon;
  const color = moment.pathColor && /^#/.test(moment.pathColor) ? moment.pathColor : config.color;

  useEffect(() => {
    cqSoundManager.play(config.sound);
  }, [config.sound]);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
    >
      <HudParticlesCanvas mode="cryptic-glyphs" color={color} reducedMotion={reducedMotion} />

      <div
        className="relative z-10 max-w-md w-full max-h-[90vh] overflow-y-auto bg-[#07090e]/95 border-2 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl"
        style={{ borderColor: color, boxShadow: `0 0 50px ${color}55` }}
      >
        <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
          {!reducedMotion && <div className="absolute inset-0 rounded-full border animate-ping" style={{ borderColor: color }} />}
          <div className="w-16 h-16 rounded-3xl border-2 flex items-center justify-center" style={{ borderColor: color, background: `${color}22` }}>
            <Icon size={28} style={{ color }} />
          </div>
        </div>

        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-black uppercase tracking-widest px-3 py-1 rounded-full border" style={{ borderColor: color, color, backgroundColor: `${color}18` }}>
            {config.label}
            {moment.rarity && <span className="opacity-70">· {RARITY_LABEL[moment.rarity]}</span>}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight">{moment.headline}</h2>
        </div>

        {moment.primaryText && <p className="text-base text-white font-body">{moment.primaryText}</p>}
        {moment.secondaryText && <p className="text-xs text-stone-300 font-mono leading-relaxed">{moment.secondaryText}</p>}

        {moment.xpAmount !== undefined && moment.xpAmount > 0 && (
          <div className="inline-block py-2 px-4 rounded-xl border" style={{ borderColor: `${color}55`, backgroundColor: `${color}12` }}>
            <span className="font-display font-black text-xl" style={{ color }}>+{moment.xpAmount} XP</span>
          </div>
        )}

        <button
          type="button"
          onClick={onDismiss}
          className="w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider text-black flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer hover:brightness-110 min-h-[48px]"
          style={{ backgroundColor: color }}
        >
          <span>{moment.cta || 'CONTINUE'}</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
