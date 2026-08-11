'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Crown, Medal, Radio, Shield, Trophy, UserRound, Zap } from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import { LeaderboardEntry, Player, QuestEvent, TeamLeaderboardEntry } from '@/lib/types';
import {
  getCurrentPlayer,
  getEvents,
  getLeaderboardForEvent,
  getTeamLeaderboardForEvent,
} from '@/lib/game-engine';
import { cqImages, formatEventWindow, getActiveEvent } from '@/lib/marketing-assets';

export default function LeaderboardPage() {
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [teamEntries, setTeamEntries] = useState<TeamLeaderboardEntry[]>([]);

  useEffect(() => {
    const loadedEvents = getEvents();
    const active = getActiveEvent(loadedEvents);
    setEvents(loadedEvents);
    setCurrentPlayer(getCurrentPlayer());

    if (active) {
      setEntries(getLeaderboardForEvent(active.id));
      setTeamEntries(getTeamLeaderboardForEvent(active.id));
    }
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
            <Shield size={20} aria-hidden="true" />
            <strong>{teamEntries.length}</strong>
            <span>active squads</span>
          </div>
        </section>

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
                      {entry.teamName || 'Solo Agent'} · {entry.questsCompletedCount} mission
                      {entry.questsCompletedCount === 1 ? '' : 's'} completed
                    </p>
                  </div>
                  <strong>{entry.totalPoints} XP</strong>
                </article>
              );
            })}
          </div>
        </section>

        <section className="cq-page-section cq-board-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">SQUAD PRESSURE</span>
              <h2>TEAM STANDINGS</h2>
            </div>
            <Trophy className="cq-heading-icon" size={32} aria-hidden="true" />
          </div>

          <div className="cq-rank-list">
            {teamEntries.map((team) => (
              <article key={team.teamId}>
                <div className="cq-rank-number">#{team.rank}</div>
                <div className="cq-rank-avatar">
                  <UserRound size={20} aria-hidden="true" />
                </div>
                <div className="cq-rank-name">
                  <h3>{team.teamName}</h3>
                  <p>
                    {team.memberCount} agents · Captain {team.captainName} · Code {team.joinCode}
                  </p>
                </div>
                <strong>{team.totalPoints} XP</strong>
              </article>
            ))}
          </div>
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href={eventHref} />
    </div>
  );
}
