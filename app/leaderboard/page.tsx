'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Crown, Medal, Radio, Trophy, Zap } from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import PageHeader from '@/components/PageHeader';
import { GlobalXpLeaderboardEntry, LeaderboardEntry, Player, QuestEvent } from '@/lib/types';
import { formatEventWindow, getActiveEvent } from '@/lib/marketing-assets';
import PlayerAvatar from "@/components/PlayerAvatar";
import { isKnownCantonLaunchSlug } from '@/lib/launch-status';
import WatchTransmissionButton from '@/components/commander/WatchTransmissionButton';
import HudSystemState from '@/components/game-effects/HudSystemState';
import SystemStatusBadge from '@/components/game-effects/SystemStatusBadge';

function getClientPlayer(): Player {
  const stored = window.localStorage.getItem('canton_quests_current_player');
  if (stored) return JSON.parse(stored) as Player;
  return {
    id: 'plr-local-viewer',
    displayName: 'Canton Explorer',
    avatarUrl: '⚡',
    role: 'player',
    totalXp: 0,
    level: 1,
    createdAt: new Date().toISOString(),
  };
}

function LeaderboardContent() {
  const searchParams = useSearchParams();
  const operationSlug = searchParams.get('operation') || searchParams.get('eventSlug');
  const initialViewMode = searchParams.get('scope') === 'global' ? 'global' : 'mission';

  const [viewMode, setViewMode] = useState<'mission' | 'global'>(initialViewMode);
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<QuestEvent | null>(null);
  const [globalEntries, setGlobalEntries] = useState<GlobalXpLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadStandings() {
      setIsLoading(true);
      setLoadError(null);
      setCurrentPlayer(getClientPlayer());

      try {
        const eventsResponse = await fetch('/api/game/events');
        if (!eventsResponse.ok) throw new Error('Mission directory unavailable');
        const data = (await eventsResponse.json()) as { events?: QuestEvent[] };
        const loadedEvents = data.events || [];
        const target = operationSlug
          ? loadedEvents.find((e) => e.slug === operationSlug)
          : getActiveEvent(loadedEvents);

        const [eventData, globalData] = await Promise.all([
          target
            ? fetch(`/api/game/events/${target.slug}`).then(async (response) => {
                if (!response.ok) throw new Error('Mission standings unavailable');
                return response.json() as Promise<{ leaderboard?: LeaderboardEntry[] }>;
              })
            : Promise.resolve({ leaderboard: [] }),
          fetch('/api/game/leaderboard/global').then(async (response) => {
            if (!response.ok) throw new Error('Global standings unavailable');
            return response.json() as Promise<{ leaderboard?: GlobalXpLeaderboardEntry[] }>;
          }),
        ]);

        if (cancelled) return;
        setEvents(loadedEvents);
        setSelectedEvent(target || null);
        setEntries(eventData.leaderboard || []);
        setGlobalEntries(globalData.leaderboard || []);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Standings link unavailable');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadStandings();
    return () => {
      cancelled = true;
    };
  }, [operationSlug, loadAttempt]);

  const activeEvent = selectedEvent || getActiveEvent(events);
  const eventHref = activeEvent ? `/events/${activeEvent.slug}` : '/events';
  const topThree = entries.slice(0, 3);
  const isFairOperation = activeEvent?.slug === 'fair-qr-hunt';

  return (
    <div className="cq-home-shell">
      <CinematicNav
        eventHref={eventHref}
        context={isFairOperation ? 'fair-operation' : 'global'}
      />

      <main className="cq-page-main">
        <section className="cq-page-section" style={{ paddingBottom: '0' }}>
          <PageHeader
            eyebrow="LIVE STANDINGS"
            title="CITY LEADERBOARD"
            body="Complete quests to earn XP. Every verified proof submission climbs your rank."
            accent="cyan"
            action={
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link href={eventHref} className="cq-gold-button cq-btn-sm">
                  START QUEST
                  <Zap size={14} aria-hidden="true" />
                </Link>
                <Link href="/events/canton-weekend-1/quests" className="cq-dark-button cq-btn-sm">
                  BROWSE QUESTS
                </Link>
              </div>
            }
            divider
          />
        </section>

        {isLoading ? (
          <section className="cq-page-section" aria-live="polite">
            <div className="cq-hud-panel cq-empty-state">
              <HudSystemState
                state="scanning"
                label="SYNCING STANDINGS"
                detail="Receiving verified mission and all-time XP telemetry."
              />
            </div>
          </section>
        ) : loadError ? (
          <section className="cq-page-section" role="alert">
            <div className="cq-hud-panel cq-empty-state">
              <HudSystemState state="denied" label="STANDINGS LINK INTERRUPTED" detail={loadError} />
              <button type="button" className="cq-gold-button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                Retry Standings
              </button>
            </div>
          </section>
        ) : (
        <>
        <section className="cq-page-section" style={{ paddingTop: 0, paddingBottom: '1rem' }}>
          <div className="cq-hud-panel" style={{ display: 'flex', gap: '0.4rem', maxWidth: '22rem', padding: '0.35rem' }}>
            <button
              type="button"
              onClick={() => setViewMode('mission')}
              className={viewMode === 'mission' ? 'cq-gold-button cq-btn-sm' : 'cq-dark-button cq-btn-sm'}
              aria-pressed={viewMode === 'mission'}
              style={{ flex: 1 }}
            >
              THIS MISSION
            </button>
            <button
              type="button"
              onClick={() => setViewMode('global')}
              className={viewMode === 'global' ? 'cq-gold-button cq-btn-sm' : 'cq-dark-button cq-btn-sm'}
              aria-pressed={viewMode === 'global'}
              style={{ flex: 1 }}
            >
              ALL-TIME XP
            </button>
          </div>
        </section>

        {viewMode !== 'mission' ? null : (
        <>
        {activeEvent && isKnownCantonLaunchSlug(activeEvent.slug) && (
          <section className="cq-page-section" style={{ paddingTop: 0, paddingBottom: '1rem' }}>
            <WatchTransmissionButton trigger="cipher_leaderboard" playerId={currentPlayer?.id} label="Commander Briefing" size="hero" />
          </section>
        )}

        <section className="cq-scoreboard-overview">
          <div>
            <span className="cq-kicker">ACTIVE EVENT</span>
            <h2>{activeEvent?.title || 'Canton Quest Weekend'}</h2>
            <p>{activeEvent ? formatEventWindow(activeEvent) : 'Quest dates loading'} · Downtown Canton</p>
          </div>
          <div>
            <Radio size={20} aria-hidden="true" />
            <strong>{entries.length}</strong>
            <span>ranked agents</span>
          </div>
          <div>
            <Trophy size={20} aria-hidden="true" />
            <strong>{topThree.length > 0 ? `${topThree[0].totalPoints} XP` : '0 XP'}</strong>
            <span>current top score</span>
          </div>
        </section>

        {entries.length === 0 ? (
          <section className="cq-page-section cq-board-section">
            <div className="cq-hud-panel cq-empty-state cq-transition-reveal is-visible" style={{ maxWidth: '48rem', margin: '2rem auto', padding: 'clamp(2rem, 7vw, 3.5rem)' }}>
              {isFairOperation ? (
                <div>
                  <SystemStatusBadge status="scanning" label="FAIR QR HUNT • SEPT 4 – SEPT 5" size="sm" />
                  <h2>
                    No Fair Scores Yet
                  </h2>
                  <p>
                    Live Fair QR Hunt rankings will stream here as players secure Signals across the fairgrounds — no starting path required.
                  </p>
                  <div style={{ marginTop: '1rem' }}>
                    <Link href="/events/fair-qr-hunt" className="cq-gold-button">
                      ENTER THE FAIR QR HUNT
                      <Zap size={16} />
                    </Link>
                  </div>
                </div>
              ) : (
                <div>
                  <SystemStatusBadge status="armed" label="NO SCORES YET" size="sm" />
                  <h2>No Scores Yet</h2>
                  <p>
                    Rankings will appear here as players earn XP.
                  </p>
                  <div style={{ marginTop: '1rem' }}>
                    <Link href="/events/canton-weekend-1" className="cq-gold-button">
                      ENTER FOUNDER&apos;S CIPHER
                      <Zap size={16} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="cq-podium">
              {topThree.map((entry) => (
                <article key={entry.playerId} className={`cq-podium-card cq-podium-rank-${entry.rank}`}>
                  <span>
                    {entry.rank === 1 ? <Crown size={20} /> : <Medal size={20} />}
                    #{entry.rank}
                  </span>
                  <div>
                    <PlayerAvatar
                      avatarUrl={entry.avatarUrl}
                      cropZoom={entry.profileImageCropZoom}
                      cropX={entry.profileImageCropX}
                      cropY={entry.profileImageCropY}
                      size={64}
                      fallback="⚡"
                    />
                  </div>
                  <h2>{entry.displayName}</h2>
                  <strong>{entry.totalPoints} XP</strong>
                  <p>{entry.questsCompletedCount} missions verified</p>
                </article>
              ))}
            </section>

            <section className="cq-page-section cq-board-section">
              <div className="cq-section-heading">
                <div>
                  <h2>AGENT RANKINGS</h2>
                </div>
                {currentPlayer && <div className="cq-filter-label">Current: {currentPlayer.displayName}</div>}
              </div>

              <div className="cq-rank-list">
                {entries.map((entry) => {
                  const isCurrent = currentPlayer?.id === entry.playerId;

                  return (
                    <article className={isCurrent ? 'is-current' : ''} key={entry.playerId}>
                      <div className="cq-rank-number">#{entry.rank}</div>
                      <PlayerAvatar
                        avatarUrl={entry.avatarUrl}
                        cropZoom={entry.profileImageCropZoom}
                        cropX={entry.profileImageCropX}
                        cropY={entry.profileImageCropY}
                        size={46}
                        fallback="⚡"
                        className="cq-rank-avatar"
                        style={{ fontSize: '1.4rem' }}
                      />
                      <div className="cq-rank-name">
                        <h3>
                          {entry.displayName}
                          {isCurrent && <span>YOU</span>}
                        </h3>
                        <p>
                          Agent · {entry.questsCompletedCount} mission
                          {entry.questsCompletedCount === 1 ? '' : 's'} completed
                        </p>
                      </div>
                      <strong>{entry.totalPoints} XP</strong>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
        </>
        )}

        {viewMode !== 'global' ? null : (
        <>
        <section className="cq-scoreboard-overview">
          <div>
            <span className="cq-kicker">ALL-TIME</span>
            <h2>Global XP Leaderboard</h2>
            <p>Every registered Canton Quests identity, ranked across every Mission ever run.</p>
          </div>
          <div>
            <Radio size={20} aria-hidden="true" />
            <strong>{globalEntries.length}</strong>
            <span>ranked agents</span>
          </div>
          <div>
            <Trophy size={20} aria-hidden="true" />
            <strong>{globalEntries.length > 0 ? `${globalEntries[0].totalXp} XP` : '0 XP'}</strong>
            <span>current #1 total XP</span>
          </div>
        </section>

        {globalEntries.length === 0 ? (
          <section className="cq-page-section cq-board-section">
            <div className="cq-hud-panel cq-empty-state cq-transition-reveal is-visible" style={{ maxWidth: '48rem', margin: '2rem auto', padding: 'clamp(2rem, 7vw, 3.5rem)' }}>
              <div>
                <SystemStatusBadge status="armed" label="GLOBAL RANKINGS" size="sm" />
                <h2>No Agents Ranked Yet</h2>
                <p>
                  Create a Player Identity and start earning XP across any Mission to appear here.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="cq-podium">
              {globalEntries.slice(0, 3).map((entry, i) => {
                const rank = i + 1;
                return (
                  <article key={entry.id} className={`cq-podium-card cq-podium-rank-${rank}`}>
                    <span>
                      {rank === 1 ? <Crown size={20} /> : <Medal size={20} />}
                      #{rank}
                    </span>
                    <div>
                      <PlayerAvatar
                        avatarUrl={entry.avatarUrl}
                        cropZoom={entry.profileImageCropZoom}
                        cropX={entry.profileImageCropX}
                        cropY={entry.profileImageCropY}
                        size={64}
                        fallback="⚡"
                      />
                    </div>
                    <h2>{entry.displayName}</h2>
                    <strong>{entry.totalXp} XP</strong>
                    <p>Level {entry.level}</p>
                  </article>
                );
              })}
            </section>

            <section className="cq-page-section cq-board-section">
              <div className="cq-section-heading">
                <div>
                  <h2>TOP AGENTS — ALL-TIME</h2>
                </div>
                {currentPlayer && <div className="cq-filter-label">Current: {currentPlayer.displayName}</div>}
              </div>

              <div className="cq-rank-list">
                {globalEntries.map((entry, i) => {
                  const rank = i + 1;
                  const isCurrent = currentPlayer?.id === entry.id;

                  return (
                    <article className={isCurrent ? 'is-current' : ''} key={entry.id}>
                      <div className="cq-rank-number">#{rank}</div>
                      <PlayerAvatar
                        avatarUrl={entry.avatarUrl}
                        cropZoom={entry.profileImageCropZoom}
                        cropX={entry.profileImageCropX}
                        cropY={entry.profileImageCropY}
                        size={46}
                        fallback="⚡"
                        className="cq-rank-avatar"
                        style={{ fontSize: '1.4rem' }}
                      />
                      <div className="cq-rank-name">
                        <h3>
                          {entry.displayName}
                          {isCurrent && <span>YOU</span>}
                        </h3>
                        <p>Level {entry.level}</p>
                      </div>
                      <strong>{entry.totalXp} XP</strong>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
        </>
        )}
        </>
        )}
      </main>

      <CinematicFooter />
      <MobileStartBar href={isFairOperation ? eventHref : '/#operations'} />
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={null}>
      <LeaderboardContent />
    </Suspense>
  );
}
