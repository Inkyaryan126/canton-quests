'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Crown, Medal, Radio, Trophy, Zap } from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import PageHeader from '@/components/PageHeader';
import { LeaderboardEntry, Player, QuestEvent } from '@/lib/types';
import { cqImages, formatEventWindow, getActiveEvent } from '@/lib/marketing-assets';
import PlayerAvatar from "@/components/PlayerAvatar";

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

  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<QuestEvent | null>(null);

  useEffect(() => {
    setCurrentPlayer(getClientPlayer());
    fetch('/api/game/events')
      .then((res) => res.json())
      .then((data: { events?: QuestEvent[] }) => {
        const loadedEvents = data.events || [];
        setEvents(loadedEvents);
        const target = operationSlug
          ? loadedEvents.find((e) => e.slug === operationSlug)
          : getActiveEvent(loadedEvents);
        setSelectedEvent(target || null);
        if (!target) return;
        return fetch(`/api/game/events/${target.slug}`);
      })
      .then((res) => res?.json())
      .then((data: { leaderboard?: LeaderboardEntry[] } | undefined) => {
        setEntries(data?.leaderboard || []);
      });
  }, [operationSlug]);

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
                <Link href="/quests" className="cq-dark-button cq-btn-sm">
                  BROWSE QUESTS
                </Link>
              </div>
            }
            divider
          />
        </section>

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
            <div className="relative overflow-hidden p-10 sm:p-14 rounded-3xl bg-stone-950 border border-stone-800 text-center space-y-4 max-w-3xl mx-auto my-8 shadow-2xl">
              <Image
                src={cqImages.leaderboardBg}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 800px"
                className="object-cover opacity-20 pointer-events-none"
              />
              {isFairOperation ? (
                <div className="relative z-10 space-y-3">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 font-mono text-xs font-bold uppercase tracking-widest">
                    <Trophy size={14} className="text-cyan-400" />
                    <span>FAIR QR HUNT • SEPT 1 – SEPT 7</span>
                  </div>
                  <h2 className="text-3xl font-black font-display text-white uppercase tracking-tight">
                    No Fair Scores Yet
                  </h2>
                  <p className="text-sm text-stone-300 font-body max-w-lg mx-auto leading-relaxed">
                    Live Fair QR Hunt rankings will stream here as players secure Signals across the fairgrounds — no starting path required.
                  </p>
                  <div className="pt-3">
                    <Link href="/events/fair-qr-hunt" className="cq-gold-button inline-flex">
                      ENTER THE FAIR QR HUNT
                      <Zap size={16} />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="relative z-10 space-y-3">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono text-xs font-bold uppercase tracking-widest">
                    <Trophy size={14} className="text-amber-400" />
                    <span>PRE-SEASON ACTIVE • KICKOFF SEPTEMBER 11</span>
                  </div>
                  <h2 className="text-3xl font-black font-display text-white uppercase tracking-tight">
                    Leaderboard Activates September 11
                  </h2>
                  <p className="text-sm text-stone-300 font-body max-w-lg mx-auto leading-relaxed">
                    Live individual agent rankings and XP scoring will stream here in real time as players verify field missions across Canton.
                  </p>
                  <div className="pt-3">
                    <Link href="/#choose-path" className="cq-gold-button inline-flex">
                      CHOOSE STARTING PATH
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
