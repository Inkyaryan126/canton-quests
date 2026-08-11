'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronDown,
  Compass,
  Crown,
  Flag,
  MapPin,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import PlayerIdentityBar from '@/components/PlayerIdentityBar';
import { Player, Quest, QuestEvent } from '@/lib/types';
import { getCurrentPlayer, getEvents, getQuestsForEvent } from '@/lib/game-engine';
import {
  cleanQuestTitle,
  cqImages,
  destinationCards,
  getActiveEvent,
  getQuestDuration,
  getQuestImage,
  getQuestRarity,
  questCategoryLabels,
  rarityClassName,
} from '@/lib/marketing-assets';

const featureBlocks = [
  {
    title: 'PICK',
    text: 'Choose a quest from the live board.',
    Icon: Compass,
  },
  {
    title: 'GO',
    text: 'Head to the real Canton location.',
    Icon: MapPin,
  },
  {
    title: 'PROVE',
    text: 'Scan, check in, solve, or submit proof.',
    Icon: ShieldCheck,
  },
  {
    title: 'SCORE',
    text: 'Earn XP and climb the leaderboard.',
    Icon: Trophy,
  },
];

export default function HomePage() {
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [currentPlayer, setCurrentPlayerState] = useState<Player | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);

  useEffect(() => {
    const loadedEvents = getEvents();
    const loadedPlayer = getCurrentPlayer();
    const active = getActiveEvent(loadedEvents);

    setEvents(loadedEvents);
    setCurrentPlayerState(loadedPlayer);
    setQuests(active ? getQuestsForEvent(active.id) : []);
  }, []);

  const activeEvent = getActiveEvent(events);
  const eventHref = activeEvent ? `/events/${activeEvent.slug}` : '/';
  const featuredQuests = useMemo(
    () =>
      quests
        .filter((quest) => quest.status === 'active' && !quest.isFinaleQuest)
        .sort((a, b) => b.pointValue - a.pointValue)
        .slice(0, 4),
    [quests]
  );

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref={eventHref} />

      <main>
        <section className="cq-hero" aria-labelledby="cq-hero-title">
          <Image
            src={cqImages.heroCity}
            alt="Canton city skyline at sunset"
            fill
            priority
            sizes="100vw"
            className="cq-hero-image"
          />
          <div className="cq-hero-scrim" />
          <div className="cq-hero-noise" />

          <div className="cq-hero-hud cq-hero-hud-top" aria-hidden="true">
            <Radio size={15} />
            <span>SIGNAL ACTIVE</span>
          </div>
          <div className="cq-hero-hud cq-hero-hud-bottom" aria-hidden="true">
            <span>40.7998° N</span>
            <span>81.3784° W</span>
            <strong>CANTON, OHIO</strong>
          </div>

          <div className="cq-hero-content">
            <div className="cq-eyebrow">
              <Sparkles size={16} aria-hidden="true" />
              EXPLORE. DISCOVER. CONQUER.
            </div>

            <h1 id="cq-hero-title">
              ADVENTURE
              <span>STARTS HERE.</span>
            </h1>

            <p>
              Pick a quest. Go to the location. Complete the mission.
              <br />
              Earn XP across real Canton landmarks.
            </p>

            <div className="cq-hero-buttons">
              <Link href={eventHref} className="cq-gold-button cq-primary-cta">
                START QUEST
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/quests" className="cq-dark-button">
                BROWSE QUESTS
              </Link>
              <Link href="/how-it-works" className="cq-dark-button">
                HOW IT WORKS
              </Link>
            </div>

            {currentPlayer && activeEvent && (
              <div className="cq-returning-player" aria-label="Returning player quick continue">
                <div>
                  <span>WELCOME BACK AGENT</span>
                  <strong>{currentPlayer.displayName}</strong>
                </div>
                <b>{currentPlayer.totalXp} XP</b>
                <Link href={eventHref}>CONTINUE QUEST</Link>
              </div>
            )}
          </div>

          <div className="cq-scroll-cue" aria-hidden="true">
            <ChevronDown size={22} />
          </div>
        </section>

        <div className="cq-torn-transition" aria-hidden="true" />

        <section className="cq-section cq-pillars-section">
          <div className="cq-section-shell">
            <div className="cq-pillars">
              {featureBlocks.map(({ title, text, Icon }) => (
                <article className="cq-pillar-card" key={title}>
                  <span className="cq-pillar-icon">
                    <Icon size={28} aria-hidden="true" />
                  </span>
                  <h2>{title}</h2>
                  <p>{text}</p>
                </article>
              ))}
            </div>

            <div className="cq-player-panel" aria-label="Player identity setup">
              <div className="cq-panel-header">
                <span>STEP 1</span>
                <strong>Create your callsign, then start the quest.</strong>
              </div>
              <PlayerIdentityBar onPlayerChanged={setCurrentPlayerState} />
            </div>
          </div>
        </section>

        <section className="cq-section cq-destinations-section">
          <div className="cq-section-shell">
            <div className="cq-section-heading">
              <div>
                <span className="cq-kicker">THE CITY IS THE GAME BOARD</span>
                <h2>REAL PLACES. REAL MISSIONS.</h2>
              </div>
              <Link href={eventHref} className="cq-view-all-button">
                START QUEST
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <div className="cq-destination-grid">
              {destinationCards.map((card) => (
                <article className="cq-destination-card" key={card.title}>
                  <Image src={card.image} alt={card.title} fill sizes="(max-width: 820px) 100vw, 25vw" />
                  <div>
                    <span>{card.label}</span>
                    <h3>{card.title}</h3>
                    <p>{card.copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="cq-divider" aria-label="Canton Quests tagline">
          <span />
          <div>
            <p>CANTON IS YOUR PLAYGROUND.</p>
            <h2>START WITH ONE QUEST.</h2>
          </div>
          <span />
        </section>

        <section id="featured-quests" className="cq-section cq-featured-section">
          <div className="cq-section-shell">
            <div className="cq-section-heading">
              <div>
                <span className="cq-kicker">LIVE QUEST BOARD</span>
                <h2>FEATURED QUESTS</h2>
              </div>
              <Link href="/quests" className="cq-view-all-button">
                VIEW ALL
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <div className="cq-quest-grid">
              {featuredQuests.map((quest, index) => {
                const rarity = getQuestRarity(quest);
                return (
                  <Link
                    href={`${eventHref}/quests/${quest.id}`}
                    className="cq-quest-card"
                    key={quest.id}
                  >
                    <div className="cq-quest-image">
                      <Image
                        src={getQuestImage(quest, index)}
                        alt={`${cleanQuestTitle(quest.title)} quest location`}
                        fill
                        sizes="(max-width: 760px) 100vw, 25vw"
                      />
                      <span className={`cq-rarity ${rarityClassName[rarity] || ''}`}>
                        {rarity}
                      </span>
                    </div>
                    <div className="cq-quest-body">
                      <div className="cq-quest-meta">
                        <span>
                          <MapPin size={13} aria-hidden="true" />
                          {quest.location?.name || 'Canton, OH'}
                        </span>
                        <span>
                          <Zap size={13} aria-hidden="true" />
                          +{quest.pointValue} XP
                        </span>
                      </div>
                      <h3>{cleanQuestTitle(quest.title)}</h3>
                      <p>{quest.description}</p>
                      <div className="cq-quest-footer">
                        <span>{getQuestDuration(quest)}</span>
                        <span>{questCategoryLabels[quest.category]}</span>
                        <span className="cq-card-action">View Quest</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="cq-live-cta">
          <div className="cq-live-cta-art" aria-hidden="true">
            <Image
              src={cqImages.mapHud}
              alt=""
              fill
              sizes="(max-width: 820px) 100vw, 40vw"
            />
          </div>
          <div className="cq-live-cta-copy">
            <span className="cq-kicker">CURRENT QUEST</span>
            <h2>THE CITY IS ALREADY IN PLAY.</h2>
            <p>
              Start the current Canton Quest, complete live missions, earn XP,
              and climb the leaderboard.
            </p>
            <div className="cq-live-buttons">
              <Link href={eventHref} className="cq-gold-button">
                START QUEST
                <Flag size={17} aria-hidden="true" />
              </Link>
              <Link href="/leaderboard" className="cq-dark-button">
                VIEW LEADERBOARD
                <Crown size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href={eventHref} />
    </div>
  );
}
