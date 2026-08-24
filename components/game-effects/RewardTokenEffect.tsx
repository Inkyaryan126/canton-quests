'use client';

import React, { useEffect } from 'react';
import { Zap, Ticket, Flag, ArrowRight } from 'lucide-react';
import { RewardTokenMoment } from '@/lib/game-effects';
import HudParticlesCanvas from './HudParticlesCanvas';
import { cqSoundManager } from '@/lib/audio';

interface RewardTokenEffectProps {
  moment: RewardTokenMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

const KIND_CONFIG = {
  xp: { icon: Zap, label: 'XP AWARDED', color: '#f59e0b', sound: 'xp_gain' as const },
  'entry-token': { icon: Ticket, label: 'ENTRY TOKEN RECEIVED', color: '#a855f7', sound: 'xp_gain' as const },
  'race-bonus': { icon: Flag, label: 'RACE BONUS', color: '#ef4444', sound: 'xp_gain' as const },
};

/**
 * REWARD / TOKEN template family — XP awards, prize-drawing entry tokens,
 * and race-placement bonuses all share this one reusable "tangible token"
 * reveal, distinguished only by `moment.kind`. Every number shown is
 * exactly what the server already granted (xpAmount/entryCount) — this
 * component never computes a reward amount itself.
 */
export default function RewardTokenEffect({ moment, onDismiss, reducedMotion = false }: RewardTokenEffectProps) {
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
      <HudParticlesCanvas mode="xp-burst" color={color} reducedMotion={reducedMotion} />

      <div
        className="relative z-10 max-w-sm w-full max-h-[90vh] overflow-y-auto bg-[#07090e]/95 border-2 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl"
        style={{ borderColor: color, boxShadow: `0 0 50px ${color}55` }}
      >
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          {!reducedMotion && <div className="absolute inset-0 rounded-full border" style={{ borderColor: color }} />}
          <div className="w-14 h-14 rounded-2xl border-2 flex items-center justify-center" style={{ borderColor: color, background: `${color}22` }}>
            <Icon size={26} style={{ color }} />
          </div>
        </div>

        <div className="space-y-1">
          <span className="inline-block text-[10px] font-mono font-black uppercase tracking-widest px-3 py-1 rounded-full border" style={{ borderColor: color, color, backgroundColor: `${color}18` }}>
            {config.label}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight">{moment.headline}</h2>
          {moment.secondaryText && <p className="text-xs text-stone-300 font-mono">{moment.secondaryText}</p>}
        </div>

        {(moment.xpAmount !== undefined || moment.entryCount !== undefined) && (
          <div className="py-3 px-4 rounded-2xl border flex items-center justify-center gap-6" style={{ borderColor: `${color}55`, backgroundColor: `${color}12` }}>
            {moment.xpAmount !== undefined && (
              <div>
                <span className="text-[10px] font-mono text-stone-400 uppercase block">XP</span>
                <span className="font-display font-black text-3xl" style={{ color }}>+{moment.xpAmount}</span>
              </div>
            )}
            {moment.entryCount !== undefined && (
              <div>
                <span className="text-[10px] font-mono text-stone-400 uppercase block">Entries</span>
                <span className="font-display font-black text-3xl" style={{ color }}>+{moment.entryCount}</span>
              </div>
            )}
          </div>
        )}

        {moment.primaryText && <p className="text-sm text-stone-200 font-mono">{moment.primaryText}</p>}

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
