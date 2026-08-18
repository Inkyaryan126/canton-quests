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
import ThreePathSelector from '@/components/ThreePathSelector';
import { Player, PublicQuestView, QuestEvent } from '@/lib/types';
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

function getStoredPlayer(): Player | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem('canton_quests_current_player');
  if (stored) {
    try {
      return JSON.parse(stored) as Player;
    } catch {
      // ignore
    }
  }
  return null;
}

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
  const [quests, setQuests] = useState<PublicQuestView[]>([]);

  useEffect(() => {
    // 1. Check client local storage
    const stored = getStoredPlayer();
    if (stored) setCurrentPlayerState(stored);

    // 2. Check auth API session
    const headers: Record<string, string> = {};
    const authToken = typeof window !== 'undefined' ? window.localStorage.getItem('canton_auth_token') : null;
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    fetch('/api/auth/me', { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.isAuthenticated && data.player) {
          setCurrentPlayerState(data.player);
        }
      })
      .catch(() => {});

    // 3. Load active event & quests
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
      .then((data: { quests?: PublicQuestView[] } | undefined) => {
        setQuests(data?.quests || []);
      })
      .catch(() => {});
  }, []);

  const activeEvent = getActiveEvent(events);
  const eventHref = activeEvent ? `/events/${activeEvent.slug}` : '/events/canton-weekend-1';

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref={eventHref} />

      <main>
        {/* HERO SECTION */}
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
            <span>SIGNAL ACTIVE • KICKOFF SEPTEMBER 11, 2026</span>
          </div>
          <div className="cq-hero-hud cq-hero-hud-bottom" aria-hidden="true">
            <span>40.7998° N</span>
            <span>81.3784° W</span>
            <strong>CANTON, OHIO</strong>
          </div>

          <div className="cq-hero-content">
            <div className="cq-eyebrow">
              <Sparkles size={16} aria-hidden="true" />
              REAL-WORLD CITY GAME
            </div>

            <h1 id="cq-hero-title">
              ADVENTURE
              <span>STARTS HERE.</span>
            </h1>

            <p>
              Canton is the game board. Pick real quests, explore physical landmarks, crack ciphers, and climb one citywide leaderboard. Free to enter.
            </p>

            <div className="cq-hero-buttons">
              <a href="#choose-path" className="cq-gold-button cq-primary-cta">
                CHOOSE YOUR PATH
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <Link href="/how-it-works" className="cq-dark-button">
                HOW IT WORKS
              </Link>
              <Link href="/quests" className="cq-dark-button">
                EXPLORE MISSIONS
              </Link>
            </div>

            {currentPlayer && (
              <div className="cq-returning-player" aria-label="Returning player quick continue">
                <div>
                  <span>WELCOME BACK AGENT</span>
                  <strong>{currentPlayer.displayName}</strong>
                </div>
                <b>{currentPlayer.totalXp || 0} XP</b>
                <Link href={eventHref}>CONTINUE QUEST</Link>
              </div>
            )}
          </div>

          <div className="cq-scroll-cue" aria-hidden="true">
            <ChevronDown size={22} />
          </div>
        </section>

        <div className="cq-torn-transition" aria-hidden="true" />

        {/* SHORT HOW IT WORKS (PICK, GO, PROVE, SCORE) */}
        <section className="cq-section cq-pillars-section" aria-labelledby="how-it-works-pillars-heading">
          <div className="cq-section-shell space-y-12">
            <div className="text-center max-w-2xl mx-auto mb-4">
              <span className="cq-kicker">GAMEPLAY LOOP</span>
              <h2 id="how-it-works-pillars-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                Four Steps to Conquer Canton
              </h2>
            </div>

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

            {/* CHOOSE YOUR STARTING PATH */}
            <ThreePathSelector
              currentPath={currentPlayer?.selectedStartingPath || null}
              onSelectPath={(path) => {
                if (currentPlayer) {
                  const updated = { ...currentPlayer, selectedStartingPath: path };
                  setCurrentPlayerState(updated);
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem('canton_quests_current_player', JSON.stringify(updated));
                  }
                }
              }}
              eventSlug={activeEvent?.slug || 'canton-weekend-1'}
            />
          </div>
        </section>

        {/* SELECTED REAL CANTON LOCATIONS / GAME WORLD */}
        <section className="cq-section cq-destinations-section" aria-labelledby="destinations-heading">
          <div className="cq-section-shell">
            <div className="cq-section-heading">
              <div>
                <span className="cq-kicker">THE CITY IS THE GAME BOARD</span>
                <h2 id="destinations-heading">REAL PLACES. REAL MISSIONS.</h2>
              </div>
              <a href="#choose-path" className="cq-view-all-button">
                CHOOSE PATH
                <ArrowRight size={16} aria-hidden="true" />
              </a>
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

        {/* ONE STRONG FINAL CTA */}
        <section className="cq-live-cta" aria-labelledby="final-cta-heading">
          <div className="cq-live-cta-art" aria-hidden="true">
            <Image
              src={cqImages.mapHud}
              alt="Tactical Canton map HUD"
              fill
              sizes="(max-width: 820px) 100vw, 40vw"
            />
          </div>
          <div className="cq-live-cta-copy">
            <span className="cq-kicker">CANTON QUESTS VOLUME 1</span>
            <h2 id="final-cta-heading">THE CITY IS WAITING.</h2>
            <p>
              Kickoff begins September 11, 2026. Choose your starting path, set your callsign,
              and get ready to explore downtown Canton on one citywide leaderboard.
            </p>
            <div className="cq-live-buttons">
              <a href="#choose-path" className="cq-gold-button">
                CHOOSE YOUR PATH
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <Link href="/leaderboard" className="cq-dark-button">
                VIEW LEADERBOARD
                <Crown size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href="#choose-path" />
    </div>
  );
}
