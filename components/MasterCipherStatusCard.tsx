'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import type { PlayerFinaleStatus } from '@/lib/finale-db';
import { useReducedMotion } from '@/lib/motion';
import CqTransition from '@/components/game-effects/CqTransition';
import SystemStatusBadge, { SystemStatus } from '@/components/game-effects/SystemStatusBadge';

/**
 * Hub-level status card for the Master Cipher Convergence finale — the
 * genuine, sigil-based system (lib/finale.ts / lib/finale-db.ts), NOT the
 * unrelated legacy "finale-qualified" prize-drawing ticket concept shown
 * elsewhere on this page as the "Finale Status" QUALIFIED/PENDING stat
 * (that one reads completedQuestIds.length > 0 — see the mission report).
 * Three real states only: LOCKED (not yet eligible, for any reason — the
 * eligibility.message is always the real server-authored reason), READY
 * (eligible, not yet solved), SOLVED (completedAt is set).
 */
export default function MasterCipherStatusCard({
  eventSlug,
  status,
}: {
  eventSlug: string;
  status: PlayerFinaleStatus | null;
}) {
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  // Mount reveal — only ever plays once real status data exists, so a
  // returning player never sees a fake "locked" flash before the real
  // state (see the `if (!status) return null;` guard below) arrives.
  useEffect(() => {
    if (!status) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [status]);

  if (!status) return null;

  const solved = Boolean(status.completedAt);
  const ready = !solved && status.eligibility.ok;
  const systemStatus: SystemStatus = solved ? 'confirmed' : ready ? 'armed' : 'denied';
  const statusLabel = solved ? 'SOLVED' : ready ? 'CONVERGENCE READY' : 'LOCKED';

  return (
    <CqTransition show={mounted} reducedMotion={reducedMotion} className="mb-6">
      <Link
        href={`/events/${eventSlug}/finale`}
        className={`flex items-center justify-between gap-4 border p-4 sm:p-5 transition-colors ${
          solved
            ? 'border-emerald-400/40 bg-emerald-950/20 hover:border-emerald-300/60'
            : ready
              ? 'border-amber-400/50 bg-amber-950/20 hover:border-amber-300/70'
              : 'border-stone-800 bg-[#06090b] hover:border-stone-700'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`grid h-11 w-11 shrink-0 place-items-center border ${
              solved
                ? 'border-emerald-300 bg-emerald-300/15 text-emerald-200'
                : ready
                  ? `border-amber-300 bg-amber-300/15 text-amber-200 ${reducedMotion ? '' : 'animate-pulse'}`
                  : 'border-stone-700 bg-black/35 text-stone-400'
            }`}
          >
            {solved ? <ShieldCheck size={20} aria-hidden="true" /> : ready ? <KeyRound size={20} aria-hidden="true" /> : <Lock size={20} aria-hidden="true" />}
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-mono font-extrabold uppercase tracking-[0.2em] text-cyan-300">
              Master Cipher
            </span>
            <strong className="block truncate font-display text-lg font-black uppercase text-white">
              {solved ? 'Solved' : ready ? 'Ready' : 'Locked'}
            </strong>
            <SystemStatusBadge status={systemStatus} label={statusLabel} size="sm" className="mt-1" />
            {!solved && (
              <p className="mt-1 truncate text-xs text-stone-400 font-mono">
                {ready
                  ? 'Enter the final decode →'
                  : status.eligibility.ok
                    ? ''
                    : status.eligibility.reason === 'insufficient_sigils'
                      ? `${status.unlockedSigilCount} signal${status.unlockedSigilCount === 1 ? '' : 's'} recovered`
                      : status.eligibility.message}
              </p>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 text-[10px] font-mono font-bold uppercase tracking-widest ${
            solved ? 'text-emerald-300' : ready ? 'text-amber-300' : 'text-stone-500'
          }`}
        >
          {solved ? 'View →' : ready ? 'Open →' : 'Details →'}
        </span>
      </Link>
    </CqTransition>
  );
}
