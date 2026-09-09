'use client';

import React, { useState } from 'react';
import { Radio, AlertTriangle, Eye, ChevronRight } from 'lucide-react';
import TransmissionPanel from './TransmissionPanel';
import SystemStatusBadge from './SystemStatusBadge';
import HudSystemState from './HudSystemState';
import CqTransition from './CqTransition';
import { useReducedMotion } from '@/lib/motion';

export interface FrankensteinPayoffCardProps {
  className?: string;
  showInterrupt?: boolean;
  /** False for the district-unlocked story; never imply a verified cemetery visit. */
  verifiedQuest?: boolean;
}

/**
 * FrankensteinPayoffCard — Seasonal payoff presentation for the Frankenstein's grave quest
 * (qst-frankenstein-west-lawn) at West Lawn Cemetery.
 * Visibly applies Phase 2 presentation primitives:
 * - TransmissionPanel (HUD border card, purple/stone tone)
 * - SystemStatusBadge & HudSystemState (system state and accessible ARIA container)
 * - VerificationResult (success outcome confirmation)
 * - CqTransition (motion-aware reveal)
 */
export default function FrankensteinPayoffCard({
  className = '',
  showInterrupt = true,
  verifiedQuest = true,
}: FrankensteinPayoffCardProps) {
  const reducedMotion = useReducedMotion();
  const [interrupted, setInterrupted] = useState(showInterrupt);

  return (
    <CqTransition show={true} reducedMotion={reducedMotion} className={className}>
      <TransmissionPanel
        eyebrow="SEASONAL PAYOFF // WEST LAWN ARCHIVE"
        icon={interrupted ? Eye : Radio}
        tone="purple"
        action={
          <SystemStatusBadge
            status={interrupted ? 'confirmed' : 'scanning'}
            label={interrupted ? 'SIGNAL INTERCEPTED' : 'RECORDING...'}
            size="sm"
          />
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[10px] font-mono text-purple-300 font-bold tracking-wider uppercase block">
                {verifiedQuest ? 'OBJECTIVE COMPLETE // CHAPTER 1 PAYOFF' : 'DISTRICT COMPLETE // STORY ACCESS'}
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-white mt-0.5">
                Frankenstein&apos;s Quiet Signal
              </h3>
            </div>
            <HudSystemState
              state="confirmed"
              label={verifiedQuest ? 'PHOTO PROOF VERIFIED' : 'CEMETERY STORY UNLOCKED'}
              detail={verifiedQuest ? '200 XP · 1 PRIZE ENTRY' : 'FULL CIPHER PROGRESSION REMAINS SEPARATE'}
              size="sm"
              reducedMotion={reducedMotion}
            />
          </div>

          <div className="p-3.5 rounded-xl bg-[#040407] border border-purple-500/25 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 block">
              COMMANDER PROTOCOL // WEST LAWN ARCHIVE
            </span>
            <p className="text-xs text-stone-300 italic leading-relaxed">
              {verifiedQuest ? '“Record confirmed from a respectful distance. Hold... that’s not right. I’m seeing another signature attached to the file.”' : '“Your district record opened the West Lawn archive. A family name waits there: Frankenstein. Hold... another signature is attached to the file.”'}
            </p>
          </div>

          {interrupted && (
            <CqTransition show={true} reducedMotion={reducedMotion}>
              <div className="p-4 rounded-xl bg-purple-950/25 border border-purple-500/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300 font-bold flex items-center gap-1">
                    <AlertTriangle size={12} className="text-amber-400" />
                    SIGNAL INTERRUPT // UNKNOWN OBSERVER
                  </span>
                  <SystemStatusBadge status="armed" label="W-01 DETECTED" size="sm" />
                </div>
                <p className="text-xs sm:text-sm text-purple-100 italic leading-relaxed font-body">
                  {verifiedQuest ? '“You found the grave. We noticed, operative.' : '“You found the signal. We noticed, operative.'} You weren&apos;t the only one following the trail. WATCHER SIGNAL W-01: DORMANT // REACTIVATION: OCTOBER. We&apos;ll be watching.&rdquo;
                </p>
              </div>
            </CqTransition>
          )}

          <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between flex-wrap gap-3">
            <div className="text-[11px] font-mono text-purple-200/80">
              <span className="text-amber-300 font-bold">NEXT FREQUENCY:</span> DORMANT UNTIL OCTOBER
            </div>
            <button
              type="button"
              onClick={() => setInterrupted(!interrupted)}
              className="text-[11px] font-mono font-bold text-purple-400 hover:text-purple-300 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{interrupted ? 'SHOW COMMANDER PROTOCOL' : 'SHOW WATCHER INTERCEPT'}</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </TransmissionPanel>
    </CqTransition>
  );
}
