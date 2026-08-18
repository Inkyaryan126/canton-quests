'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Crown, Medal, Radio, Trophy, Zap } from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import { LeaderboardEntry, Player, QuestEvent } from '@/lib/types';
import { cqImages, formatEventWindow, getActiveEvent } from '@/lib/marketing-assets';

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

export default function LeaderboardPage() {
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    setCurrentPlayer(getClientPlayer());
    fetch('/api/game/events')
      .then((res) => res.json())
      .then((data: { events?: QuestEvent[] }) => {
        const loadedEvents = data.events || [];
        const active = getActiveEvent(loadedEvents);
        setEvents(loadedEvents);
        if (!active) return;
        return fetch(`/api/game/events/${active.slug}`);
      })
      .then((res) => res?.json())
      .then((data: { leaderboard?: LeaderboardEntry[] } | undefined) => {
        setEntries(data?.leaderboard || []);
      });
  }, []);

  const activeEvent = getActiveEvent(events);
  const eventHref = activeEvent ? `/events/${activeEvent.slug}` : '/events';
  const topThree = entries.slice(0, 3);

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref={eventHref} />

      <main className="cq-page-main">
        <section className="cq-page-hero cq-page-hero-split">
          <div>
            <span className="cq-kicker">LIVE STANDINGS</span>
            <h1>CLIMB THE BOARD.</h1>
            <p>
              Complete quests to earn XP. The more proof you verify, the higher you rank.
            </p>
            <div className="cq-page-actions">
              <Link href={eventHref} className="cq-gold-button">
                START QUEST
                <Zap size={17} aria-hidden="true" />
              </Link>
              <Link href="/quests" className="cq-dark-button">
                BROWSE QUESTS
              </Link>
            </div>
          </div>
          <div className="cq-page-hero-art">
            <Image src={cqImages.footballClose} alt="Competitive Canton sculpture at sunset" fill priority sizes="(max-width: 900px) 100vw, 44vw" />
          </div>
        </section>

        <section className="cq-scoreboard-overview">
          <div>
            <span className="cq-kicker">CURRENT QUEST</span>
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
            <div className="p-10 rounded-2xl bg-stone-950/80 border border-stone-800 text-center space-y-3 max-w-2xl mx-auto my-8">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono text-xs font-bold uppercase tracking-widest">
                <Trophy size={14} className="text-amber-400" />
                <span>PRE-SEASON ACTIVE • KICKOFF SEPTEMBER 11</span>
              </div>
              <h2 className="text-2xl font-black font-display text-white uppercase tracking-tight">
                Leaderboard Activates September 11
              </h2>
              <p className="text-sm text-stone-300 font-body max-w-md mx-auto leading-relaxed">
                Live individual agent rankings and XP scoring will stream here in real time as players verify field missions across Canton.
              </p>
              <div className="pt-3">
                <Link href="/#choose-path" className="cq-gold-button inline-flex">
                  CHOOSE STARTING PATH
                  <Zap size={16} />
                </Link>
              </div>
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
                  <div>{entry.avatarUrl || '⚡'}</div>
                  <h2>{entry.displayName}</h2>
                  <strong>{entry.totalPoints} XP</strong>
                  <p>{entry.questsCompletedCount} missions verified</p>
                </article>
              ))}
            </section>

            <section className="cq-page-section cq-board-section">
              <div className="cq-section-heading">
                <div>
                  <span className="cq-kicker">INDIVIDUAL BOARD</span>
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
                      <div className="cq-rank-avatar">{entry.avatarUrl || '⚡'}</div>
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
      <MobileStartBar href={eventHref} />
    </div>
  );
}
