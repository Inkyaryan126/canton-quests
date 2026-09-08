'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Gift } from 'lucide-react';
import { QuestEvent } from '@/lib/types';
import { isWorldbuildingArchiveMission } from '@/lib/marketing-assets';
import SystemStatusBadge, { SystemStatus } from '@/components/game-effects/SystemStatusBadge';

const OPERATION_PRIZE_CONTEXT: Record<string, { prizeLabel?: string; teaser: string }> = {
  'canton-weekend-1': {
    prizeLabel: '$500 Prize Pool',
    teaser: 'The full three-path Canton Quests experience — Family, Challenge, or Secret. This Mission has its own citywide leaderboard.',
  },
  'fair-qr-hunt': {
    prizeLabel: '$300 Mystery Money',
    teaser: 'A path-free QR scavenger hunt across the fairgrounds. 20 Signals, each hiding a real cash prize.',
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

const STATUS_STYLE: Record<'LIVE' | 'INCOMING' | 'ENDED', { label: string; status: SystemStatus; cardBorder: string; cardBg: string }> = {
  LIVE: {
    label: 'ACTIVE MISSION',
    status: 'scanning',
    cardBorder: 'rgba(34, 211, 238, 0.4)',
    cardBg: 'linear-gradient(160deg, rgba(34,211,238,0.08), rgba(5,6,7,0.94))',
  },
  INCOMING: {
    label: 'UPCOMING MISSION',
    status: 'armed',
    cardBorder: 'rgba(217, 164, 76, 0.35)',
    cardBg: 'linear-gradient(160deg, rgba(217,164,76,0.08), rgba(5,6,7,0.94))',
  },
  ENDED: {
    label: 'MISSION ENDED',
    status: 'confirmed',
    cardBorder: 'rgba(168, 162, 158, 0.3)',
    cardBg: 'linear-gradient(160deg, rgba(120,113,108,0.06), rgba(5,6,7,0.94))',
  },
};

export default function OperationCard({ event, status, showPathInfo = true }: OperationCardProps) {
  const context = OPERATION_PRIZE_CONTEXT[event.slug] || { prizeLabel: 'Prizes TBD', teaser: event.description };
  const style = STATUS_STYLE[status];
  const isArchiveMission = isWorldbuildingArchiveMission(event.slug);
  const detailHref = isArchiveMission ? `/events/archive/${event.slug}` : `/events/${event.slug}`;
  // Worldbuilding archive Missions get the exact "MISSION COMPLETE" wording
  // instead of the generic "MISSION ENDED" — everything else about the
  // ENDED badge (color/border/bg) is unchanged.
  const badgeLabel = status === 'ENDED' && isArchiveMission ? 'MISSION COMPLETE' : style.label;

  return (
    <article
      className="cq-hud-panel cq-motion-scope cq-transition-reveal is-visible"
      style={{
        borderColor: style.cardBorder,
        background: style.cardBg,
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        minHeight: '100%',
        overflow: 'hidden',
        padding: 'clamp(1.25rem, 4vw, 1.75rem)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <SystemStatusBadge status={style.status} label={badgeLabel} size="sm" />
        <span className="cq-section-note">{formatOperationDate(event)}</span>
      </div>

      <div>
        <p className="cq-kicker">FIELD OPERATIONS DOSSIER</p>
        <h3 style={{ color: '#f4f1ea', fontFamily: 'var(--font-display)', fontSize: 'clamp(1.35rem, 4vw, 2rem)', fontWeight: 900, lineHeight: 1.05, textTransform: 'uppercase' }}>
          {event.title}
        </h3>
        <p style={{ color: '#b8b5ad', fontSize: '0.92rem', lineHeight: 1.55, marginTop: '0.65rem' }}>{context.teaser}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {context.prizeLabel && (
          <div className="cq-kicker" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Gift size={14} aria-hidden="true" />
            <span>{context.prizeLabel}</span>
          </div>
        )}
        {showPathInfo && !isArchiveMission && (
          <span className="cq-section-note">
            {event.requiresPath ? 'Path required to enter' : 'No path required'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '0.5rem' }}>
        <Link
          href={detailHref}
          className="cq-gold-button"
        >
          <span>{isArchiveMission ? 'VIEW ARCHIVE' : status === 'ENDED' ? 'VIEW RESULTS' : 'ENTER MISSION'}</span>
          <ArrowRight size={14} />
        </Link>
        {!isArchiveMission && (
          <Link
            href={detailHref}
            className="cq-dark-button"
          >
            RANKINGS
          </Link>
        )}
      </div>
    </article>
  );
}
