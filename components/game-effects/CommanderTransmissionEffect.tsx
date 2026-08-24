'use client';

import { useEffect } from 'react';
import { Radio, ArrowRight, FastForward } from 'lucide-react';
import { CommanderTransmissionMoment } from '@/lib/game-effects';
import CommanderMedia from '../commander/CommanderMedia';
import { cqSoundManager } from '@/lib/audio';
import { resolveTransmissionCta, isTransmissionSkippable } from '@/lib/commander-transmission-utils';

interface CommanderTransmissionEffectProps {
  moment: CommanderTransmissionMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

/**
 * The cinematic, full-screen "INCOMING TRANSMISSION" reveal — reusable
 * across every trigger (sector intro, quest intro/milestone/completion,
 * hidden quest discovery, NFC cache discovery, GM live announcements,
 * Three Locks fragment recovery, finale beats, leaderboard milestones).
 * Nothing here is Challenge-sector-specific; all copy/media comes from the
 * `transmission` payload.
 */
export default function CommanderTransmissionEffect({ moment, onDismiss, reducedMotion = false }: CommanderTransmissionEffectProps) {
  const { transmission } = moment;
  const skippable = isTransmissionSkippable(transmission);
  const cta = resolveTransmissionCta(transmission);

  useEffect(() => {
    cqSoundManager.play('transmission');
  }, []);

  const handleContinue = () => {
    moment.onContinue?.();
    onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
      aria-label="Commander transmission"
    >
      <div className="relative z-10 max-w-lg w-full max-h-[90vh] overflow-y-auto bg-[#07090e]/97 border-2 border-amber-500/60 rounded-2xl shadow-[0_0_60px_rgba(245,158,11,0.25)]">
        {/* Header HUD */}
        <div className="flex items-center justify-between px-4 py-3 bg-stone-950/90 border-b border-amber-500/30 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full bg-red-500 ${reducedMotion ? '' : 'animate-pulse'}`} aria-hidden="true" />
            <span className="text-[10px] sm:text-xs font-mono font-black text-amber-300 uppercase tracking-widest">
              Incoming Transmission
            </span>
          </div>
          <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider flex items-center gap-1">
            <Radio size={11} />
            Commander // CQ
          </span>
        </div>

        <CommanderMedia transmission={transmission} variant="cinematic" />

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 text-center">
          {transmission.headline && (
            <span className="inline-block text-[10px] sm:text-[11px] font-mono font-black uppercase tracking-widest text-amber-300 bg-amber-950/50 border border-amber-500/40 rounded-full px-3 py-1">
              {transmission.headline}
            </span>
          )}

          <p className="text-base sm:text-lg text-white font-body leading-relaxed italic">
            &ldquo;{transmission.message}&rdquo;
          </p>

          {skippable && (
            <button
              type="button"
              onClick={handleContinue}
              className="w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-black flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition-transform active:scale-95 cursor-pointer hover:brightness-110 min-h-[48px]"
            >
              <span>{cta}</span>
              <ArrowRight size={17} />
            </button>
          )}

          {!skippable && (
            <span className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-stone-500 uppercase tracking-wider">
              <FastForward size={11} />
              Transmission in progress
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
