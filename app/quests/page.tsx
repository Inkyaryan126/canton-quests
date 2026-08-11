'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Filter, MapPin, Radar, Search, Zap } from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import { Quest, QuestEvent } from '@/lib/types';
import { getEvents, getQuestsForEvent } from '@/lib/game-engine';
import {
  cleanQuestTitle,
  cqImages,
  getActiveEvent,
  getQuestImage,
  getQuestRarity,
  proofTypeLabels,
  questCategoryLabels,
  rarityClassName,
} from '@/lib/marketing-assets';

type QuestFilter = 'all' | 'flash' | 'secret' | Quest['category'];

const filters: { label: string; value: QuestFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Landmarks', value: 'exploration' },
  { label: 'Puzzles', value: 'puzzle' },
  { label: 'Arts', value: 'creative' },
  { label: 'Partner Stops', value: 'business_partner' },
  { label: 'Flash Drops', value: 'flash' },
  { label: 'Hidden', value: 'secret' },
];

export default function QuestsPage() {
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [activeFilter, setActiveFilter] = useState<QuestFilter>('all');

  useEffect(() => {
    const loadedEvents = getEvents();
    const active = getActiveEvent(loadedEvents);
    setEvents(loadedEvents);
    setQuests(active ? getQuestsForEvent(active.id) : []);
  }, []);

  const activeEvent = getActiveEvent(events);
  const eventHref = activeEvent ? `/events/${activeEvent.slug}` : '/events';

  const filteredQuests = useMemo(() => {
    return quests
      .filter((quest) => quest.status === 'active')
      .filter((quest) => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'flash') return quest.isFlash;
        if (activeFilter === 'secret') return !!quest.isSecret;
        return quest.category === activeFilter;
      })
      .sort((a, b) => b.pointValue - a.pointValue);
  }, [activeFilter, quests]);

  const topQuest = filteredQuests[0] || quests[0];

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref={eventHref} />

      <main className="cq-page-main">
        <section className="cq-page-hero cq-page-hero-split">
          <div>
            <span className="cq-kicker">QUEST DISCOVERY</span>
            <h1>PICK A QUEST.</h1>
            <p>
              Choose one mission, go to the location, complete the proof, and earn XP.
            </p>
            <div className="cq-page-actions">
              <Link href={eventHref} className="cq-gold-button">
                START QUEST
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/how-it-works" className="cq-dark-button">
                HOW IT WORKS
              </Link>
            </div>
          </div>
          <div className="cq-page-hero-art">
            <Image src={cqImages.mapHud} alt="Canton quest map interface" fill priority sizes="(max-width: 900px) 100vw, 44vw" />
          </div>
        </section>

        {topQuest && (
          <section className="cq-feature-panel">
            <Image src={getQuestImage(topQuest, 0)} alt={`${cleanQuestTitle(topQuest.title)} featured quest`} fill sizes="100vw" />
            <div>
              <span className="cq-kicker">BEST FIRST PICK</span>
              <h2>{cleanQuestTitle(topQuest.title)}</h2>
              <p>{topQuest.description}</p>
              <Link href={`${eventHref}/quests/${topQuest.id}`} className="cq-gold-button">
                VIEW QUEST
                <Radar size={17} aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}

        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">AVAILABLE NOW</span>
              <h2>MISSION BOARD</h2>
            </div>
            <div className="cq-filter-label">
              <Filter size={16} aria-hidden="true" />
              {filteredQuests.length} missions
            </div>
          </div>

          <div className="cq-filter-row" aria-label="Quest filters">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={activeFilter === filter.value ? 'is-active' : ''}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="cq-quest-grid cq-quest-grid-large">
            {filteredQuests.map((quest, index) => {
              const rarity = getQuestRarity(quest);

              return (
                <Link href={`${eventHref}/quests/${quest.id}`} className="cq-quest-card" key={quest.id}>
                  <div className="cq-quest-image cq-quest-image-tall">
                    <Image
                      src={getQuestImage(quest, index)}
                      alt={`${cleanQuestTitle(quest.title)} quest location`}
                      fill
                      sizes="(max-width: 760px) 100vw, 33vw"
                    />
                    <span className={`cq-rarity ${rarityClassName[rarity] || ''}`}>{rarity}</span>
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
                      <span>{questCategoryLabels[quest.category]}</span>
                      <span>{proofTypeLabels[quest.verificationType]}</span>
                      <span className="cq-card-action">View Quest</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {filteredQuests.length === 0 && (
            <div className="cq-empty-state">
              <Search size={24} aria-hidden="true" />
              <h3>No missions in this filter.</h3>
              <p>Switch categories to see the rest of the mission board.</p>
            </div>
          )}
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href={eventHref} />
    </div>
  );
}
