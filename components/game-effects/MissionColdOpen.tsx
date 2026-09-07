'use client';

import { useEffect, useRef, useState } from 'react';
import HudSystemState from './HudSystemState';
import type { SystemStatus } from './HudSystemState';
import TransmissionLoader from './TransmissionLoader';
import CqTransition from './CqTransition';
import { useReducedMotion } from '@/lib/motion';
import { cqSoundManager } from '@/lib/audio';

type BootOutcome = 'pending' | 'ready' | 'error';
type BootStage = Extract<SystemStatus, 'scanning' | 'confirmed' | 'denied'>;

const SESSION_KEY_PREFIX = 'cq_cold_open_seen_';

// A deliberate minimum "powering on" beat so a fast network response never
// skips the cold open entirely — the scanning stage always holds for at
// least this long, then waits for the real fetch if it's still in flight.
const SCAN_FLOOR_MS = 900;
const REDUCED_SCAN_FLOOR_MS = 220;
const CONFIRM_HOLD_MS = 380;
const REDUCED_CONFIRM_HOLD_MS = 160;

function hasSeenColdOpen(eventSlug: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.sessionStorage.getItem(`${SESSION_KEY_PREFIX}${eventSlug}`) === '1';
  } catch {
    return false;
  }
}

function markColdOpenSeen(eventSlug: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`${SESSION_KEY_PREFIX}${eventSlug}`, '1');
  } catch {
    // Private-browsing / storage-disabled — never block Mission entry over this.
  }
}

export interface MissionColdOpenProps {
  /** Which Operation this boot sequence belongs to — the once-per-tab gate is scoped per Mission. */
  eventSlug: string;
  /**
   * The real Mission data fetch's current outcome. 'pending' holds the
   * scanning stage open indefinitely (never confirms a signal lock on data
   * that hasn't arrived); 'ready'/'error' resolve to a confirmed or denied
   * frame so the boot sequence never lies about what actually happened.
   */
  outcome: BootOutcome;
  /** Fired exactly once, when the real Mission content should render. */
  onDone: () => void;
  /** Shown under the confirmed badge once known — e.g. the Mission title. */
  missionLabel?: string;
}

/**
 * The one mission-entry cold-open: field equipment "powering on" and
 * locking (or losing) a signal before the real Operation content is
 * revealed — built entirely from the Phase 2 HUD/motion/sound primitives.
 * Plays once per browser tab per Operation; a returning visit within the
 * same session (tab switches, the background data refresh) calls onDone
 * immediately with nothing rendered.
 */
export default function MissionColdOpen({ eventSlug, outcome, onDone, missionLabel }: MissionColdOpenProps) {
  const reducedMotion = useReducedMotion();
  const [skip] = useState(() => hasSeenColdOpen(eventSlug));
  const [stage, setStage] = useState<BootStage>('scanning');
  const [floorElapsed, setFloorElapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const donePendingRef = useRef(false);
  const soundedRef = useRef(false);

  // Skip path: already seen this Mission this session — pass straight
  // through with nothing rendered, no sound, no delay.
  useEffect(() => {
    if (!skip || donePendingRef.current) return;
    donePendingRef.current = true;
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  // Entrance fade + boot tone — once, only when actually running the sequence.
  useEffect(() => {
    if (skip) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    if (!soundedRef.current) {
      soundedRef.current = true;
      cqSoundManager.play('scan', { volume: 0.32 });
    }
    return () => cancelAnimationFrame(raf);
  }, [skip]);

  // The minimum scanning beat, shortened (never skipped) under reduced motion.
  useEffect(() => {
    if (skip) return;
    const floorMs = reducedMotion ? REDUCED_SCAN_FLOOR_MS : SCAN_FLOOR_MS;
    const t = setTimeout(() => setFloorElapsed(true), floorMs);
    return () => clearTimeout(t);
  }, [skip, reducedMotion]);

  // Resolve to confirmed/denied only once the floor has elapsed AND the
  // real fetch has settled — never confirms a signal lock on stale data.
  useEffect(() => {
    if (skip || stage !== 'scanning' || !floorElapsed || outcome === 'pending') return;
    if (outcome === 'error') {
      setStage('denied');
      cqSoundManager.play('ui_error', { volume: 0.4 });
    } else {
      setStage('confirmed');
      cqSoundManager.play('lock_on', { volume: 0.4 });
    }
  }, [skip, stage, floorElapsed, outcome]);

  // Hold on the resolved frame briefly so it reads, then reveal.
  useEffect(() => {
    if (skip || stage === 'scanning' || donePendingRef.current) return;
    const holdMs = reducedMotion ? REDUCED_CONFIRM_HOLD_MS : CONFIRM_HOLD_MS;
    const t = setTimeout(() => {
      donePendingRef.current = true;
      markColdOpenSeen(eventSlug);
      onDone();
    }, holdMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, stage, reducedMotion, eventSlug]);

  if (skip) return null;

  const isDenied = stage === 'denied';
  const stageLabel = stage === 'scanning' ? 'FIELD UPLINK' : isDenied ? 'UPLINK FAILED' : 'SIGNAL LOCKED';
  const stageDetail =
    stage === 'scanning' ? undefined : isDenied ? 'Retry available below' : missionLabel || 'Mission channel secured';
  const loaderLabel = stage === 'scanning' ? 'ESTABLISHING FIELD UPLINK' : isDenied ? 'UPLINK LOST' : 'CHANNEL SECURED';
  const reducedMotionCopy =
    stage === 'scanning'
      ? 'Connecting to Mission systems…'
      : isDenied
        ? 'Uplink failed. Retry available below.'
        : 'Mission channel secured.';

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col items-center justify-center gap-5 p-6 font-mono">
      <CqTransition show={mounted} reducedMotion={reducedMotion} className="flex flex-col items-center gap-4 text-center">
        <HudSystemState state={stage} label={stageLabel} detail={stageDetail} reducedMotion={reducedMotion} />
        {reducedMotion ? (
          <p className="text-[11px] text-cyan-300 uppercase tracking-widest">{reducedMotionCopy}</p>
        ) : (
          <TransmissionLoader label={loaderLabel} />
        )}
      </CqTransition>
    </div>
  );
}
