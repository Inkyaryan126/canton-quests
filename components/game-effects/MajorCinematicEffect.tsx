'use client';

import React, { useEffect } from 'react';
import { Gift, Crown, ArrowRight } from 'lucide-react';
import { MajorCinematicMoment } from '@/lib/game-effects';
import HudParticlesCanvas from './HudParticlesCanvas';
import { cqSoundManager } from '@/lib/audio';

interface MajorCinematicEffectProps {
  moment: MajorCinematicMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

const KIND_CONFIG = {
  'prize-win': { icon: Gift, label: 'PRIZE AWARDED', color: '#fbbf24' },
  'city-legend': { icon: Crown, label: 'CITY LEGEND', color: '#f0c978' },
};

/**
 * MAJOR CINEMATIC template family — the top-tier ceremony tier, reserved
 * for prize winners and City Legend recognition. Finale qualification
 * already has its own dedicated ceremony (FinaleQualificationEffect /
 * GameMomentType 'finale-qualified') and isn't duplicated here, though it
 * shares this family's visual scale (full gold particle field, largest
 * headline size in the system).
 *
 * This must only ever be triggered from real, server-confirmed results
 * (a completed prize draw, a confirmed leaderboard/finale outcome) — never
 * from client-side guesses about who won.
 */
export default function MajorCinematicEffect({ moment, onDismiss, reducedMotion = false }: MajorCinematicEffectProps) {
  const config = KIND_CONFIG[moment.kind];
  const Icon = config.icon;
  const color = moment.pathColor && /^#/.test(moment.pathColor) ? moment.pathColor : config.color;

  useEffect(() => {
    cqSoundManager.play('finale_qualified');
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl select-none"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
    >
      <HudParticlesCanvas mode="gold-embers" color={color} count={60} reducedMotion={reducedMotion} />

      {!reducedMotion && (
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 150px ${color}55` }} />
      )}

      <div
        className="relative z-10 max-w-md w-full max-h-[90vh] overflow-y-auto bg-[#050607]/98 border-2 rounded-3xl p-6 sm:p-8 text-center space-y-6"
        style={{ borderColor: color, boxShadow: `0 0 80px ${color}66` }}
      >
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          {!reducedMotion && <div className="absolute inset-0 rounded-full border animate-ping" style={{ borderColor: color }} />}
          <div className="w-16 h-16 rounded-3xl border-2 flex items-center justify-center" style={{ borderColor: color, background: `${color}22` }}>
            <Icon size={32} style={{ color }} />
          </div>
        </div>

        <div className="space-y-1">
          <span className="inline-block text-[11px] font-mono font-black uppercase tracking-widest px-3.5 py-1 rounded-full border" style={{ borderColor: color, color, backgroundColor: `${color}18` }}>
            {config.label}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black font-display text-white tracking-tight uppercase" style={{ textShadow: `0 0 20px ${color}88` }}>
            {moment.headline}
          </h2>
          {moment.secondaryText && <p className="text-xs text-stone-300 font-mono">{moment.secondaryText}</p>}
        </div>

        {(moment.primaryText || moment.xpAmount !== undefined || moment.entryCount !== undefined) && (
          <div className="p-4 rounded-2xl border text-left space-y-2" style={{ borderColor: `${color}44`, backgroundColor: `${color}0d` }}>
            {moment.primaryText && <p className="text-sm text-white font-bold">{moment.primaryText}</p>}
            {moment.xpAmount !== undefined && (
              <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: `${color}33` }}>
                <span className="text-[10px] font-mono text-stone-400 uppercase">XP Awarded</span>
                <span className="font-display font-black text-lg" style={{ color }}>+{moment.xpAmount}</span>
              </div>
            )}
            {moment.entryCount !== undefined && (
              <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: `${color}33` }}>
                <span className="text-[10px] font-mono text-stone-400 uppercase">Entries</span>
                <span className="font-display font-black text-lg" style={{ color }}>+{moment.entryCount}</span>
              </div>
            )}
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
