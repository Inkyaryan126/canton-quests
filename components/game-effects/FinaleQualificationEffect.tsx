'use client';

import React, { useEffect } from 'react';
import { Ticket, ShieldCheck, Trophy, Sparkles, ArrowRight, Lock } from 'lucide-react';
import { FinaleQualifiedMoment } from '@/lib/game-effects';
import HudParticlesCanvas from './HudParticlesCanvas';
import { proceduralSoundEngine } from '@/lib/game-audio';

interface FinaleQualificationEffectProps {
  moment: FinaleQualifiedMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

export default function FinaleQualificationEffect({
  moment,
  onDismiss,
  reducedMotion = false,
}: FinaleQualificationEffectProps) {
  useEffect(() => {
    proceduralSoundEngine.playFinaleQualified();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl select-none"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
    >
      <HudParticlesCanvas
        mode="gold-embers"
        color="#f0c978"
        count={55}
        reducedMotion={reducedMotion}
      />

      {/* Screen edge glow */}
      {!reducedMotion && (
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(240,201,120,0.45)]" />
      )}

      {/* Main HUD Card */}
      <div className="relative z-10 max-w-md w-full bg-[#050607]/98 border-2 border-[#f0c978] rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-[0_0_80px_rgba(240,201,120,0.5)] overflow-hidden">
        {/* Top Trophy / Ticket Icon */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-[#f0c978]/40 animate-ping" />
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#f0c978]/30 via-amber-500/20 to-transparent border-2 border-[#f0c978] flex items-center justify-center text-[#f0c978] shadow-[0_0_30px_rgba(240,201,120,0.6)]">
            <Trophy size={32} />
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-[11px] font-mono font-black uppercase tracking-widest bg-amber-950/80 border border-[#f0c978]/60 text-[#f0c978]">
            <ShieldCheck size={14} />
            <span>OFFICIAL FINALE DRAWING</span>
          </div>

          <h2
            className="text-3xl sm:text-4xl font-black font-display text-white tracking-tight uppercase"
            style={{ textShadow: '0 0 25px rgba(240, 201, 120, 0.7)' }}
          >
            QUALIFIED
          </h2>
          <p className="text-xs text-stone-300 font-mono">
            {moment.eventTitle || 'Canton Quests: Volume 1 — The Founder’s Cipher'}
          </p>
        </div>

        {/* Authoritative Ticket Pool Summary Card */}
        <div className="p-4 bg-gradient-to-b from-amber-950/40 to-stone-950/90 border border-[#f0c978]/40 rounded-2xl space-y-2 text-left">
          <div className="flex items-center justify-between text-xs font-mono text-stone-300">
            <span>QUALIFIED TICKETS:</span>
            <span className="text-lg font-extrabold text-[#f0c978] font-mono">
              {moment.qualifiedEntries} TICKET{moment.qualifiedEntries === 1 ? '' : 'S'}
            </span>
          </div>

          {moment.playerLabel && (
            <div className="flex items-center justify-between text-xs font-mono text-stone-400 pt-1 border-t border-stone-800">
              <span>CALLSIGN:</span>
              <span className="text-white font-bold">{moment.playerLabel}</span>
            </div>
          )}

          {moment.snapshotHash && (
            <div className="pt-2 border-t border-stone-800 text-[10px] font-mono text-stone-400 break-all">
              <div className="flex items-center gap-1 text-cyan-300 font-bold mb-0.5">
                <Lock size={11} />
                <span>SHA-256 LEDGER PROOF:</span>
              </div>
              <span className="text-stone-300">{moment.snapshotHash.slice(0, 36)}...</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider bg-gradient-to-r from-[#f0c978] to-[#d9a44c] text-black flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(240,201,120,0.5)] transition-transform active:scale-95 cursor-pointer hover:brightness-110"
        >
          <span>VIEW DRAWING PROJECTION</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
