'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, Radio, ShieldCheck, Zap } from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import { QuestEvent } from '@/lib/types';
import { cqImages, destinationCards, formatEventWindow, getActiveEvent } from '@/lib/marketing-assets';

export default function EventsPage() {
  const [events, setEvents] = useState<QuestEvent[]>([]);

  useEffect(() => {
    fetch('/api/game/events')
      .then((res) => res.json())
      .then((data: { events?: QuestEvent[] }) => {
        setEvents(data.events || []);
      });
  }, []);

  const activeEvent = getActiveEvent(events);
  const eventHref = activeEvent ? `/events/${activeEvent.slug}` : '/events';

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref={eventHref} context="global" />

      <main className="cq-page-main">
        <section className="cq-event-hero">
          <Image src={cqImages.heroCity} alt="Canton quest skyline signal" fill priority sizes="100vw" />
          <div>
            <span className="cq-kicker">FEATURED QUEST</span>
            <h1>{activeEvent?.title || 'Canton Quest Weekend'}</h1>
            <p>
              {activeEvent?.description ||
                'Start the quest, choose missions, visit Canton locations, submit proof, earn XP, and climb the board.'}
            </p>
            <div className="cq-page-actions">
              <Link href={eventHref} className="cq-gold-button">
                START QUEST
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
            <span>quest dates</span>
          </div>
          <div>
            <MapPin size={22} aria-hidden="true" />
            <strong>Downtown Canton</strong>
            <span>launch zone</span>
          </div>
          <div>
            <Zap size={22} aria-hidden="true" />
            <strong>0 XP</strong>
            <span>available score</span>
          </div>
          <div>
            <Radio size={22} aria-hidden="true" />
            <strong>0</strong>
            <span>missions</span>
          </div>
        </section>

        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">QUESTS</span>
              <h2>START HERE</h2>
            </div>
            <Link href="/events/canton-weekend-1/quests" className="cq-view-all-button">
              BROWSE QUESTS
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="cq-event-grid">
            {events.map((event, index) => {
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
                      <span>missions hidden until event entry</span>
                      <span>XP revealed in mission board</span>
                    </div>
                    <Link href={`/events/${event.slug}`} className="cq-gold-button">
                      START QUEST
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
