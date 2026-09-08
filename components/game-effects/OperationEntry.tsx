'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { QuestEvent } from '@/lib/types';
import { getOperationLifecycleStage } from '@/lib/launch-status';
import { cqSoundManager } from '@/lib/audio';
import { useReducedMotion } from '@/lib/motion';
import CqTransition from './CqTransition';
import HudSystemState from './HudSystemState';
import HudReticle from './HudReticle';
import TransmissionLoader from './TransmissionLoader';
import TransmissionPanel from './TransmissionPanel';

export interface OperationEntrySnapshot {
  event: QuestEvent | null;
  loading: boolean;
}

/** Presentation only: lifecycle/paused copy never grants entry or unlocks quests. */
export function getOperationEntryLabel(event: QuestEvent): string {
  const stage = getOperationLifecycleStage(event, event.slug);
  if (stage === 'ended') return 'MISSION ENDED';
  if (event.isPaused) return 'MISSION PAUSED';
  if (stage === 'upcoming') return `MISSION ${event.status === 'active' ? 'UPCOMING' : event.status.toUpperCase()}`;
  if (stage === 'finale') return 'MISSION FINALE';
  return 'MISSION ACTIVE';
}

interface OperationEntryProps extends OperationEntrySnapshot {
  complete: boolean;
  onComplete: () => void;
  children: React.ReactNode;
}

/** One transient equipment startup per route mount, independent of six-second polling. */
export default function OperationEntry({ event, loading, complete, onComplete, children }: OperationEntryProps) {
  const reducedMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const sounded = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const eventId = event?.id;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (complete || loading) return;
    // Missing records and failed requests go straight to the page's real error state.
    if (!eventId) { onComplete(); return; }
    if (!reducedMotion && !sounded.current) {
      sounded.current = true;
      // The shared manager owns mute, autoplay restrictions, and cue priority.
      void cqSoundManager.playEvent('node_ping');
    }
    const timer = setTimeout(onComplete, reducedMotion ? 650 : 1800);
    return () => clearTimeout(timer);
  }, [complete, loading, eventId, reducedMotion, onComplete]);

  useEffect(() => {
    if (complete && restoreFocus.current) {
      content.current?.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
  }, [complete]);

  return (
    <>
      {!complete && (
        <section
          className="cq-operation-entry cq-motion-scope"
          aria-label="Mission receiver"
          data-reduced-motion={reducedMotion}
          style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: '24px', background: 'radial-gradient(ellipse at 50% 35%, #142326, #080c10 65%)', color: '#f9fafb' }}
        >
          <CqTransition show={revealed} reducedMotion={reducedMotion} style={{ width: '100%', maxWidth: 620 }}>
            <div className="cq-entry-instrument" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
              <HudReticle size={80} spinning={false} color={event ? '#fbbf24' : '#67e8f9'} />
              <div style={{ fontFamily: 'monospace', letterSpacing: '0.14em', fontSize: 12, lineHeight: 1.8 }}>
                CANTON QUESTS<br />FIELD RECEIVER / MISSION CHANNEL
              </div>
            </div>
            <TransmissionPanel eyebrow={event ? 'BRIEFING RECEIVED' : 'RECEIVING MISSION'} tone="cyan">
              <h1 className="cq-entry-title" style={{ fontSize: 'clamp(26px, 6vw, 46px)', lineHeight: 1.12, margin: '16px 0 24px', overflowWrap: 'anywhere' }}>
                {event?.title || 'Powering up the field receiver.'}
              </h1>
              {event ? (
                <HudSystemState state="armed" label={getOperationEntryLabel(event)} detail="Mission brief ready. Opening your field view." reducedMotion={reducedMotion} />
              ) : (
                <TransmissionLoader label="ACQUIRING MISSION SIGNAL" reducedMotion={reducedMotion} />
              )}
            </TransmissionPanel>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 24 }}>
              <span style={{ color: '#b7c5cc', fontFamily: 'monospace', fontSize: 12 }}>
                {event ? 'RECEIVER READY' : 'AWAITING MISSION DATA'}
              </span>
              <button
                type="button"
                className="cq-dark-button"
                style={{ minHeight: 48, padding: '12px 18px', fontSize: 14 }}
                onFocus={() => { restoreFocus.current = true; }}
                onBlur={() => { restoreFocus.current = false; }}
                onClick={onComplete}
              >
                Skip startup →
              </button>
            </div>
          </CqTransition>
        </section>
      )}
      {/* Mount the real page immediately so fetching and auth never wait on cosmetics. */}
      <div ref={content} tabIndex={-1} hidden={!complete} style={!complete ? { display: 'none' } : undefined}>
        {children}
      </div>
    </>
  );
}
