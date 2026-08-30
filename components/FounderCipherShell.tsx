'use client';

import { ReactNode, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Gift,
  HelpCircle,
  KeyRound,
  ListChecks,
  Map,
  MapPin,
  Play,
  Radio,
  ShieldCheck,
  Tv,
  Trophy,
  Zap,
  Compass,
} from 'lucide-react';
import { Player, QuestEvent, StartingPath } from '@/lib/types';
import { cqImages, destinationCards, formatEventWindow } from '@/lib/marketing-assets';
import { DOOR_HOTSPOTS } from '@/components/ThreePathSelector';
import { OperationLifecycleStage } from '@/lib/launch-status';
import { getFeaturedTransmission } from '@/lib/commander-transmissions';

const founderCipherSteps = [
  {
    title: 'PICK',
    text: 'Choose a mission from your path — or browse the full board.',
    Icon: Compass,
  },
  {
    title: 'GO',
    text: 'Solve it remotely, or walk it in downtown Canton.',
    Icon: MapPin,
  },
  {
    title: 'PROVE',
    text: 'Scan, check in, solve, or submit field proof.',
    Icon: ShieldCheck,
  },
  {
    title: 'SCORE',
    text: 'XP climbs the citywide board — every quest is a drawing entry.',
    Icon: Trophy,
  },
];

interface CountdownInfo {
  label: string;
  value: string;
  subtext: string;
}

interface MissionControlLink {
  label: string;
  href: string;
  Icon: typeof Map;
}

function getMissionControlLinks(eventSlug: string): MissionControlLink[] {
  return [
    { label: 'Mission Board', href: `/events/${eventSlug}/quests`, Icon: ListChecks },
    { label: 'Map', href: `/events/${eventSlug}/map`, Icon: Map },
    { label: 'Leaderboard', href: `/events/${eventSlug}/leaderboard`, Icon: Trophy },
    { label: 'Watch Live', href: `/events/${eventSlug}/watch`, Icon: Tv },
    { label: 'Transmissions', href: `/events/${eventSlug}/transmissions`, Icon: Radio },
    { label: 'Drawing', href: `/events/${eventSlug}/drawing`, Icon: Gift },
  ];
}

interface FounderCipherShellProps {
  event: QuestEvent | null;
  authenticatedPlayer: Player | null;
  stage: OperationLifecycleStage;
  countdown: CountdownInfo;
  /** The player's chosen starting path once set on their event_players record — lets the persistent doors moment greet a returning player by their path instead of re-asking them to choose. */
  chosenPath?: StartingPath | null;
  /** Live gates/dashboard content — rendered under the status widget for 'active'/'finale'/'ended' stages. */
  children?: ReactNode;
}

const STAGE_BADGE: Record<OperationLifecycleStage, { label: string; dotClass: string }> = {
  upcoming: { label: 'MISSION GRID OFFLINE — MISSION UPCOMING', dotClass: 'bg-amber-400' },
  active: { label: 'MISSION GRID LIVE — MISSION ACTIVE', dotClass: 'bg-emerald-400' },
  finale: { label: 'FINAL HOURS — MISSION CLOSING', dotClass: 'bg-red-500' },
  ended: { label: 'MISSION COMPLETE — RESULTS ARCHIVED', dotClass: 'bg-stone-400' },
};

const MISSION_CONTROL_COPY: Record<OperationLifecycleStage, { eyebrow: string; heading: string }> = {
  upcoming: { eyebrow: '', heading: '' },
  active: { eyebrow: 'MISSION GRID LIVE', heading: 'Live Mission Control' },
  finale: { eyebrow: 'FINAL HOURS', heading: 'Live Mission Control' },
  ended: { eyebrow: 'ARCHIVED', heading: 'Mission Control — Final Standings' },
};

export default function FounderCipherShell({
  event,
  authenticatedPlayer,
  stage,
  countdown,
  chosenPath,
  children,
}: FounderCipherShellProps) {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const eventWindow = event ? formatEventWindow(event) : 'September 11 – 14, 2026';
  const badge = STAGE_BADGE[stage];
  const featuredTransmission = getFeaturedTransmission();
  const eventSlug = event?.slug || 'canton-weekend-1';
  // The door preview isn't wired to selection state itself — clicking a
  // door routes into the real entry flow (register-then-choose, or straight
  // into the Operation if already signed in) so it drives the existing
  // path-selection logic instead of duplicating it.
  const doorHref = authenticatedPlayer ? '/events/canton-weekend-1' : '/register?next=%2Fevents%2Fcanton-weekend-1';
  const chosenDoor = chosenPath ? DOOR_HOTSPOTS.find((d) => d.id === chosenPath) : undefined;
  const missionControlLinks = getMissionControlLinks(eventSlug);
  const missionControlCopy = MISSION_CONTROL_COPY[stage];

  return (
    <div className="space-y-16 sm:space-y-20 pb-4">
      {/* PERSISTENT HERO — EVENT IDENTITY, ALWAYS SHOWN */}
      <section className="relative overflow-hidden rounded-3xl border border-amber-500/30 shadow-2xl">
        <Image
          src={cqImages.heroCityBeam}
          alt="Downtown Canton at dusk"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
        <div className="relative z-10 p-6 sm:p-12 space-y-5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
              <span className={`w-2 h-2 rounded-full ${badge.dotClass} animate-pulse`} />
              <span>{badge.label}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 border border-amber-500/30 text-amber-200 font-mono text-xs font-bold">
              <Gift size={12} />
              <span>$500 PRIZE POOL</span>
            </div>
          </div>
          <h1 className="font-display font-black text-3xl sm:text-5xl text-white uppercase tracking-tight leading-[0.95]">
            Canton Quests: Volume 1
            <br />
            <span className="text-amber-400">The Founder&apos;s Cipher</span>
          </h1>
          <p className="text-sm sm:text-base text-stone-200 font-body leading-relaxed">
            The full three-path Canton Quests experience. Ciphers, sprints, and secrets hidden across downtown
            Canton — Family, Challenge, or Secret — on this Mission&apos;s own citywide leaderboard. {eventWindow}.
          </p>

          {/* STAGE-SPECIFIC STATUS WIDGET */}
          {stage === 'upcoming' ? (
            <>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-mono text-stone-300">
                <div className="rounded-xl bg-black/50 border border-amber-500/30 px-4 py-2">
                  <span className="block text-[10px] uppercase tracking-widest text-amber-400 font-bold">{countdown.label}</span>
                  <span className="block text-lg font-display font-extrabold text-white">{countdown.value}</span>
                </div>
                <span className="text-stone-400">{countdown.subtext}</span>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                {authenticatedPlayer ? (
                  <>
                    <span className="text-xs font-mono text-emerald-300">
                      Signed in as {authenticatedPlayer.displayName} — you&apos;re already entered. The Mission Grid
                      unlocks at launch.
                    </span>
                    <Link href="/profile" className="cq-gold-button inline-flex items-center gap-2 text-xs font-mono py-3 px-6">
                      VIEW PLAYER FILE
                      <ArrowRight size={15} />
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/register?next=%2Fevents%2Fcanton-weekend-1"
                      className="cq-gold-button inline-flex items-center gap-2 text-xs font-mono py-3 px-6"
                    >
                      CREATE PLAYER IDENTITY
                      <ArrowRight size={15} />
                    </Link>
                    <Link
                      href="/login?next=%2Fevents%2Fcanton-weekend-1"
                      className="cq-dark-button inline-flex items-center gap-2 text-xs font-mono py-3 px-5"
                    >
                      ACCESS COMMAND CENTER
                    </Link>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="pt-1 flex flex-wrap items-center gap-3 text-xs font-mono">
              {stage === 'active' && (
                <span className="inline-flex items-center gap-1.5 text-emerald-300">
                  <Zap size={14} />
                  The Mission Grid is live — scroll down for your Missions, Map, and Scores.
                </span>
              )}
              {stage === 'finale' && (
                <span className="inline-flex items-center gap-1.5 text-red-300">
                  <Zap size={14} />
                  Final hours — last chance to climb the board before the drawing locks.
                </span>
              )}
              {stage === 'ended' && (
                <span className="inline-flex items-center gap-1.5 text-stone-300">
                  <Trophy size={14} />
                  The Founder&apos;s Cipher has concluded — results are archived below.
                </span>
              )}
              {authenticatedPlayer && (
                <Link
                  href={
                    stage === 'ended'
                      ? `/events/${eventSlug}/leaderboard`
                      : `/events/${eventSlug}/quests`
                  }
                  className="cq-gold-button inline-flex items-center gap-2 text-xs font-mono py-2.5 px-5"
                >
                  {stage === 'ended' ? 'VIEW FINAL RESULTS' : 'CONTINUE MISSION'}
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* PERSISTENT — COMMANDER BRIEFING (directly under the hero: this is
          the first thing every player should hear before entering). */}
      <section aria-labelledby="cipher-briefing-heading" className="bg-stone-950/70 border-y border-stone-800/80 -mx-4 sm:-mx-6 px-4 sm:px-6 py-12">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="cq-kicker">COMMANDER CHANNEL // SECURE</span>
          <h2 id="cipher-briefing-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
            Hear From The Commander
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto">
          <div className="lg:col-span-5 space-y-4 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
              <Radio size={14} className="text-amber-400 animate-pulse" />
              <span>GAME MASTER TRANSMISSION</span>
            </div>
            <h3 className="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-tight">
              Official Mission Briefing
            </h3>
            <p className="text-sm text-stone-300 font-body leading-relaxed">
              Watch the official Game Commander transmission for Canton Quests Volume 1. Learn how real-world
              landmarks, street ciphers, and QR nodes connect across downtown Canton.
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
              <Link href={`/events/canton-weekend-1/rules`} className="cq-dark-button text-xs font-mono">
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
                    <span>2:17 • 1080P HD</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FEATURED TRANSMISSION TEASER — one compact entry point into the
            15-transmission archive, not the full archive inline. */}
        <div className="max-w-5xl mx-auto mt-8 pt-8 border-t border-stone-800/60">
          <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-amber-500/20 bg-black/40 p-4 sm:p-5">
            <Link
              href={`/events/canton-weekend-1/transmissions/${featuredTransmission.id}`}
              className="relative w-16 h-28 sm:w-20 sm:h-36 shrink-0 rounded-xl overflow-hidden border border-amber-500/30 bg-black group"
              aria-label={`Watch ${featuredTransmission.title}`}
            >
              <Image
                src={featuredTransmission.posterUrl}
                alt={featuredTransmission.title}
                fill
                sizes="80px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                <Play size={20} className="fill-white text-white drop-shadow" />
              </div>
            </Link>
            <div className="flex-1 text-center sm:text-left space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
                Featured Transmission
              </span>
              <p className="text-sm text-white font-display font-bold">{featuredTransmission.title}</p>
              <p className="text-xs text-stone-400 font-body">15 recorded briefings on file from the Commander.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
              <Link
                href={`/events/canton-weekend-1/transmissions/${featuredTransmission.id}`}
                className="cq-gold-button text-xs font-mono py-3 px-5 inline-flex items-center justify-center gap-2"
              >
                <Play size={13} className="fill-black" />
                WATCH
              </Link>
              <Link
                href="/events/canton-weekend-1/transmissions"
                className="cq-dark-button text-xs font-mono py-3 px-5 inline-flex items-center justify-center gap-2"
              >
                VIEW ALL
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PERSISTENT — COMPACT PRIZE CALLOUT (the full breakdown still lives
          further down; this exists so the $500 registers early, right where
          a player decides whether this Mission is worth entering). */}
      <section aria-label="Prize summary" className="max-w-4xl mx-auto -mt-8 sm:-mt-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-stone-950 to-stone-950 px-5 sm:px-7 py-5">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <Gift size={22} className="text-amber-400 shrink-0" />
            <p className="text-sm text-stone-200 font-body">
              <strong className="text-amber-300 font-display font-black">$500 in prizes.</strong>{' '}
              Leaderboard cash for the top scorers, plus every verified quest earns a cash-drawing entry.
            </p>
          </div>
          <a
            href="#cipher-prize-heading"
            className="cq-dark-button text-xs font-mono py-2.5 px-5 inline-flex items-center gap-2 shrink-0 whitespace-nowrap"
          >
            SEE THE FULL BREAKDOWN
            <ArrowRight size={13} />
          </a>
        </div>
      </section>

      {/* STATE-SPECIFIC GATES/DASHBOARD SLOT — current player status and,
          once the Mission is active, live Mission controls (quest board,
          map, score). */}
      {children}

      {/* PERSISTENT — LIVE MISSION CONTROL (fast links into the real game
          surfaces; hidden pre-launch since there's nothing live to jump
          into yet — the closing section below covers that state instead). */}
      {stage !== 'upcoming' && (
        <section id="mission-control" aria-labelledby="mission-control-heading" className="scroll-mt-24">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="cq-kicker">{missionControlCopy.eyebrow}</span>
            <h2 id="mission-control-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
              {missionControlCopy.heading}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {missionControlLinks.map(({ label, href, Icon }) => (
              <Link
                key={label}
                href={href}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-stone-800 bg-stone-900/70 py-6 px-3 text-center hover:border-amber-500/50 hover:bg-stone-900 transition-colors"
              >
                <Icon size={22} className="text-amber-400" />
                <span className="text-xs font-mono font-bold uppercase tracking-wide text-stone-200">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* PERSISTENT — THREE DOORS (same artwork/CSS as the functional
          ThreePathSelector used once a player actually enters and needs to
          choose — this is the presentational preview; clicking a door
          routes into that real entry flow rather than duplicating its
          selection/signup logic here). Reframes to a "your path" confirmation
          once the player already has one on file instead of re-asking. */}
      <section id="choose-path" className="cq-three-doors-section scroll-mt-28" aria-labelledby="cipher-paths-heading">
        <div className="cq-three-doors-intro">
          <span className="cq-three-doors-eyebrow">THREE PATHS. ONE MISSION.</span>
          <h2 id="cipher-paths-heading" className="cq-three-doors-title">
            {chosenDoor ? `You Chose: ${chosenDoor.label}` : 'Family, Challenge, or Secret'}
          </h2>
          <p className="cq-three-doors-desc">
            {chosenDoor
              ? `Your path shaped how you entered — every quest in Canton is still open to you.`
              : 'Your choice changes how you enter the game. Every quest in Canton stays open either way.'}
          </p>
        </div>

        <div className="cq-three-doors-frame">
          <Image
            src={cqImages.threeDoors}
            alt="Three starting portal doors: Challenge (Red), Family (Gold), Secret (Purple)"
            width={1672}
            height={941}
            sizes="(max-width: 1024px) 100vw, 1080px"
            className="cq-three-doors-image"
          />
          <div className="cq-three-doors-scrim" />
          <div className="cq-three-doors-hotspots" role="group" aria-label="Founder's Cipher starting paths">
            {DOOR_HOTSPOTS.map((door) => (
              <Link
                key={door.id}
                href={doorHref}
                aria-label={
                  chosenDoor?.id === door.id
                    ? `${door.ariaLabel} — your chosen path`
                    : `${door.ariaLabel} — enter the Founder's Cipher to choose`
                }
                title={`${door.ariaLabel} (${door.district})`}
                className={`cq-door-hotspot ${door.className}${chosenDoor?.id === door.id ? ' is-selected' : ''}`}
              >
                <div className="cq-door-badge-row">
                  <span
                    className="cq-door-tag"
                    style={{ backgroundColor: `${door.color}25`, borderColor: `${door.color}60`, color: door.color }}
                  >
                    {chosenDoor?.id === door.id ? 'Your Door' : door.tag}
                  </span>
                  <div
                    className="cq-door-icon-box"
                    style={{ backgroundColor: `${door.color}25`, borderColor: `${door.color}60`, color: door.color }}
                  >
                    <door.icon size={14} />
                  </div>
                </div>
                <div className="cq-door-pill-row">
                  <div
                    className="cq-door-pill"
                    style={{ backgroundColor: 'rgba(5, 6, 7, 0.85)', borderColor: `${door.color}60`, color: door.color }}
                  >
                    <door.icon size={13} style={{ color: door.color }} />
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                      <span className="cq-door-pill-title">{door.label}</span>
                      <span className="cq-door-pill-district">{door.district}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PERSISTENT — FOUR STEPS (Cipher-specific mechanics only — the
          platform homepage already carries the generic explanation, so this
          version speaks in terms of paths, XP, and drawing entries). */}
      <section aria-labelledby="cipher-steps-heading">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="cq-kicker">INSIDE THE FOUNDER&apos;S CIPHER</span>
          <h2 id="cipher-steps-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
            Four Steps to Conquer Canton
          </h2>
        </div>
        <div className="cq-pillars cq-compact-mobile-grid">
          {founderCipherSteps.map(({ title, text, Icon }) => (
            <article className="cq-pillar-card cq-compact-mobile-card" key={title}>
              <span className="cq-pillar-icon">
                <Icon size={28} aria-hidden="true" />
              </span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* PERSISTENT — REAL CANTON LOCATIONS ("the city is the game board" —
          a sample of the kinds of real places quests move through, not a
          claim that every image below is an active quest right now). */}
      <section aria-labelledby="cipher-destinations-heading">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="cq-kicker">CANTON IS THE GAME BOARD</span>
          <h2 id="cipher-destinations-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
            Real Places. Real Missions.
          </h2>
          <p className="text-sm text-stone-400 font-body mt-2">
            A sample of the downtown Canton locations quests move through — not every one is live this minute.
          </p>
        </div>
        <div className="cq-destination-grid cq-compact-mobile-grid">
          {destinationCards.map((card) => (
            <article className="cq-destination-card cq-compact-mobile-card" key={card.title}>
              <Image src={card.image} alt={card.title} fill sizes="(max-width: 820px) 50vw, 25vw" />
              <div>
                <span>{card.label}</span>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* PERSISTENT — $500 PRIZE PRESENTATION (full breakdown; the compact
          callout higher up already puts the number in front of players
          early — this is the detail for those who scroll to it). */}
      <section aria-labelledby="cipher-prize-heading">
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
                <span>FOUNDER&apos;S CIPHER · EVERY QUEST = ONE DRAWING ENTRY</span>
              </div>
              <h2 id="cipher-prize-heading" className="font-display font-black text-2xl sm:text-4xl text-white uppercase tracking-tight scroll-mt-24">
                $500 Prize Pool
              </h2>
              <p className="text-sm text-stone-300 font-body leading-relaxed">
                Signing up is free and doesn&apos;t require an entry. Every verified completed mission earns{' '}
                <strong>+1 drawing entry</strong> into the cash drawings. Leaderboard prizes go to the top 2 XP
                scorers — no drawing entries required.
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
                <strong>XP means Experience Points.</strong> You earn XP when verified quests are completed. XP is
                your score in the Founder&apos;s Cipher. The more XP you earn, the higher you climb.
              </p>
              <div className="pt-2 border-t border-stone-800 text-[11px] text-stone-400">
                XP determines leaderboard position. Drawing entries give chances at cash drawings. One entry = one
                chance.
              </div>
            </div>
          </div>
        </div>
      </section>

      {stage === 'upcoming' && (
        <section className="text-center max-w-xl mx-auto space-y-4">
          <h2 className="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-tight">
            Get Ready For September 11
          </h2>
          <p className="text-sm text-stone-400 font-body">
            Explore the site, create your Player Identity, and get ready — the Mission Grid comes online at launch.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/events/canton-weekend-1/rules"
              className="cq-dark-button w-full sm:w-auto text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
            >
              <HelpCircle size={15} />
              HOW IT WORKS
            </Link>
            <Link
              href="/events/canton-weekend-1/transmissions"
              className="cq-dark-button w-full sm:w-auto text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
            >
              <Radio size={15} />
              TRANSMISSIONS
            </Link>
            <Link
              href="/events/canton-weekend-1/leaderboard"
              className="cq-dark-button w-full sm:w-auto text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
            >
              <Trophy size={15} />
              PRE-SEASON LEADERBOARD
            </Link>
            <Link
              href="/"
              className="cq-dark-button w-full sm:w-auto text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
            >
              <KeyRound size={15} />
              RETURN TO COMMAND CENTER
            </Link>
          </div>
        </section>
      )}

      {stage === 'ended' && (
        <section className="text-center max-w-xl mx-auto space-y-4">
          <h2 className="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-tight">
            Mission Complete
          </h2>
          <p className="text-sm text-stone-400 font-body">
            The Founder&apos;s Cipher has concluded. Final standings, the full transmission archive, and the prize
            ledger stay open for the record.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/events/canton-weekend-1/leaderboard"
              className="cq-gold-button w-full sm:w-auto text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
            >
              <Trophy size={15} />
              FINAL LEADERBOARD
            </Link>
            <Link
              href="/events/canton-weekend-1/drawing"
              className="cq-dark-button w-full sm:w-auto text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
            >
              <Gift size={15} />
              PRIZE RESULTS
            </Link>
            <Link
              href="/events/canton-weekend-1/transmissions"
              className="cq-dark-button w-full sm:w-auto text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
            >
              <Radio size={15} />
              FULL ARCHIVE
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
