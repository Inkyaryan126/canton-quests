'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Compass,
  Filter,
  KeyRound,
  MapPin,
  Radar,
  Radio,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import PlayerIdentityBar from '@/components/PlayerIdentityBar';
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
  { label: 'Secret Intel', value: 'secret' },
];

const pathFilters: { label: string; value: PathFilter; icon: any; color: string; desc: string }[] = [
  { label: 'All City Quests', value: 'all', icon: Sparkles, color: '#f59e0b', desc: 'Browse the complete Canton city grid' },
  { label: 'Arts District', value: 'family', icon: Compass, color: '#f59e0b', desc: 'Downtown Arts & Centennial Plaza' },
  { label: 'Mother Goose Land', value: 'challenge', icon: Zap, color: '#ef4444', desc: 'Mother Goose Land & Skate Corridor' },
  { label: 'Monument Park', value: 'secret', icon: KeyRound, color: '#a855f7', desc: 'Monument Park & Historic Ciphers' },
];

export default function QuestsPage() {
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [quests, setQuests] = useState<PublicQuestView[]>([]);
  const [isLoadingQuests, setIsLoadingQuests] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<QuestFilter>('all');
  const [activePathFilter, setActivePathFilter] = useState<PathFilter>('all');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.player) setCurrentPlayer(data.player);
      })
      .catch(() => {});

    async function loadQuests() {
      try {
        setIsLoadingQuests(true);
        const eventsRes = await fetch('/api/game/events');
        const eventsData: { events?: QuestEvent[] } = await eventsRes.json();
        const loadedEvents = eventsData.events || [];
        const active = getActiveEvent(loadedEvents);
        setEvents(loadedEvents);
        if (!active) {
          setIsLoadingQuests(false);
          return;
        }

        const questsRes = await fetch(`/api/game/events/${active.slug}`);
        const questsData: { quests?: PublicQuestView[] } = await questsRes.json();
        const loadedQuests = questsData.quests || [];
        setQuests(loadedQuests);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingQuests(false);
      }
    }

    loadQuests();
  }, []);

  const activeEvent = getActiveEvent(events);
  const eventHref = activeEvent ? `/events/${activeEvent.slug}` : '/events';

  const filteredQuests = useMemo(() => {
    return quests
      .filter((quest) => quest.status === 'active')
      .filter((quest) => {
        if (activePathFilter !== 'all') {
          if (quest.startingPath !== activePathFilter) return false;
        }
        if (activeCategoryFilter === 'all') return true;
        if (activeCategoryFilter === 'flash') return quest.isFlash;
        if (activeCategoryFilter === 'secret') return !!quest.isSecret;
        return quest.category === activeCategoryFilter;
      })
      .sort((a, b) => {
        if (currentPlayer?.selectedStartingPath) {
          const aMatch = a.startingPath === currentPlayer.selectedStartingPath ? 1 : 0;
          const bMatch = b.startingPath === currentPlayer.selectedStartingPath ? 1 : 0;
          if (bMatch !== aMatch) return bMatch - aMatch;
        }
        return b.pointValue - a.pointValue;
      });
  }, [activeCategoryFilter, activePathFilter, quests, currentPlayer]);

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref={eventHref} />

      <main className="cq-page-main">
        <section className="cq-page-hero cq-page-hero-split">
          <div>
            <span className="cq-kicker">CANTON MISSION GRID</span>
            <h1>LIVE QUEST BOARD</h1>
            <p>
              Real Canton landmarks. Real clues. Earn XP, verify your proof, and climb the citywide leaderboard.
            </p>
            <div className="cq-page-actions">
              <Link href={eventHref} className="cq-gold-button">
                START PLAYING
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/how-it-works" className="cq-dark-button">
                <BookOpen size={15} aria-hidden="true" />
                HOW IT WORKS
              </Link>
            </div>
          </div>
          <div
            className="cq-page-hero-art"
            role="img"
            aria-label="Canton quest map interface"
            style={{ backgroundImage: `url('${cqImages.mapHud}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
        </section>

        {/* Identity & Starting Path Bar */}
        <section className="cq-page-section" style={{ paddingTop: '0.75rem', paddingBottom: '0.5rem' }}>
          <PlayerIdentityBar onPlayerChanged={setCurrentPlayer} />
        </section>

        <section className="cq-page-section">
          {/* District Path Chips — filter by starting area */}
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.5rem' }}>
              Starting District
            </p>
            <div role="group" aria-label="Filter by starting district" className="cq-path-chips">
              {pathFilters.map((p) => {
                const Icon = p.icon;
                const isActive = activePathFilter === p.value;
                const chipClass = p.value === 'all' ? 'is-all'
                  : p.value === 'family' ? 'is-family'
                  : p.value === 'challenge' ? 'is-challenge'
                  : 'is-secret';
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setActivePathFilter(p.value)}
                    aria-pressed={isActive}
                    className={`cq-path-chip ${chipClass}${isActive ? ' is-active' : ''}`}
                  >
                    <Icon size={13} aria-hidden="true" />
                    {p.label}
                  </button>
                );
              })}
            </div>
            {activePathFilter !== 'all' && (
              <p style={{ marginTop: '0.45rem', fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {pathFilters.find(p => p.value === activePathFilter)?.desc} · all other quests still available
              </p>
            )}
          </div>

          {/* Mission Type + Count */}
          <div className="cq-section-heading" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', margin: 0 }}>
                Mission Type
              </p>
            </div>
            <div className="cq-filter-label">
              <Filter size={15} aria-hidden="true" />
              {isLoadingQuests ? 'Scanning...' : `${filteredQuests.length} missions`}
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

          {isLoadingQuests ? (
            <div className="p-12 text-center rounded-2xl bg-stone-950/60 border border-stone-800 text-stone-400 font-mono text-xs animate-pulse my-6 flex flex-col items-center justify-center gap-3">
              <Radar size={24} className="text-amber-400 animate-spin" />
              <span>SCANNING CANTON MISSION GRID...</span>
            </div>
          ) : quests.length === 0 ? (
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
                  Canton Quests targets unlock on September 11, 2026. Choose your starting path now — your callsign will be ready at kickoff.
                </p>
                <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                  <Link href="/#choose-path" className="cq-gold-button inline-flex">
                    CHOOSE STARTING PATH
                    <ArrowRight size={16} />
                  </Link>
                  <Link href="/how-it-works" className="cq-dark-button inline-flex">
                    HOW IT WORKS
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
                      {quest.isFlash && (
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider shadow-lg">
                          <Zap size={10} className="fill-black" aria-hidden="true" />
                          FLASH
                        </span>
                      )}
                      {quest.isFinaleQuest && (
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                          FINALE
                        </span>
                      )}
                      {isRecommended && (
                        <span className="cq-quest-recommended-badge">
                          ★ Your District
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
              <h3>No missions match this filter combination.</h3>
              <p>Try a different district or mission type above.</p>
            </div>
          )}
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href={eventHref} />
    </div>
  );
}
