'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Compass,
  Crown,
  MapPin,
  Play,
  Radio,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import OperationCard from '@/components/OperationCard';
import PlayerAvatar from '@/components/PlayerAvatar';
import { Player, PublicRosterEntry, QuestEvent } from '@/lib/types';
import { cqImages, getActiveEvent } from '@/lib/marketing-assets';
import { isProfileIdentityComplete } from '@/lib/player-command-center';
import { createPlayerFileClickHandler } from '@/lib/player-file-nav';

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

function isOperationLive(event: QuestEvent): boolean {
  if (!event.startTime) return true;
  return new Date(event.startTime).getTime() <= Date.now();
}

// The short, platform-level join loop — applies to every Mission, not
// just the Sept 11 Founder's Cipher's quest mechanics.
const joinSteps = [
  {
    title: 'IDENTITY',
    text: 'Create your permanent Player Identity — free, good for every Mission.',
    Icon: Compass,
  },
  {
    title: 'MISSION',
    text: 'Choose an Active or Upcoming Mission to enter.',
    Icon: MapPin,
  },
  {
    title: 'OBJECTIVE',
    text: 'Complete real-world objectives — scan, solve, submit proof.',
    Icon: ShieldCheck,
  },
  {
    title: 'COMPETE',
    text: 'Earn points, climb the leaderboard, win real prizes.',
    Icon: Trophy,
  },
];

const platformPillars = [
  {
    title: 'REAL PLACES',
    text: 'Every mission plays out at an actual Canton landmark — not a screen.',
    Icon: MapPin,
  },
  {
    title: 'REAL CHALLENGES',
    text: 'Ciphers, sprints, scavenger hunts, and verified proof — no busywork.',
    Icon: ShieldCheck,
  },
  {
    title: 'REAL PRIZES',
    text: 'Cash prizes and leaderboard glory, across every Mission.',
    Icon: Trophy,
  },
  {
    title: 'ONE IDENTITY',
    text: 'Create it once. It carries across every Mission Canton Quests ever runs.',
    Icon: Users,
  },
];

export default function HomePage() {
  const router = useRouter();
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [currentPlayer, setCurrentPlayerState] = useState<Player | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [roster, setRoster] = useState<PublicRosterEntry[]>([]);
  // Shared with every other "go to /profile" control — see lib/player-file-nav.ts.
  const handlePlayerFileClick = createPlayerFileClickHandler(router, currentPlayer);

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

    // 3. Load every Mission (live + upcoming) for the Missions grid
    fetch('/api/game/events')
      .then((res) => res.json())
      .then((data: { events?: QuestEvent[] }) => {
        setEvents(data.events || []);
      })
      .catch(() => {});

    // 4. A small preview of the permanent Player Roster
    fetch('/api/game/roster')
      .then((res) => res.json())
      .then((data: { roster?: PublicRosterEntry[] }) => {
        setRoster(data.roster || []);
      })
      .catch(() => {});
  }, []);

  const activeEvent = getActiveEvent(events);
  const eventHref = activeEvent ? `/events/${activeEvent.slug}` : '/events/canton-weekend-1';
  const liveOperations = events.filter(isOperationLive);
  const incomingOperations = events.filter((e) => !isOperationLive(e));
  const rosterPreview = roster.slice(0, 6);

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref={eventHref} context="global" />

      <main className="cq-page-main pt-4">
        {/* A. HERO — PLAYER IDENTITY ACCESS */}
        {!currentPlayer && (
          <section className="cq-section pt-2 pb-6" aria-label="Player access">
            <div className="cq-section-shell">
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-stone-950 via-stone-900/90 to-cyan-950/30 border-2 border-cyan-500/30 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <span className="text-xs font-mono font-bold uppercase text-cyan-400 tracking-wider">
                    Welcome to the Canton Quests Command Center
                  </span>
                  <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight mt-1">
                    Your City. Your Missions.
                  </h1>
                  <p className="text-xs sm:text-sm text-stone-300 font-body mt-1 max-w-xl">
                    Canton Quests is a real-world adventure game — the city is the game board. Create your permanent
                    Player Identity once — no starting path required — and enter any Mission, live or upcoming.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <Link
                    href="/register"
                    className="cq-gold-button flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 text-xs font-mono py-3 px-6"
                  >
                    CREATE PLAYER IDENTITY
                    <ArrowRight size={15} />
                  </Link>
                  <Link
                    href="/login"
                    className="cq-dark-button flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 text-xs font-mono py-3 px-5"
                  >
                    ACCESS COMMAND CENTER
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* AUTHENTICATED AGENT HERO BANNER */}
        {currentPlayer && (() => {
          const identityComplete = isProfileIdentityComplete(currentPlayer);
          return (
          <section className="cq-section pt-2 pb-6" aria-label="Authenticated player welcome">
            <div className="cq-section-shell">
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-950/40 via-stone-900/90 to-stone-950/90 border-2 border-amber-500/40 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-stone-950 border-2 border-amber-400 flex items-center justify-center text-3xl shadow-lg shrink-0">
                    <PlayerAvatar
                      avatarUrl={currentPlayer.avatarUrl}
                      cropZoom={currentPlayer.profileImageCropZoom}
                      cropX={currentPlayer.profileImageCropX}
                      cropY={currentPlayer.profileImageCropY}
                      size={40}
                      style={{ borderRadius: '0.75rem' }}
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
                        <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                          WELCOME BACK, {currentPlayer.displayName}
                        </h1>
                        <div className="flex items-center gap-3 text-xs font-mono text-stone-300 mt-1">
                          <span className="text-amber-400 font-bold">{currentPlayer.totalXp || 0} XP</span>
                          <span>•</span>
                          <span>Level {currentPlayer.level || 1}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                          COMPLETE YOUR PLAYER IDENTITY
                        </h1>
                        <div className="flex items-center gap-3 text-xs font-mono text-stone-300 mt-1">
                          <span>Add a player image</span>
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
                    onClick={handlePlayerFileClick}
                    className="cq-gold-button flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 text-xs font-mono py-3 px-6"
                  >
                    <span>{identityComplete ? 'VIEW PLAYER FILE' : 'COMPLETE IDENTITY'}</span>
                    <ArrowRight size={15} />
                  </Link>
                  <a
                    href="#operations"
                    className="cq-dark-button flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 text-xs font-mono py-3 px-5"
                  >
                    <Compass size={15} />
                    <span>BROWSE MISSIONS</span>
                  </a>
                </div>
              </div>
            </div>
          </section>
          );
        })()}

        {/* B. MISSIONS — THE PRIMARY HOMEPAGE FOCUS */}
        <section id="operations" className="cq-section cq-pillars-section scroll-mt-24" aria-labelledby="operations-heading">
          <div className="cq-section-shell space-y-10">
            <div className="text-center max-w-2xl mx-auto mb-2">
              <span className="cq-kicker">CANTON QUESTS MISSIONS</span>
              <h2 id="operations-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                Choose Your Mission
              </h2>
              <p className="text-sm text-stone-400 font-body mt-2">
                One permanent Player Identity. Every Mission has its own scoring, prizes, and rules — no path is required just to browse.
              </p>
            </div>

            {liveOperations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">Active Missions</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {liveOperations.map((event) => (
                    <OperationCard key={event.id} event={event} status="LIVE" />
                  ))}
                </div>
              </div>
            )}

            {incomingOperations.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400">Upcoming Missions</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {incomingOperations.map((event) => (
                    <OperationCard key={event.id} event={event} status="INCOMING" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* C. WHAT IS CANTON QUESTS? */}
        <section className="cq-section cq-pillars-section" aria-labelledby="what-is-cq-heading">
          <div className="cq-section-shell space-y-12">
            <div className="text-center max-w-2xl mx-auto mb-4">
              <span className="cq-kicker">THE PLATFORM</span>
              <h2 id="what-is-cq-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                What Is Canton Quests?
              </h2>
              <p className="text-sm text-stone-400 font-body mt-2">
                A real-world adventure game layered over Canton, Ohio. One Player Identity, multiple Missions,
                real stakes.
              </p>
            </div>

            <div className="cq-pillars">
              {platformPillars.map(({ title, text, Icon }) => (
                <article className="cq-pillar-card" key={title}>
                  <span className="cq-pillar-icon">
                    <Icon size={28} aria-hidden="true" />
                  </span>
                  <h2>{title}</h2>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* D. HOW IT WORKS — SHORT JOIN LOOP */}
        <section className="cq-section cq-pillars-section" aria-labelledby="how-it-works-heading">
          <div className="cq-section-shell space-y-12">
            <div className="text-center max-w-2xl mx-auto mb-4">
              <span className="cq-kicker">HOW IT WORKS</span>
              <h2 id="how-it-works-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                Four Steps. Every Mission.
              </h2>
            </div>

            <div className="cq-pillars">
              {joinSteps.map(({ title, text, Icon }) => (
                <article className="cq-pillar-card" key={title}>
                  <span className="cq-pillar-icon">
                    <Icon size={28} aria-hidden="true" />
                  </span>
                  <h2>{title}</h2>
                  <p>{text}</p>
                </article>
              ))}
            </div>

            <div className="text-center">
              <Link href="/how-it-works" className="cq-dark-button text-xs font-mono inline-flex items-center gap-2">
                READ THE FULL RULES
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* E. WHAT'S HAPPENING NOW — LATEST TRANSMISSION (PROMOTIONAL BRIEFING TRANSMISSION) */}
        <section className="cq-section bg-stone-950/70 border-y border-stone-800/80 py-14" aria-labelledby="briefing-section-heading">
          <div className="cq-section-shell">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-4 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
                  <Radio size={14} className="text-amber-400 animate-pulse" />
                  <span>WHAT&apos;S HAPPENING NOW</span>
                </div>
                <h2 id="briefing-section-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                  Latest Transmission
                </h2>
                <p className="text-sm text-stone-300 font-body leading-relaxed">
                  The latest briefing from the Game Commander on what&apos;s active, what&apos;s next, and how it
                  all connects across downtown Canton.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsVideoPlaying(true)}
                    className="cq-gold-button inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Play size={16} className="fill-black" />
                    <span>{isVideoPlaying ? 'PLAYING BRIEFING' : 'PLAY BRIEFING'}</span>
                  </button>
                  <a href="#operations" className="cq-dark-button text-xs font-mono">
                    VIEW MISSIONS
                  </a>
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

                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-amber-500/90 text-black flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:bg-amber-400 transition-all">
                          <Play size={26} className="fill-black ml-1" />
                        </div>
                      </div>

                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-stone-300 pointer-events-none">
                        <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                          <Radio size={12} className="text-red-500 animate-pulse" />
                          TRANSMISSION LOADED • CLICK TO PLAY
                        </span>
                        <span>2:11 • 720P HD</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* F. PLAYER COMMUNITY / ROSTER PREVIEW */}
        {rosterPreview.length > 0 && (
          <section className="cq-section py-14" aria-labelledby="roster-preview-heading">
            <div className="cq-section-shell">
              <div className="p-6 sm:p-8 rounded-3xl bg-stone-950/90 border border-stone-800 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {rosterPreview.map((entry) => (
                      <div
                        key={entry.id}
                        className="w-10 h-10 rounded-full border-2 border-stone-950 bg-stone-900 overflow-hidden shrink-0"
                        title={entry.displayName}
                      >
                        <PlayerAvatar
                          avatarUrl={entry.avatarUrl}
                          cropZoom={entry.profileImageCropZoom}
                          cropX={entry.profileImageCropX}
                          cropY={entry.profileImageCropY}
                          size={40}
                          ariaLabel={`${entry.displayName} avatar`}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Users size={14} className="text-cyan-400" aria-hidden="true" />
                      <span id="roster-preview-heading" className="text-xs font-mono font-bold uppercase text-cyan-400 tracking-wider">
                        {roster.length} Registered {roster.length === 1 ? 'Agent' : 'Agents'}
                      </span>
                    </div>
                    <p className="text-sm text-white font-body">
                      A growing roster of permanent Canton Quests identities — across every Mission.
                    </p>
                  </div>
                </div>
                <Link href="/roster" className="cq-dark-button inline-flex items-center justify-center gap-2 text-xs font-mono py-3 px-5 w-full sm:w-auto">
                  VIEW PLAYER ROSTER
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* G. FINAL CTA */}
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
            <span className="cq-kicker">CANTON QUESTS</span>
            <h2 id="final-cta-heading">THE CITY IS WAITING.</h2>
            <p>
              One permanent Player Identity gets you into every Mission Canton Quests ever runs.
            </p>
            <div className="cq-live-buttons">
              {!currentPlayer ? (
                <Link href="/register" className="cq-gold-button">
                  CREATE PLAYER IDENTITY
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ) : (
                <a href="#operations" className="cq-gold-button">
                  VIEW MISSIONS
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
              )}
              <Link href="/leaderboard" className="cq-dark-button">
                VIEW RANKINGS
                <Crown size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href="#operations" />
    </div>
  );
}
