'use client';

import React, { useEffect } from 'react';
import { ShieldAlert, Trophy, Lock, ArrowRight } from 'lucide-react';
import { FinaleQualifiedMoment } from '@/lib/game-effects';
import HudParticlesCanvas from './HudParticlesCanvas';
import SystemStatusBadge from './SystemStatusBadge';
import { cqSoundManager } from '@/lib/audio';
import { useReducedMotion, confirmHaptic } from '@/lib/motion';

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
  const systemReduced = useReducedMotion();
  const isReduced = reducedMotion || systemReduced;

  const accentColor = isQualified ? '#f0c978' : '#94a3b8';

  useEffect(() => {
    if (isQualified) {
      cqSoundManager.play('finale_qualified');
      confirmHaptic({ enabled: true });
    } else {
      cqSoundManager.play('scan');
    }
  }, [isQualified]);

  const handleDismiss = () => {
    cqSoundManager.play('ui_confirm');
    onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 select-none"
      style={{
        backgroundColor: 'rgba(3, 5, 7, 0.96)',
        backdropFilter: isReduced ? 'none' : 'blur(16px)',
        WebkitBackdropFilter: isReduced ? 'none' : 'blur(16px)',
      }}
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
    >
      <HudParticlesCanvas
        mode="gold-embers"
        color={accentColor}
        count={isQualified ? (isReduced ? 16 : 55) : (isReduced ? 8 : 24)}
        reducedMotion={isReduced}
      />

      {/* Screen edge vignette glow */}
      {!isReduced && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: isQualified
              ? 'inset 0 0 140px rgba(240, 201, 120, 0.35)'
              : 'inset 0 0 100px rgba(148, 163, 184, 0.18)',
          }}
        />
      )}

      {/* Main HUD Card */}
      <div
        className="relative z-10 max-w-md w-full rounded-2xl p-6 sm:p-8 text-center overflow-hidden"
        style={{
          backgroundColor: '#06090c',
          border: `1.5px solid ${isQualified ? 'rgba(240, 201, 120, 0.7)' : 'rgba(148, 163, 184, 0.4)'}`,
          boxShadow: isReduced
            ? 'none'
            : isQualified
            ? '0 0 50px rgba(240, 201, 120, 0.35), inset 0 1px 0 rgba(240, 201, 120, 0.3)'
            : '0 0 35px rgba(148, 163, 184, 0.15)',
        }}
      >
        {/* Top Trophy / Shield Icon */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center mb-2">
          {isQualified ? (
            <>
              {!isReduced && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: '1.5px solid rgba(240, 201, 120, 0.4)',
                    animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                  }}
                />
              )}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-[#f0c978]"
                style={{
                  backgroundColor: 'rgba(240, 201, 120, 0.12)',
                  border: '2px solid #f0c978',
                  boxShadow: isReduced ? 'none' : '0 0 25px rgba(240, 201, 120, 0.5)',
                }}
              >
                <Trophy size={32} />
              </div>
            </>
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-slate-400"
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.6)',
                border: '2px solid rgba(148, 163, 184, 0.4)',
              }}
            >
              <ShieldAlert size={32} />
            </div>
          )}
        </div>

        {/* Status Badge & Headline */}
        <div className="space-y-2 mb-5">
          <div className="flex justify-center">
            <SystemStatusBadge
              status={isQualified ? 'confirmed' : 'denied'}
              label={isQualified ? 'OFFICIAL FINALE DRAWING: QUALIFIED' : 'OFFICIAL FINALE DRAWING: STANDBY'}
              size="sm"
            />
          </div>

          <h2
            className="text-2xl sm:text-3xl font-black font-display tracking-tight uppercase"
            style={{
              color: isQualified ? '#ffffff' : '#e2e8f0',
              textShadow: isQualified && !isReduced ? '0 0 20px rgba(240, 201, 120, 0.6)' : undefined,
            }}
          >
            {isQualified ? 'QUALIFIED FOR FINALE' : 'NOT YET QUALIFIED'}
          </h2>

          <p className="text-xs text-stone-400 font-mono">
            {moment.eventTitle || 'Canton Quests: Volume 1 — The Founder’s Cipher'}
          </p>
        </div>

        {/* Authoritative Ticket Pool Summary Card */}
        <div
          className="p-4 rounded-xl space-y-2.5 text-left mb-6"
          style={{
            backgroundColor: isQualified ? 'rgba(30, 20, 10, 0.7)' : 'rgba(15, 23, 42, 0.6)',
            border: `1px solid ${isQualified ? 'rgba(240, 201, 120, 0.35)' : 'rgba(51, 65, 85, 0.7)'}`,
          }}
        >
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-stone-400 font-bold uppercase tracking-wider">
              {isQualified ? 'QUALIFIED TICKETS:' : 'DRAWING ENTRIES:'}
            </span>
            <span
              className="text-base font-extrabold font-mono"
              style={{ color: isQualified ? '#f0c978' : '#94a3b8' }}
            >
              {moment.qualifiedEntries} TICKET{moment.qualifiedEntries === 1 ? '' : 'S'}
            </span>
          </div>

          {moment.playerLabel && (
            <div
              className="flex items-center justify-between text-xs font-mono pt-2"
              style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
            >
              <span className="text-stone-400 uppercase tracking-wider">CALLSIGN:</span>
              <span className="text-white font-bold">{moment.playerLabel}</span>
            </div>
          )}

          {moment.ticketRange && (
            <div
              className="flex items-center justify-between text-xs font-mono pt-2"
              style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
            >
              <span className="text-stone-400 uppercase tracking-wider">
                {isQualified ? 'ASSIGNED TICKETS:' : 'STATUS:'}
              </span>
              <span
                className="font-bold font-mono text-xs"
                style={{ color: isQualified ? '#f0c978' : '#cbd5e1' }}
              >
                {moment.ticketRange}
              </span>
            </div>
          )}

          {!isQualified && (
            <div
              className="pt-2.5 text-[11px] font-mono leading-relaxed"
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#fcd34d',
              }}
            >
              Complete at least 1 verified quest in Canton to earn drawing tickets and qualify for the grand finale.
            </div>
          )}

          {moment.snapshotHash && (
            <div
              className="pt-2 text-[10px] font-mono text-stone-400 break-all"
              style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
            >
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
          onClick={handleDismiss}
          className="w-full py-3.5 px-5 rounded-xl font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
          style={{
            backgroundColor: isQualified ? '#f0c978' : '#334155',
            color: isQualified ? '#000000' : '#ffffff',
            boxShadow: isQualified && !isReduced ? '0 4px 20px rgba(240, 201, 120, 0.4)' : 'none',
            border: isQualified ? 'none' : '1px solid rgba(148, 163, 184, 0.3)',
          }}
        >
          <span>{isQualified ? 'VIEW DRAWING PROJECTION' : 'CLOSE STATUS'}</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
