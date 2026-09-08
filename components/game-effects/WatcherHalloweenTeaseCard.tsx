'use client';

import React, { useState } from 'react';
import { Eye, Radio, Sparkles, Terminal } from 'lucide-react';
import TransmissionPanel from './TransmissionPanel';
import TransmissionLoader from './TransmissionLoader';
import VerificationResult from './VerificationResult';
import SystemStatusBadge from './SystemStatusBadge';
import HudSystemState from './HudSystemState';
import CqTransition from './CqTransition';
import { useReducedMotion } from '@/lib/motion';

const WATCHER_HALLOWEEN_TEASE = {
  eyebrow: 'CLASSIFIED INTERCEPT // WATCHER SIGNAL W-01',
  headline: 'WATCHER FREQUENCY DORMANT // REACTIVATION: OCTOBER',
  interceptMessage:
    "You weren't the only one following the trail through Canton. A second signature is attached to the West Lawn record.",
  footnote: 'WATCHER STATUS: FLAGGED [W-01] · FREQUENCY DORMANT UNTIL OCTOBER',
} as const;

export interface WatcherHalloweenTeaseCardProps {
  className?: string;
  allowInteractivePing?: boolean;
}

/**
 * WatcherHalloweenTeaseCard — Seasonal payoff moment for the Watchers October Halloween campaign.
 * Built with the canonical Phase 2 presentation primitives:
 * - TransmissionPanel (HUD border chrome with purple tone)
 * - SystemStatusBadge & HudSystemState (tactical status pill and accessible ARIA container)
 * - TransmissionLoader (deterministic signal decode-bar loading state)
 * - VerificationResult (shared success/failure moment)
 * - CqTransition (CSS motion tokens reveal)
 */
export default function WatcherHalloweenTeaseCard({
  className = '',
  allowInteractivePing = true,
}: WatcherHalloweenTeaseCardProps) {
  const reducedMotion = useReducedMotion();
  const [isIntercepted, setIsIntercepted] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);

  const handleInterceptToggle = () => {
    if (isIntercepted) {
      setIsIntercepted(false);
      setIsDecoding(false);
      return;
    }

    if (reducedMotion) {
      setIsIntercepted(true);
      return;
    }

    setIsDecoding(true);
    setTimeout(() => {
      setIsDecoding(false);
      setIsIntercepted(true);
    }, 600);
  };

  return (
    <CqTransition show={true} reducedMotion={reducedMotion} className={className}>
      <TransmissionPanel
        eyebrow={WATCHER_HALLOWEEN_TEASE.eyebrow}
        icon={Eye}
        tone="purple"
        action={
          <SystemStatusBadge
            status={isIntercepted ? 'confirmed' : 'scanning'}
            label={isIntercepted ? 'INTERCEPT ACTIVE' : 'DORMANT // OCT'}
            size="sm"
          />
        }
      >
        <div className="space-y-3">
          <div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Sparkles size={18} className="text-purple-400 shrink-0" aria-hidden="true" />
              <span>{WATCHER_HALLOWEEN_TEASE.headline}</span>
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed mt-2">
              {WATCHER_HALLOWEEN_TEASE.interceptMessage}
            </p>
          </div>

          <div className="pt-2 border-t border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <HudSystemState
              state={isIntercepted ? 'confirmed' : 'armed'}
              label="NODE: WEST LAWN CEMETERY"
              detail="FLAGGED [W-01]"
              size="sm"
              reducedMotion={reducedMotion}
            />

            {allowInteractivePing && (
              <div>
                {isDecoding ? (
                  <TransmissionLoader
                    label="DECODING PASSIVE FREQUENCY..."
                    size="sm"
                    reducedMotion={reducedMotion}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={handleInterceptToggle}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase border border-purple-400/50 bg-purple-950/40 text-purple-300 hover:bg-purple-900/50 hover:text-white transition-colors cursor-pointer"
                  >
                    <Radio size={12} className="text-purple-400" />
                    <span>{isIntercepted ? 'RESET FREQUENCY' : 'TEST SIGNAL FREQUENCY'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {isIntercepted && (
            <CqTransition show={true} reducedMotion={reducedMotion}>
              <VerificationResult
                status="success"
                variant="panel"
                title="WATCHER FREQUENCY INTERCEPTED"
                message="W-01 passive monitoring frequency identified. Reactivation remains locked until October."
                reducedMotion={reducedMotion}
              />
            </CqTransition>
          )}

          <div className="text-[11px] font-mono text-purple-300/70 flex items-center gap-1.5 pt-1">
            <Terminal size={12} className="text-purple-400 shrink-0" />
            <span>{WATCHER_HALLOWEEN_TEASE.footnote}</span>
          </div>
        </div>
      </TransmissionPanel>
    </CqTransition>
  );
}
