'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, Radio, ShieldCheck, Zap } from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import { EventReadiness, QuestEvent } from '@/lib/types';
import { getEventReadinessCheck, getEvents } from '@/lib/game-engine';
import { cqImages, destinationCards, formatEventWindow, getActiveEvent } from '@/lib/marketing-assets';

export default function EventsPage() {
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [metrics, setMetrics] = useState<Record<string, EventReadiness['metrics']>>({});

  useEffect(() => {
    const loadedEvents = getEvents();
    setEvents(loadedEvents);

    const metricMap: Record<string, EventReadiness['metrics']> = {};
    loadedEvents.forEach((event) => {
      metricMap[event.id] = getEventReadinessCheck(event.id).metrics;
    });
    setMetrics(metricMap);
  }, []);

  const activeEvent = getActiveEvent(events);
  const eventHref = activeEvent ? `/events/${activeEvent.slug}` : '/events';
  const activeMetrics = activeEvent ? metrics[activeEvent.id] : undefined;

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref={eventHref} />

      <main className="cq-page-main">
        <section className="cq-event-hero">
          <Image src={cqImages.heroCity} alt="Canton event skyline signal" fill priority sizes="100vw" />
          <div>
            <span className="cq-kicker">FLAGSHIP WEEKEND</span>
            <h1>{activeEvent?.title || 'Canton Quest Weekend'}</h1>
            <p>
              {activeEvent?.description ||
                'Pick quests, visit Canton locations, complete proof, earn XP, and climb the board.'}
            </p>
            <div className="cq-page-actions">
              <Link href={eventHref} className="cq-gold-button">
                START PLAYING
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/leaderboard" className="cq-dark-button">
                VIEW LEADERBOARD
              </Link>
            </div>
          </div>
        </section>

        <section className="cq-event-stats">
          <div>
            <CalendarDays size={22} aria-hidden="true" />
            <strong>{activeEvent ? formatEventWindow(activeEvent) : 'Loading'}</strong>
            <span>event window</span>
          </div>
          <div>
            <MapPin size={22} aria-hidden="true" />
            <strong>Downtown Canton</strong>
            <span>launch zone</span>
          </div>
          <div>
            <Zap size={22} aria-hidden="true" />
            <strong>{activeMetrics?.totalXp || 0} XP</strong>
            <span>available score</span>
          </div>
          <div>
            <Radio size={22} aria-hidden="true" />
            <strong>{activeMetrics?.totalQuests || 0}</strong>
            <span>live quests</span>
          </div>
        </section>

        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">EVENTS</span>
              <h2>PLAY WINDOWS</h2>
            </div>
            <Link href="/quests" className="cq-view-all-button">
              BROWSE QUESTS
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="cq-event-grid">
            {events.map((event, index) => {
              const eventMetrics = metrics[event.id];
              const image = index % 2 === 0 ? cqImages.heroCityBeam : cqImages.cantonSign;

              return (
                <article className="cq-event-card" key={event.id}>
                  <div className="cq-event-card-image">
                    <Image src={image} alt={`${event.title} artwork`} fill sizes="(max-width: 820px) 100vw, 44vw" />
                    <span>{event.status}</span>
                  </div>
                  <div>
                    <h3>{event.title}</h3>
                    <p>{event.description}</p>
                    <div className="cq-event-card-meta">
                      <span>{formatEventWindow(event)}</span>
                      <span>{eventMetrics?.totalQuests || 0} quests</span>
                      <span>{eventMetrics?.totalXp || 0} XP</span>
                    </div>
                    <Link href={`/events/${event.slug}`} className="cq-gold-button">
                      START EVENT
                      <ShieldCheck size={17} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">DESTINATION LAYER</span>
              <h2>WHERE THE GAME LANDS</h2>
            </div>
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
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href={eventHref} />
    </div>
  );
}
