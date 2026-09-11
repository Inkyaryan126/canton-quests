'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Eye, Gift } from 'lucide-react';
import { QuestEvent } from '@/lib/types';
import { cqImages, isWorldbuildingArchiveMission } from '@/lib/marketing-assets';
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
  'the-watchers': {
    teaser: 'The Founder’s Cipher was only the first signal. Someone else was following the trail through Canton. W-01 remains dormant — for now.',
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

/**
 * Poster art per Mission — existing Canton Quests assets only, no external
 * URLs. Founder's Cipher gets the strongest cinematic asset (the three-door
 * gate — gold/black, citywide, "the main event"). The Watchers has no
 * dedicated art yet, so it reuses the darkest, most surveillance-coded
 * asset in the library (a HUD/transmission backdrop already named for the
 * Game Master's own transmission screen) under a heavy purple treatment.
 * Anything else without bespoke art falls back to a tasteful generic
 * cinematic city shot rather than repeating the flagship's own art.
 */
const OPERATION_CARD_IMAGE: Record<string, string> = {
  'canton-weekend-1': cqImages.threeDoors,
  'the-watchers': cqImages.gmTransmissionBg,
  'fair-qr-hunt': cqImages.heroCityBeam,
  'the-missing-signal': cqImages.heroCity,
  'the-midnight-ledger': cqImages.mapHud,
};

function getOperationCardImage(slug: string): string {
  return OPERATION_CARD_IMAGE[slug] || cqImages.heroCityBeam;
}

/**
 * Layered background for the card's media block: a shared readability scrim
 * (dark at the top edge for the badge/date, a lighter "window" through the
 * middle so the photo actually reads, dark again at the bottom so it blends
 * into the dossier body) plus one mission-specific tint painted through
 * that window. The scrim is always listed first — CSS paints the first
 * background image closest to the viewer — so it wins at the edges no
 * matter which tint sits behind it.
 */
const CARD_READABILITY_SCRIM =
  'linear-gradient(180deg, rgba(5,6,7,0.72) 0%, rgba(5,6,7,0.08) 30%, rgba(5,6,7,0.22) 58%, rgba(5,6,7,0.97) 100%)';

function getMediaOverlay(slug: string, isArchiveRecord: boolean): string {
  if (slug === 'the-watchers') {
    return [
      CARD_READABILITY_SCRIM,
      'linear-gradient(160deg, rgba(59,7,100,0.5) 0%, rgba(10,4,24,0.55) 55%, rgba(5,3,10,0.88) 100%)',
      'radial-gradient(90% 70% at 50% 35%, rgba(168,85,247,0.22), transparent 70%)',
    ].join(', ');
  }
  if (slug === 'canton-weekend-1') {
    return [CARD_READABILITY_SCRIM, 'radial-gradient(90% 70% at 50% 22%, rgba(245,193,7,0.24), transparent 65%)'].join(', ');
  }
  if (isArchiveRecord) {
    return [CARD_READABILITY_SCRIM, 'linear-gradient(180deg, rgba(30,27,24,0.25) 0%, rgba(10,9,8,0.55) 100%)'].join(', ');
  }
  return CARD_READABILITY_SCRIM;
}

function getMediaEdgeGlow(slug: string): string {
  if (slug === 'the-watchers') return 'inset 0 0 70px rgba(88,28,135,0.55), inset 0 0 22px rgba(0,0,0,0.65)';
  if (slug === 'canton-weekend-1') return 'inset 0 0 55px rgba(245,193,7,0.28)';
  return 'inset 0 0 40px rgba(0,0,0,0.4)';
}

function formatOperationDate(event: QuestEvent): string {
  if (event.slug === 'the-watchers') return 'DETAILS CLASSIFIED';
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
  const isWatcherMission = event.slug === 'the-watchers';
  const context = OPERATION_PRIZE_CONTEXT[event.slug] || { prizeLabel: 'Prizes TBD', teaser: event.description };

  const style = isWatcherMission
    ? {
        label: 'COMING SOON',
        status: 'armed' as SystemStatus,
        cardBorder: 'rgba(168, 85, 247, 0.65)',
        cardBg: 'linear-gradient(160deg, rgba(88,28,135,0.28), rgba(5,6,7,0.96))',
      }
    : STATUS_STYLE[status];

  const isArchiveMission = isWorldbuildingArchiveMission(event.slug);
  const isArchiveRecord = status === 'ENDED';
  const detailHref = isArchiveMission ? `/events/archive/${event.slug}` : `/events/${event.slug}`;

  const badgeLabel = isWatcherMission
    ? 'COMING SOON // W-01'
    : status === 'ENDED' && isArchiveMission
      ? 'MISSION COMPLETE'
      : style.label;

  return (
    <article
      className={`cq-hud-panel cq-op-card cq-motion-scope cq-transition-reveal is-visible ${isArchiveRecord ? 'is-archived' : ''}`}
      style={{
        borderColor: style.cardBorder,
        background: style.cardBg,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        overflow: 'hidden',
      }}
    >
      <div className="cq-op-card-media" style={{ boxShadow: getMediaEdgeGlow(event.slug) }}>
        <Image
          src={getOperationCardImage(event.slug)}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 480px"
          className="cq-op-card-media-img"
        />
        <div className="cq-op-card-scrim" style={{ background: getMediaOverlay(event.slug, isArchiveRecord) }} />

        {isWatcherMission && (
          <>
            <div className="cq-op-card-scanlines" aria-hidden="true" />
            <Eye size={132} className="cq-op-card-watermark" aria-hidden="true" />
          </>
        )}

        <div className="cq-op-card-media-top">
          <SystemStatusBadge status={style.status} label={badgeLabel} size="sm" />
          <span className="cq-op-card-date">{formatOperationDate(event)}</span>
        </div>
      </div>

      <div className="cq-op-card-body">
        <div>
          <p className="cq-kicker">
            {isWatcherMission ? 'CLASSIFIED // WATCHER FILE' : 'FIELD OPERATIONS DOSSIER'}
          </p>
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
          {showPathInfo && !isArchiveMission && !isWatcherMission && (
            <span className="cq-section-note">
              {event.requiresPath ? 'Path required to enter' : 'No path required'}
            </span>
          )}

          {isWatcherMission && (
            <span className="cq-section-note" style={{ color: '#c084fc' }}>
              MISSION DETAILS // CLASSIFIED
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '0.5rem' }}>
          {isWatcherMission ? (
            <>
              <div
                className="cq-dark-button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderColor: 'rgba(168,85,247,0.55)',
                  color: '#d8b4fe',
                  cursor: 'default',
                }}
                aria-label="The Watchers mission coming soon"
              >
                <Eye size={14} />
                <span>COMING SOON</span>
              </div>

              <span
                className="cq-section-note"
                style={{
                  color: '#a78bfa',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.12em',
                }}
              >
                W-01 // DORMANT
              </span>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </article>
  );
}
