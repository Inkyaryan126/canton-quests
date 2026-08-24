'use client';

import React, { useEffect } from 'react';
import { MapPin, Nfc, ArrowRight } from 'lucide-react';
import { FieldEventMoment } from '@/lib/game-effects';
import HudParticlesCanvas from './HudParticlesCanvas';
import { cqSoundManager } from '@/lib/audio';

interface FieldEventEffectProps {
  moment: FieldEventMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

const KIND_CONFIG = {
  'field-confirmed': { icon: MapPin, label: 'FIELD PRESENCE CONFIRMED', color: '#22c55e', sound: 'node_ping' as const },
  'nfc-cache': { icon: Nfc, label: 'SIGNAL ACQUIRED', color: '#06b6d4', sound: 'node_ping' as const },
};

/**
 * FIELD EVENT template family — GPS field-bonus confirmations and NFC
 * cache discoveries. Both are "you were physically here" moments, so they
 * share one reveal shape. The reward amount shown is always the amount the
 * reward-grant transaction actually returned — this component is never the
 * thing that decides a field/NFC bonus was earned.
 */
export default function FieldEventEffect({ moment, onDismiss, reducedMotion = false }: FieldEventEffectProps) {
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
      <HudParticlesCanvas mode="city-nodes" color={color} reducedMotion={reducedMotion} />

      <div
        className="relative z-10 max-w-sm w-full max-h-[90vh] overflow-y-auto bg-[#07090e]/95 border-2 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl"
        style={{ borderColor: color, boxShadow: `0 0 50px ${color}55` }}
      >
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl border-2 flex items-center justify-center" style={{ borderColor: color, background: `${color}22` }}>
            <Icon size={26} style={{ color }} />
          </div>
        </div>

        <div className="space-y-1">
          <span className="inline-block text-[10px] font-mono font-black uppercase tracking-widest px-3 py-1 rounded-full border" style={{ borderColor: color, color, backgroundColor: `${color}18` }}>
            {config.label}
          </span>
          <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight">{moment.headline}</h2>
        </div>

        {moment.xpAmount !== undefined && moment.xpAmount > 0 && (
          <div className="inline-block py-2 px-5 rounded-xl border" style={{ borderColor: `${color}55`, backgroundColor: `${color}12` }}>
            <span className="font-display font-black text-2xl" style={{ color }}>+{moment.xpAmount} XP</span>
          </div>
        )}

        {moment.progress && (
          <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">
            {moment.progress.label ? `${moment.progress.label} ` : ''}
            {moment.progress.current.toString().padStart(2, '0')} / {moment.progress.total.toString().padStart(2, '0')}
          </p>
        )}

        {moment.secondaryText && <p className="text-xs text-stone-300 font-mono leading-relaxed">{moment.secondaryText}</p>}

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
