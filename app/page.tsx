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
import PlayerAvatar from '@/components/PlayerAvatar';
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
import { Play, Gift, HelpCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { isProfileIdentityComplete } from '@/lib/player-command-center';

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
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    // 1. Check client local storage display cache
    const stored = getStoredPlayer();
    if (stored) setCurrentPlayerState(stored);

    // 2. Check authoritative auth API session via cookies
    fetch('/api/auth/me')
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

      <main className="cq-page-main pt-4">
        {/* AUTHENTICATED AGENT HERO BANNER */}
        {currentPlayer && (() => {
          const identityComplete = isProfileIdentityComplete(currentPlayer);
          return (
          <section className="cq-section pt-2 pb-6" aria-label="Authenticated player welcome">
            <div className="cq-section-shell">
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-950/40 via-stone-900/90 to-stone-950/90 border-2 border-amber-500/40 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-stone-950 border-2 border-amber-400 flex items-center justify-center text-3xl shadow-lg shrink-0 overflow-hidden">
                    <PlayerAvatar
                      avatarUrl={currentPlayer.avatarUrl}
                      cropZoom={currentPlayer.profileImageCropZoom}
                      cropX={currentPlayer.profileImageCropX}
                      cropY={currentPlayer.profileImageCropY}
                      size={64}
                      style={{ borderRadius: '1rem' }}
                      fallback="⚡"
                      ariaLabel={`${currentPlayer.displayName || 'Player'} avatar`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-mono font-bold uppercase text-amber-400 tracking-wider">
                        ACTIVE AGENT LOGGED IN
                      </span>
                    </div>
                    {identityComplete ? (
                      <>
                        <h2 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                          WELCOME BACK, {currentPlayer.displayName}
                        </h2>
                        <div className="flex items-center gap-3 text-xs font-mono text-stone-300 mt-1">
                          <span className="text-amber-400 font-bold">{currentPlayer.totalXp || 0} XP</span>
                          <span>•</span>
                          <span className="capitalize">{currentPlayer.selectedStartingPath || 'Family'} Path</span>
                          <span>•</span>
                          <span>Level {currentPlayer.level || 1}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                          COMPLETE YOUR PLAYER IDENTITY
                        </h2>
                        <div className="flex items-center gap-3 text-xs font-mono text-stone-300 mt-1">
                          <span>Choose your district + image</span>
                          <span>•</span>
                          <span className="text-amber-400 font-bold">Earn +100 XP</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <Link
                    href="/profile"
                    className="cq-gold-button flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 text-xs font-mono py-3 px-6"
                  >
                    <span>{identityComplete ? 'ENTER COMMAND CENTER' : 'COMPLETE IDENTITY'}</span>
                    <ArrowRight size={15} />
                  </Link>
                  <Link
                    href="/quests"
                    className="cq-dark-button flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 text-xs font-mono py-3 px-5"
                  >
                    <Compass size={15} />
                    <span>BROWSE QUESTS</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
          );
        })()}

        {/* PROMOTIONAL BRIEFING TRANSMISSION & VIDEO PLAYER */}
        <section className="cq-section bg-stone-950/70 border-b border-stone-800/80 py-16" aria-labelledby="briefing-section-heading">
          <div className="cq-section-shell">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-4 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
                  <Radio size={14} className="text-amber-400 animate-pulse" />
                  <span>GAME MASTER TRANSMISSION</span>
                </div>
                <h2 id="briefing-section-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                  Official Mission Briefing
                </h2>
                <p className="text-sm text-stone-300 font-body leading-relaxed">
                  Watch the official Game Commander transmission for Canton Quests Volume 1. Learn how real-world landmarks,
                  street ciphers, and QR nodes connect across downtown Canton.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsVideoPlaying(true)}
                    className="cq-gold-button inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Play size={16} className="fill-black" />
                    <span>{isVideoPlaying ? 'PLAYING BRIEFING' : 'PLAY FULL BRIEFING'}</span>
                  </button>
                  <Link href="/how-it-works" className="cq-dark-button text-xs font-mono">
                    READ FIELD RULES
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-amber-500/30 shadow-2xl bg-black">
                  {isVideoPlaying ? (
                    <video
                      src={cqImages.promoVideo}
                      poster={cqImages.promoVideoPoster}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    >
                      Your browser does not support high-definition video playback.
                    </video>
                  ) : (
                    <div
                      onClick={() => setIsVideoPlaying(true)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsVideoPlaying(true)}
                      className="relative w-full h-full cursor-pointer group"
                    >
                      <Image
                        src={cqImages.promoVideoPoster}
                        alt="Game Commander Mission Briefing"
                        fill
                        sizes="(max-width: 1024px) 100vw, 60vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      
                      {/* Play Button Reticle */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-amber-500/90 text-black flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:bg-amber-400 transition-all">
                          <Play size={26} className="fill-black ml-1" />
                        </div>
                      </div>

                      {/* Video HUD Overlay */}
                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-stone-300 pointer-events-none">
                        <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                          <Radio size={12} className="text-red-500 animate-pulse" />
                          TRANSMISSION LOADED • CLICK TO PLAY
                        </span>
                        <span>2:17 • 1080P HD</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SHORT HOW IT WORKS (PICK, GO, PROVE, SCORE) & THREE DOORS PATH SELECTOR */}
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

        {/* PRIZE VAULT & TRANSPARENT DRAWING SECTION */}
        <section className="cq-section py-16" aria-labelledby="prize-vault-heading">
          <div className="cq-section-shell">
            <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-stone-950 p-8 sm:p-12 shadow-2xl">
              <Image
                src={cqImages.prizeVault}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 1200px"
                className="object-cover opacity-20 pointer-events-none"
              />
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
                    <Gift size={14} className="text-amber-400" />
                    <span>EVERY QUEST = ONE DRAWING ENTRY</span>
                  </div>
                  <h2 id="prize-vault-heading" className="font-display font-black text-2xl sm:text-4xl text-white uppercase tracking-tight">
                    $500 Prize Pool
                  </h2>
                  <p className="text-sm text-stone-300 font-body leading-relaxed">
                    Sign up for <strong>1 free drawing entry</strong>. Every verified completed mission earns <strong>+1 more entry</strong> into the cash drawings. Leaderboard prizes go to the top 2 XP scorers — no drawing entries required.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-stone-900/80 border border-stone-800">
                      <span className="text-amber-400 font-bold block text-[11px] uppercase mb-1.5">COMPETE FOR</span>
                      <div className="space-y-1 text-stone-300">
                        <div>🥇 Leaderboard Champion — <strong className="text-white">$200</strong></div>
                        <div>🥈 Leaderboard Runner-Up — <strong className="text-white">$100</strong></div>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-stone-900/80 border border-stone-800">
                      <span className="text-amber-400 font-bold block text-[11px] uppercase mb-1.5">CASH DRAWINGS</span>
                      <div className="space-y-1 text-stone-300">
                        <div>🎟 $100 Cash Drawing</div>
                        <div>🎟 $50 Cash Drawing</div>
                        <div>🎟 $50 Cash Drawing</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link
                      href="/events/canton-weekend-1/drawing"
                      className="cq-gold-button inline-flex items-center gap-2 text-xs font-mono"
                    >
                      <span>VIEW LIVE PRIZE LEDGER</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-5 p-6 rounded-2xl bg-stone-900/90 border border-stone-800 text-xs font-mono space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-bold uppercase text-[11px]">
                    <HelpCircle size={15} />
                    <span>YOUR XP SCORE</span>
                  </div>
                  <p className="text-stone-300 leading-relaxed">
                    <strong>XP means Experience Points.</strong> You earn XP when verified quests are completed. XP is your score in Canton Quests. The more XP you earn, the higher you climb on the citywide leaderboard.
                  </p>
                  <div className="pt-2 border-t border-stone-800 text-[11px] text-stone-400">
                    XP determines leaderboard position. Drawing entries give chances at the $200 in random cash drawings. One entry = one chance.
                  </div>
                </div>
              </div>
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
