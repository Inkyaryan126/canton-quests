'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Gift } from 'lucide-react';
import { QuestEvent } from '@/lib/types';
import { isWorldbuildingArchiveMission } from '@/lib/marketing-assets';

const OPERATION_PRIZE_CONTEXT: Record<string, { prizeLabel?: string; teaser: string }> = {
  'canton-weekend-1': {
    prizeLabel: '$500 Prize Pool',
    teaser: 'The full three-path Canton Quests experience — Family, Challenge, or Secret. This Mission has its own citywide leaderboard.',
  },
  'fair-qr-hunt': {
    prizeLabel: '$100 Prize',
    teaser: 'A path-free QR scavenger hunt across the fairgrounds. Scan every marker you can find.',
  },
  // Archived worldbuilding Missions — no prizeLabel: there is no real prize
  // pool to report for a Mission that never had one, so the Gift row below
  // simply doesn't render rather than showing a fabricated or placeholder
  // amount.
  'the-missing-signal': {
    teaser: 'A strange transmission surfaced across Canton. Players traced hidden marks, broken signals, and overlooked details to find its origin.',
  },
  'the-midnight-ledger': {
    teaser: 'A coded ledger referenced Canton landmarks and unexplained times. Following it revealed someone else had been watching the city first.',
  },
};

function formatOperationDate(event: QuestEvent): string {
  if (!event.startTime) return 'Schedule announcing soon';
  const start = new Date(event.startTime);
  const end = event.endTime ? new Date(event.endTime) : null;
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

interface OperationCardProps {
  event: QuestEvent;
  status: 'LIVE' | 'INCOMING' | 'ENDED';
  /** Show the "path required / no path required" line. Defaults on — the homepage's compact cards can opt out. */
  showPathInfo?: boolean;
}

const STATUS_STYLE: Record<'LIVE' | 'INCOMING' | 'ENDED', { label: string; color: string; border: string; bg: string; cardBorder: string; cardBg: string }> = {
  LIVE: {
    label: 'ACTIVE MISSION',
    color: '#22d3ee',
    border: 'rgba(34,211,238,0.5)',
    bg: 'rgba(34,211,238,0.12)',
    cardBorder: 'rgba(34, 211, 238, 0.4)',
    cardBg: 'linear-gradient(160deg, rgba(34,211,238,0.08), rgba(5,6,7,0.94))',
  },
  INCOMING: {
    label: 'UPCOMING MISSION',
    color: '#f0c978',
    border: 'rgba(240,201,120,0.5)',
    bg: 'rgba(240,201,120,0.1)',
    cardBorder: 'rgba(217, 164, 76, 0.35)',
    cardBg: 'linear-gradient(160deg, rgba(217,164,76,0.08), rgba(5,6,7,0.94))',
  },
  ENDED: {
    label: 'MISSION ENDED',
    color: '#a8a29e',
    border: 'rgba(168,162,158,0.4)',
    bg: 'rgba(168,162,158,0.08)',
    cardBorder: 'rgba(168, 162, 158, 0.3)',
    cardBg: 'linear-gradient(160deg, rgba(120,113,108,0.06), rgba(5,6,7,0.94))',
  },
};

export default function OperationCard({ event, status, showPathInfo = true }: OperationCardProps) {
  const context = OPERATION_PRIZE_CONTEXT[event.slug] || { prizeLabel: 'Prizes TBD', teaser: event.description };
  const style = STATUS_STYLE[status];
  const isArchiveMission = isWorldbuildingArchiveMission(event.slug);
  const detailHref = isArchiveMission ? `/events/archive/${event.slug}` : `/events/${event.slug}`;

  return (
    <article
      className="relative overflow-hidden rounded-3xl border p-6 sm:p-7 flex flex-col gap-4 shadow-2xl"
      style={{ borderColor: style.cardBorder, background: style.cardBg }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border"
          style={{ color: style.color, borderColor: style.border, backgroundColor: style.bg }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.color }} />
          {style.label}
        </span>
        <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wide">{formatOperationDate(event)}</span>
      </div>

      <div>
        <h3 className="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-tight leading-tight">
          {event.title}
        </h3>
        <p className="text-sm text-stone-300 font-body mt-2 leading-relaxed">{context.teaser}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {context.prizeLabel && (
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-300">
            <Gift size={14} aria-hidden="true" />
            <span>{context.prizeLabel}</span>
          </div>
        )}
        {showPathInfo && !isArchiveMission && (
          <span className="text-[10px] font-mono uppercase tracking-wide text-stone-400">
            {event.requiresPath ? 'Path required to enter' : 'No path required'}
          </span>
        )}
      </div>

      <div className="mt-auto pt-2 flex flex-wrap items-center gap-3">
        <Link
          href={detailHref}
          className="cq-gold-button inline-flex items-center justify-center gap-2 text-xs font-mono py-3 px-6"
        >
          <span>{isArchiveMission ? 'VIEW ARCHIVE' : status === 'ENDED' ? 'VIEW RESULTS' : 'ENTER MISSION'}</span>
          <ArrowRight size={14} />
        </Link>
        {!isArchiveMission && (
          <Link
            href={detailHref}
            className="cq-dark-button inline-flex items-center justify-center gap-2 text-xs font-mono py-3 px-5"
          >
            RANKINGS
          </Link>
        )}
      </div>
    </article>
  );
}
