'use client';

import React, { useEffect } from 'react';
import { Ticket, ShieldCheck, ShieldAlert, Trophy, Sparkles, ArrowRight, Lock, Clock } from 'lucide-react';
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
  const isQualified = (moment.qualifiedEntries ?? 0) > 0;

  useEffect(() => {
    if (isQualified) {
      proceduralSoundEngine.playFinaleQualified();
    } else {
      proceduralSoundEngine.playCityScan();
    }
  }, [isQualified]);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl select-none"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
    >
      <HudParticlesCanvas
        mode="gold-embers"
        color={isQualified ? '#f0c978' : '#94a3b8'}
        count={isQualified ? 55 : 24}
        reducedMotion={reducedMotion}
      />

      {/* Screen edge glow */}
      {!reducedMotion && (
        <div
          className={`absolute inset-0 pointer-events-none ${
            isQualified
              ? 'shadow-[inset_0_0_150px_rgba(240,201,120,0.45)]'
              : 'shadow-[inset_0_0_120px_rgba(148,163,184,0.25)]'
          }`}
        />
      )}

      {/* Main HUD Card */}
      <div
        className={`relative z-10 max-w-md w-full bg-[#050607]/98 border-2 rounded-3xl p-6 sm:p-8 text-center space-y-6 overflow-hidden ${
          isQualified
            ? 'border-[#f0c978] shadow-[0_0_80px_rgba(240,201,120,0.5)]'
            : 'border-slate-700 shadow-[0_0_60px_rgba(148,163,184,0.25)]'
        }`}
      >
        {/* Top Trophy / Shield Icon */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          {isQualified ? (
            <>
              <div className="absolute inset-0 rounded-full border border-[#f0c978]/40 animate-ping" />
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#f0c978]/30 via-amber-500/20 to-transparent border-2 border-[#f0c978] flex items-center justify-center text-[#f0c978] shadow-[0_0_30px_rgba(240,201,120,0.6)]">
                <Trophy size={32} />
              </div>
            </>
          ) : (
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border-2 border-slate-700 flex items-center justify-center text-slate-400 shadow-[0_0_20px_rgba(148,163,184,0.3)]">
              <ShieldAlert size={32} />
            </div>
          )}
        </div>

        {/* Headline */}
        <div className="space-y-2">
          <div
            className={`inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-[11px] font-mono font-black uppercase tracking-widest ${
              isQualified
                ? 'bg-amber-950/80 border border-[#f0c978]/60 text-[#f0c978]'
                : 'bg-slate-900/90 border border-slate-700 text-slate-400'
            }`}
          >
            {isQualified ? <ShieldCheck size={14} /> : <Clock size={14} />}
            <span>{isQualified ? 'OFFICIAL FINALE DRAWING' : 'OFFICIAL FINALE DRAWING: STANDBY'}</span>
          </div>

          <h2
            className={`text-3xl sm:text-4xl font-black font-display tracking-tight uppercase ${
              isQualified ? 'text-white' : 'text-slate-200'
            }`}
            style={isQualified ? { textShadow: '0 0 25px rgba(240, 201, 120, 0.7)' } : undefined}
          >
            {isQualified ? 'QUALIFIED' : 'NOT YET QUALIFIED'}
          </h2>
          <p className="text-xs text-stone-300 font-mono">
            {moment.eventTitle || 'Canton Quests: Volume 1 — The Founder’s Cipher'}
          </p>
        </div>

        {/* Authoritative Ticket Pool Summary Card */}
        <div
          className={`p-4 rounded-2xl space-y-2 text-left border ${
            isQualified
              ? 'bg-gradient-to-b from-amber-950/40 to-stone-950/90 border-[#f0c978]/40'
              : 'bg-slate-950/90 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-stone-300">
            <span>QUALIFIED TICKETS:</span>
            <span
              className={`text-lg font-extrabold font-mono ${
                isQualified ? 'text-[#f0c978]' : 'text-slate-400'
              }`}
            >
              {moment.qualifiedEntries} TICKET{moment.qualifiedEntries === 1 ? '' : 'S'}
            </span>
          </div>

          {moment.playerLabel && (
            <div className="flex items-center justify-between text-xs font-mono text-stone-400 pt-1 border-t border-stone-800">
              <span>CALLSIGN:</span>
              <span className="text-white font-bold">{moment.playerLabel}</span>
            </div>
          )}

          {moment.ticketRange && (
            <div
              className={`flex items-center justify-between text-xs font-mono pt-1 border-t border-stone-800 ${
                isQualified ? 'text-amber-300' : 'text-slate-400'
              }`}
            >
              <span>{isQualified ? 'ASSIGNED TICKETS:' : 'STATUS:'}</span>
              <span
                className={`font-bold font-mono ${
                  isQualified ? 'text-[#f0c978]' : 'text-slate-300 text-[11px]'
                }`}
              >
                {moment.ticketRange}
              </span>
            </div>
          )}

          {!isQualified && (
            <div className="pt-2 border-t border-stone-800 text-[11px] font-mono text-amber-300/90 leading-relaxed">
              Complete at least 1 verified quest in Canton to earn drawing tickets and qualify for the grand finale.
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
          className={`w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer hover:brightness-110 ${
            isQualified
              ? 'bg-gradient-to-r from-[#f0c978] to-[#d9a44c] text-black shadow-[0_4px_25px_rgba(240,201,120,0.5)]'
              : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
          }`}
        >
          <span>{isQualified ? 'VIEW DRAWING PROJECTION' : 'CLOSE STATUS'}</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
