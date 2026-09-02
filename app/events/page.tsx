'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import OperationCard from '@/components/OperationCard';
import { QuestEvent } from '@/lib/types';
import { cqImages, missionPreviewCards, getActiveEvent, getOperationStatus } from '@/lib/marketing-assets';

export default function EventsPage() {
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/game/events')
      .then((res) => res.json())
      .then((data: { events?: QuestEvent[] }) => {
        setEvents(data.events || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeEvent = getActiveEvent(events);
  const eventHref = activeEvent ? `/events/${activeEvent.slug}` : '/events';

  const liveMissions = events.filter((e) => getOperationStatus(e) === 'LIVE');
  // Soonest-start-first, not raw creation order — created_at doesn't
  // necessarily match chronological Mission start order (e.g. the Sept 11
  // Founder's Cipher row predates the Sept 4 Fair QR Hunt row).
  const upcomingMissions = events
    .filter((e) => getOperationStatus(e) === 'UPCOMING')
    .sort((a, b) => (a.startTime ? new Date(a.startTime).getTime() : Infinity) - (b.startTime ? new Date(b.startTime).getTime() : Infinity));
  const endedMissions = events.filter((e) => getOperationStatus(e) === 'ENDED');

  const nextMission = upcomingMissions[0];
  const laterMissions = upcomingMissions.slice(1);

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref={eventHref} context="global" />

      <main className="cq-page-main">
        <section className="cq-event-hero">
          <Image src={cqImages.heroCity} alt="Canton quest skyline signal" fill priority sizes="100vw" />
          <div>
            <span className="cq-kicker">MISSION DIRECTORY</span>
            <h1>Canton Quests Missions</h1>
            <p>
              One permanent Player Identity gets you into every Mission Canton Quests runs. Each Mission has its own
              dates, scoring, prizes, and rules — some use a starting path, some don&apos;t.
            </p>
          </div>
        </section>

        <section className="cq-page-section">
          {loading ? (
            <p className="cq-empty-state" style={{ padding: '2rem 0' }}>Loading Missions...</p>
          ) : events.length === 0 ? (
            <p className="cq-empty-state" style={{ padding: '2rem 0' }}>No Missions are published yet. Check back soon.</p>
          ) : (
            <div className="space-y-10">
              {endedMissions.length > 0 && (
                <div>
                  <div className="cq-section-heading">
                    <div>
                      <span className="cq-kicker">PAST MISSIONS</span>
                      <h2>Mission Archive</h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {endedMissions.map((event) => (
                      <OperationCard key={event.id} event={event} status="ENDED" />
                    ))}
                  </div>
                </div>
              )}

              {liveMissions.length > 0 && (
                <div>
                  <div className="cq-section-heading">
                    <div>
                      <span className="cq-kicker">LIVE NOW</span>
                      <h2>Active Missions</h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {liveMissions.map((event) => (
                      <OperationCard key={event.id} event={event} status="LIVE" />
                    ))}
                  </div>
                </div>
              )}

              {nextMission && (
                <div>
                  <div className="cq-section-heading">
                    <div>
                      <span className="cq-kicker">NEXT MISSION</span>
                      <h2>Up Next</h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <OperationCard event={nextMission} status="INCOMING" />
                  </div>
                </div>
              )}

              {laterMissions.length > 0 && (
                <div>
                  <div className="cq-section-heading">
                    <div>
                      <span className="cq-kicker">COMING SOON</span>
                      <h2>After That</h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {laterMissions.map((event) => (
                      <OperationCard key={event.id} event={event} status="INCOMING" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">MISSION PREVIEW</span>
              <h2>Classified Field Files</h2>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary, #a8a29e)', fontSize: '0.85rem', marginTop: '-0.5rem', marginBottom: '1.5rem' }}>
            A glimpse inside the Mission — the full field board only unlocks once you enter.
          </p>

          <div className="cq-destination-grid">
            {missionPreviewCards.map((card) => (
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
