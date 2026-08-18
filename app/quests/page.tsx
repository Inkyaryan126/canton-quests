'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Compass,
  Filter,
  KeyRound,
  MapPin,
  Radar,
  Radio,
  Search,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import PlayerIdentityBar from '@/components/PlayerIdentityBar';
import QuestListScanEffect from '@/components/game-effects/QuestListScanEffect';
import { showGameMoment } from '@/lib/game-effects';
import { Player, PublicQuestView, QuestCategory, QuestEvent, StartingPath } from '@/lib/types';
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

type QuestFilter = 'all' | 'flash' | 'secret' | QuestCategory;
type PathFilter = 'all' | StartingPath;

const categoryFilters: { label: string; value: QuestFilter }[] = [
  { label: 'All Types', value: 'all' },
  { label: 'Landmarks', value: 'exploration' },
  { label: 'Puzzles & Ciphers', value: 'puzzle' },
  { label: 'Arts & Media', value: 'creative' },
  { label: 'Partner Stops', value: 'business_partner' },
  { label: 'Flash Drops', value: 'flash' },
  { label: 'Hidden', value: 'secret' },
];

const pathFilters: { label: string; value: PathFilter; icon: any; color: string; desc: string }[] = [
  { label: 'All City Quests', value: 'all', icon: Sparkles, color: '#f59e0b', desc: 'Complete citywide mission grid' },
  { label: 'Arts District', value: 'family', icon: Compass, color: '#f59e0b', desc: 'Downtown Arts & Centennial Plaza' },
  { label: 'Mother Goose Land', value: 'challenge', icon: Zap, color: '#ef4444', desc: 'Mother Goose Land & Skate Corridor' },
  { label: 'Monument Park', value: 'secret', icon: KeyRound, color: '#a855f7', desc: 'Monument Park & Historic Ciphers' },
];

export default function QuestsPage() {
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [quests, setQuests] = useState<PublicQuestView[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<QuestFilter>('all');
  const [activePathFilter, setActivePathFilter] = useState<PathFilter>('all');

  useEffect(() => {
    const headers: Record<string, string> = {};
    const authToken = typeof window !== 'undefined' ? window.localStorage.getItem('canton_auth_token') : null;
    if (authToken) {
      headers['authorization'] = `Bearer ${authToken}`;
    }

    fetch('/api/auth/me', { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.player) setCurrentPlayer(data.player);
      })
      .catch(() => {});

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
      });
  }, []);

  const activeEvent = getActiveEvent(events);
  const eventHref = activeEvent ? `/events/${activeEvent.slug}` : '/events';

  const filteredQuests = useMemo(() => {
    return quests
      .filter((quest) => quest.status === 'active')
      .filter((quest) => {
        // 1. Path filter
        if (activePathFilter !== 'all') {
          if (quest.startingPath !== activePathFilter) return false;
        }
        // 2. Category filter
        if (activeCategoryFilter === 'all') return true;
        if (activeCategoryFilter === 'flash') return quest.isFlash;
        if (activeCategoryFilter === 'secret') return !!quest.isSecret;
        return quest.category === activeCategoryFilter;
      })
      .sort((a, b) => {
        // Prioritize quests on player's chosen starting path
        if (currentPlayer?.selectedStartingPath) {
          const aMatch = a.startingPath === currentPlayer.selectedStartingPath ? 1 : 0;
          const bMatch = b.startingPath === currentPlayer.selectedStartingPath ? 1 : 0;
          if (bMatch !== aMatch) return bMatch - aMatch;
        }
        return b.pointValue - a.pointValue;
      });
  }, [activeCategoryFilter, activePathFilter, quests, currentPlayer]);

  const topQuest = filteredQuests[0] || quests[0];

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref={eventHref} />

      <main className="cq-page-main">
        <section className="cq-page-hero cq-page-hero-split">
          <div>
            <span className="cq-kicker">CANTON MISSION GRID</span>
            <h1>LIVE QUEST BOARD</h1>
            <p>
              Explore real Canton landmarks. Solve clues, verify check-ins, record video celebrations,
              and earn XP on the official city leaderboard.
            </p>
            <div className="cq-page-actions">
              <Link href={eventHref} className="cq-gold-button">
                START PLAYING
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/profile" className="cq-dark-button">
                MY PROFILE & ACHIEVEMENTS
              </Link>
            </div>
          </div>
          <div className="cq-page-hero-art">
            <Image src={cqImages.mapHud} alt="Canton quest map interface" fill priority sizes="(max-width: 900px) 100vw, 44vw" />
          </div>
        </section>

        {/* Identity & Starting Path Bar */}
        <section className="max-w-6xl mx-auto px-4 mb-4">
          <PlayerIdentityBar onPlayerChanged={setCurrentPlayer} />
        </section>

        {/* Path Guidance Alert */}
        <section className="max-w-6xl mx-auto px-4 mb-6">
          <div className="p-4 rounded-2xl bg-stone-900/80 border border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles size={18} className="text-amber-400 shrink-0" />
              <div>
                <strong className="text-white block font-mono">Three Starting Districts • Open City Grid</strong>
                <span className="text-stone-300 font-body">
                  Your starting path guides where to begin, but never restricts you. You can solve any quest in any order across Canton!
                </span>
              </div>
            </div>
            <Link
              href="/start/family"
              className="text-amber-400 hover:text-amber-300 font-mono underline underline-offset-2 shrink-0"
            >
              Explore Starting Paths →
            </Link>
          </div>
        </section>

        {topQuest && (
          <section className="cq-feature-panel">
            <Image src={getQuestImage(topQuest, 0)} alt={`${cleanQuestTitle(topQuest.title)} featured quest`} fill sizes="100vw" />
            <div>
              <span className="cq-kicker">FEATURED MISSION</span>
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
          {/* Starting District Filter Tabs */}
          <div className="mb-6">
            <div className="text-xs font-mono font-bold text-stone-400 uppercase tracking-wider mb-2">
              Filter By District / Starting Path:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {pathFilters.map((p) => {
                const Icon = p.icon;
                const isActive = activePathFilter === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setActivePathFilter(p.value)}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      isActive
                        ? 'bg-stone-900 border-2 font-bold shadow-lg scale-[1.02]'
                        : 'bg-stone-950/60 border-stone-800 hover:border-stone-700 text-stone-400'
                    }`}
                    style={{ borderColor: isActive ? p.color : undefined }}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-mono text-white font-bold">{p.label}</span>
                      <Icon size={14} style={{ color: p.color }} />
                    </div>
                    <span className="text-[10px] text-stone-400 font-body truncate">{p.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* City Scan Status and Control Bar */}
          <div className="mb-6">
            <QuestListScanEffect
              questCount={filteredQuests.length}
              districtName={
                activePathFilter === 'family'
                  ? 'ARTS DISTRICT'
                  : activePathFilter === 'challenge'
                  ? 'MOTHER GOOSE LAND'
                  : activePathFilter === 'secret'
                  ? 'MONUMENT PARK'
                  : 'ALL CANTON DISTRICTS'
              }
            />
          </div>

          {/* Mission Type Category Filters */}
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">MISSION BOARD</span>
              <h2>ALL ACTIVE MISSIONS</h2>
            </div>
            <div className="cq-filter-label">
              <Filter size={16} aria-hidden="true" />
              {filteredQuests.length} missions
            </div>
          </div>

          <div className="cq-filter-row" aria-label="Quest categories">
            {categoryFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveCategoryFilter(filter.value)}
                className={activeCategoryFilter === filter.value ? 'is-active' : ''}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {quests.length === 0 ? (
            <div className="relative overflow-hidden p-10 sm:p-14 rounded-3xl bg-stone-950 border border-stone-800 text-center space-y-4 max-w-3xl mx-auto my-8 shadow-2xl">
              <Image
                src={cqImages.questBoardBg}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 800px"
                className="object-cover opacity-20 pointer-events-none"
              />
              <div className="relative z-10 space-y-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono text-xs font-bold uppercase tracking-widest">
                  <Radio size={14} className="text-amber-400 animate-pulse" />
                  <span>GRID LOCKED • MISSIONS ACTIVATE SEPTEMBER 11</span>
                </div>
                <h2 className="text-3xl font-black font-display text-white uppercase tracking-tight">
                  Field Missions Standing By
                </h2>
                <p className="text-sm text-stone-300 font-body max-w-lg mx-auto leading-relaxed">
                  Canton Quests targets unlock on September 11, 2026. Choose your starting path now to prepare your callsign for kickoff.
                </p>
                <div className="pt-3">
                  <Link href="/#choose-path" className="cq-gold-button inline-flex">
                    CHOOSE STARTING PATH
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="cq-quest-grid cq-quest-grid-large">
              {filteredQuests.map((quest, index) => {
                const rarity = getQuestRarity(quest);
                const isRecommended = quest.startingPath && quest.startingPath === currentPlayer?.selectedStartingPath;

                return (
                  <Link
                    href={`${eventHref}/quests/${quest.id}`}
                    className="cq-quest-card cq-card-stagger"
                    style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
                    key={quest.id}
                  >
                    <div className="cq-quest-image cq-quest-image-tall">
                      <Image
                        src={getQuestImage(quest, index)}
                        alt={`${cleanQuestTitle(quest.title)} quest location`}
                        fill
                        sizes="(max-width: 760px) 100vw, 33vw"
                      />
                      <span className={`cq-rarity ${rarityClassName[rarity] || ''}`}>{rarity}</span>
                      {isRecommended && (
                        <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-amber-500 text-black font-mono font-extrabold text-[10px] uppercase tracking-wider shadow-lg">
                          ★ Recommended For You
                        </span>
                      )}
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
          )}

          {quests.length > 0 && filteredQuests.length === 0 && (
            <div className="cq-empty-state">
              <Search size={24} aria-hidden="true" />
              <h3>No missions matching this district & type filter.</h3>
              <p>Switch district tabs or categories above to explore the rest of Canton.</p>
            </div>
          )}
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href={eventHref} />
    </div>
  );
}
