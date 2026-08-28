'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Radio, Zap, Megaphone, TrendingUp, Sparkles } from 'lucide-react';
import { showGameMoment } from '@/lib/game-effects';
import type { LiveEventType, PublicLiveEvent } from '@/lib/live-events';

interface LiveCityStatusPanelProps {
  eventSlug: string;
  /** Route used by a live event's "go there" link — defaults to the event hub. */
  questBaseHref?: string;
}

const TYPE_CONFIG: Record<LiveEventType, { icon: typeof Radio; label: string; color: string }> = {
  FLASH_DROP: { icon: Zap, label: 'FLASH DROP', color: '#f97316' },
  CITY_EVENT: { icon: Radio, label: 'CITY EVENT', color: '#f59e0b' },
  SECTOR_EVENT: { icon: Radio, label: 'SECTOR SIGNAL', color: '#f59e0b' },
  COMMUNITY_MILESTONE: { icon: TrendingUp, label: 'MILESTONE', color: '#22c55e' },
  XP_MULTIPLIER: { icon: Sparkles, label: 'XP BOOST', color: '#a855f7' },
  TEMPORARY_UNLOCK: { icon: Sparkles, label: 'UNLOCKED', color: '#06b6d4' },
  SPECIAL_OBJECTIVE: { icon: Zap, label: 'SPECIAL OBJECTIVE', color: '#f97316' },
  EMERGENCY_MESSAGE: { icon: Megaphone, label: 'COMMANDER ALERT', color: '#ef4444' },
};

const SECTOR_LABEL: Record<string, string> = { family: 'Arts District', challenge: 'Mother Goose Land', secret: 'Monument Park' };

function formatCountdown(endsAt?: string): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

/**
 * Mobile-first, non-modal HUD strip for the Live City Events system
 * (lib/live-events.ts) — the player-facing "what's happening right now"
 * feed the mission asks for. Deliberately small: a horizontal-scrolling row
 * of signal chips, not a takeover. Renders nothing when no live event is
 * active, so it never adds clutter to a quiet moment.
 *
 * Cinematic announcements: every event type EXCEPT FLASH_DROP fires a
 * one-time GameMomentManager moment on first sight (server state — the API
 * response — always comes first; the moment is just the announcement of
 * something that already happened). FLASH_DROP is deliberately skipped here
 * — the event hub page already fires its own 'flash-drop' cinematic from
 * the linked quest's isFlash flag, and firing a second, differently-shaped
 * overlay for the same drop would be a confusing duplicate.
 */
export default function LiveCityStatusPanel({ eventSlug, questBaseHref }: LiveCityStatusPanelProps) {
  const [liveEvents, setLiveEvents] = useState<PublicLiveEvent[]>([]);
  const announced = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const poll = () => {
      fetch(`/api/game/live-events?eventSlug=${encodeURIComponent(eventSlug)}`)
        .then((res) => res.json())
        .then((data: { liveEvents?: PublicLiveEvent[] }) => {
          if (cancelled) return;
          const events = data.liveEvents || [];
          setLiveEvents(events);

          if (typeof window === 'undefined') return;
          for (const le of events) {
            if (le.eventType === 'FLASH_DROP') continue;
            const sessionKey = `cq_live_event_seen_${le.id}`;
            if (announced.current.has(le.id) || sessionStorage.getItem(sessionKey)) continue;
            announced.current.add(le.id);
            sessionStorage.setItem(sessionKey, 'true');

            const config = TYPE_CONFIG[le.eventType];
            // A server-resolved Commander transmission (lib/contextual-transmissions.ts,
            // computed in getPublicLiveEventsDB) takes priority over the generic
            // chip-style announcement when this specific live event has one —
            // the client never decides content, it only renders what the server sent.
            if (le.resolvedTransmission) {
              showGameMoment({
                type: 'commander-transmission',
                trigger: 'city_event',
                transmission: le.resolvedTransmission,
                viewedStateKey: `live-event-${le.id}`,
              });
            } else {
              showGameMoment({
                type: 'field-event',
                kind: 'live-event',
                headline: le.title,
                primaryText: le.description,
                secondaryText: le.sectorScope ? SECTOR_LABEL[le.sectorScope] : undefined,
                pathColor: config.color,
                progress:
                  le.eventType === 'COMMUNITY_MILESTONE' && le.progressTarget
                    ? { current: le.progressCurrent, total: le.progressTarget, label: 'City Progress' }
                    : undefined,
              });
            }
          }
        })
        .catch(() => {
          // Ambient status only — a failed poll just leaves the strip at its last-known state.
        });
    };

    poll();
    const interval = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [eventSlug]);

  if (liveEvents.length === 0) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 mb-6 -mx-1 px-1"
      style={{ scrollbarWidth: 'thin' }}
      aria-label="Live city signals"
    >
      {liveEvents.map((le) => {
        const config = TYPE_CONFIG[le.eventType];
        const Icon = config.icon;
        const countdown = formatCountdown(le.endsAt);
        const href = le.questScopeId && questBaseHref ? `${questBaseHref}/${le.questScopeId}` : undefined;

        const chip = (
          <div
            className="flex items-center gap-2 shrink-0 py-2 px-3 rounded-xl border font-mono"
            style={{ borderColor: `${config.color}66`, backgroundColor: `${config.color}14` }}
          >
            <Icon size={14} style={{ color: config.color }} />
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: config.color }}>
                {config.label}
                {le.sectorScope && ` · ${SECTOR_LABEL[le.sectorScope]}`}
              </span>
              <span className="text-xs font-bold text-white whitespace-nowrap">
                {le.title}
                {le.eventType === 'XP_MULTIPLIER' && le.multiplierValue ? ` (${le.multiplierValue}x)` : ''}
                {le.eventType === 'COMMUNITY_MILESTONE' && le.progressTarget
                  ? ` (${le.progressCurrent}/${le.progressTarget})`
                  : ''}
              </span>
              {countdown && <span className="text-[9px] text-stone-400">{countdown}</span>}
            </div>
          </div>
        );

        return href ? (
          <Link key={le.id} href={href} className="no-underline">
            {chip}
          </Link>
        ) : (
          <div key={le.id}>{chip}</div>
        );
      })}
    </div>
  );
}
