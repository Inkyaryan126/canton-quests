'use client';

import React, { useEffect } from 'react';
import { KeyRound, ArrowRight, Lock, LockOpen, Trophy } from 'lucide-react';
import { ThreeLocksFragmentMoment, ThreeLocksCompleteMoment } from '@/lib/game-effects';
import HudParticlesCanvas from './HudParticlesCanvas';
import { cqSoundManager } from '@/lib/audio';

interface ThreeLocksFragmentEffectProps {
  moment: ThreeLocksFragmentMoment | ThreeLocksCompleteMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

const PATH_COLOR_HEX: Record<string, string> = {
  crimson: '#dc2626',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
};

const LOCK_LABELS: Record<'mark' | 'code' | 'word', string> = {
  mark: 'THE MARK',
  code: 'THE CODE',
  word: 'THE WORD',
};

/**
 * Renders both the single-fragment reveal (three-locks-fragment: MARK,
 * CODE, or WORD individually) and the larger "all three owned" ceremony
 * (three-locks-complete) — one reusable template, not two separate
 * components, since they're the same visual family at two scales.
 * Progress is always driven by the player's actual persisted collectible
 * ownership (locksOwned), passed in by the caller from server-confirmed
 * data — never assumed on the frontend.
 */
export default function ThreeLocksFragmentEffect({
  moment,
  onDismiss,
  reducedMotion = false,
}: ThreeLocksFragmentEffectProps) {
  const isComplete = moment.type === 'three-locks-complete';
  const color = PATH_COLOR_HEX[(moment.pathColor || 'amber').toLowerCase()] || PATH_COLOR_HEX.amber;
  const locksOwned = isComplete ? { mark: true, code: true, word: true } : moment.locksOwned;

  useEffect(() => {
    cqSoundManager.play(isComplete ? 'finale_qualified' : 'secret_reveal');
  }, [isComplete]);

  const locks: Array<'mark' | 'code' | 'word'> = ['mark', 'code', 'word'];

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
    >
      <HudParticlesCanvas mode="gold-embers" color={color} count={isComplete ? 60 : undefined} reducedMotion={reducedMotion} />

      <div
        className="relative z-10 max-w-md w-full max-h-[90vh] overflow-y-auto bg-[#07090e]/95 border-2 rounded-3xl p-6 sm:p-8 text-center space-y-6"
        style={{ borderColor: color, boxShadow: `0 0 60px ${color}80` }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ boxShadow: `inset 0 0 90px ${color}55` }}
        />

        <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
          {isComplete && !reducedMotion && (
            <div className="absolute inset-0 rounded-full border" style={{ borderColor: color }} />
          )}
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl border-2 flex items-center justify-center"
            style={{ borderColor: color, background: `${color}22` }}
          >
            {isComplete ? <Trophy size={34} style={{ color }} /> : <KeyRound size={30} style={{ color }} />}
          </div>
        </div>

        <div className="relative space-y-1">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-widest border"
            style={{ borderColor: color, color, backgroundColor: `${color}22` }}
          >
            <span>{moment.headline}</span>
          </div>
          <h2 className={`font-black font-display text-white tracking-tight leading-snug drop-shadow-md ${isComplete ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`}>
            {moment.primaryText}
          </h2>
          {moment.secondaryText && (
            <p className="text-xs text-stone-300 font-mono uppercase tracking-wider">{moment.secondaryText}</p>
          )}
        </div>

        {/* Three Locks progress — always reflects actual owned collectibles, never a frontend guess */}
        <div className="relative flex items-center justify-center gap-3">
          {locks.map((lock) => {
            const owned = locksOwned[lock];
            return (
              <div
                key={lock}
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border ${
                  owned ? '' : 'border-stone-800 bg-stone-950/50 opacity-60'
                }`}
                style={owned ? { borderColor: color, backgroundColor: `${color}18` } : undefined}
              >
                {owned ? (
                  <LockOpen size={16} style={{ color }} />
                ) : (
                  <Lock size={16} className="text-stone-600" />
                )}
                <span className={`text-[9px] font-mono font-bold ${owned ? 'text-white' : 'text-stone-600'}`}>
                  {LOCK_LABELS[lock]}
                </span>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="relative w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider text-black flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer hover:brightness-110 min-h-[48px]"
          style={{ backgroundColor: color }}
        >
          <span>CONTINUE</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
