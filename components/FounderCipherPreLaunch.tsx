'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Compass,
  Gift,
  HelpCircle,
  KeyRound,
  MapPin,
  Play,
  Radio,
  ShieldCheck,
  Trophy,
  Zap,
} from 'lucide-react';
import { Player, QuestEvent } from '@/lib/types';
import { cqImages, destinationCards, formatEventWindow } from '@/lib/marketing-assets';
import { PATH_OPTIONS } from '@/components/ThreePathSelector';

const founderCipherSteps = [
  {
    title: 'PICK',
    text: 'Choose a mission from your path — or browse them all.',
    Icon: Compass,
  },
  {
    title: 'GO',
    text: 'Solve it remotely, or go find it in Canton.',
    Icon: MapPin,
  },
  {
    title: 'PROVE',
    text: 'Scan, check in, solve, or submit proof.',
    Icon: ShieldCheck,
  },
  {
    title: 'SCORE',
    text: 'Earn XP and climb the citywide leaderboard.',
    Icon: Trophy,
  },
];

interface CountdownInfo {
  label: string;
  value: string;
  subtext: string;
}

interface FounderCipherPreLaunchProps {
  event: QuestEvent | null;
  authenticatedPlayer: Player | null;
  countdown: CountdownInfo;
}

export default function FounderCipherPreLaunch({ event, authenticatedPlayer, countdown }: FounderCipherPreLaunchProps) {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const eventWindow = event ? formatEventWindow(event) : 'September 11 – 14, 2026';

  return (
    <div className="space-y-16 sm:space-y-20 pb-4">
      {/* HERO */}
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>MISSION GRID OFFLINE — OPERATION INCOMING</span>
          </div>
          <h1 className="font-display font-black text-3xl sm:text-5xl text-white uppercase tracking-tight leading-[0.95]">
            Canton Quests: Volume 1
            <br />
            <span className="text-amber-400">The Founder&apos;s Cipher</span>
          </h1>
          <p className="text-sm sm:text-base text-stone-200 font-body leading-relaxed">
            The full three-path Canton Quests experience. Ciphers, sprints, and secrets hidden across downtown
            Canton — Family, Challenge, or Secret — on one citywide leaderboard. {eventWindow}.
          </p>

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
                  Signed in as {authenticatedPlayer.displayName} — you&apos;re already entered. The Mission Grid unlocks at launch.
                </span>
                <Link
                  href="/profile"
                  className="cq-gold-button inline-flex items-center gap-2 text-xs font-mono py-3 px-6"
                >
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
        </div>
      </section>

      {/* FOUR STEPS — FOUNDER'S CIPHER TUTORIAL */}
      <section aria-labelledby="cipher-steps-heading">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="cq-kicker">HOW THE FOUNDER&apos;S CIPHER WORKS</span>
          <h2 id="cipher-steps-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
            Four Steps to Conquer Canton
          </h2>
        </div>
        <div className="cq-pillars">
          {founderCipherSteps.map(({ title, text, Icon }) => (
            <article className="cq-pillar-card" key={title}>
              <span className="cq-pillar-icon">
                <Icon size={28} aria-hidden="true" />
              </span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* THREE PATHS TEASER */}
      <section aria-labelledby="cipher-paths-heading">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="cq-kicker">THREE DOORS. ONE CITY.</span>
          <h2 id="cipher-paths-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
            Family, Challenge, or Secret
          </h2>
          <p className="text-sm text-stone-400 font-body mt-2">
            Your starting path gives you your first mission and identity — every quest in Canton stays open to you.
            You&apos;ll choose your door when the Operation opens.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PATH_OPTIONS.map((path) => (
            <article
              key={path.id}
              className="rounded-2xl border p-5 bg-stone-950/80 shadow-xl"
              style={{ borderColor: `${path.color}50` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <path.icon size={18} style={{ color: path.color }} aria-hidden="true" />
                <span className="font-display font-black text-sm text-white uppercase tracking-wide">{path.title}</span>
              </div>
              <p className="text-xs text-stone-300 font-body leading-relaxed">{path.subtitle}</p>
              <span
                className="inline-block mt-3 text-[10px] font-mono font-bold uppercase px-2 py-1 rounded-full"
                style={{ backgroundColor: `${path.color}20`, color: path.color, border: `1px solid ${path.color}50` }}
              >
                {path.badge}
              </span>
            </article>
          ))}
        </div>
      </section>

      {/* REAL CANTON LOCATIONS */}
      <section aria-labelledby="cipher-destinations-heading">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="cq-kicker">THE CITY IS THE GAME BOARD</span>
          <h2 id="cipher-destinations-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
            Real Places. Real Missions.
          </h2>
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

      {/* COMMANDER BRIEFING */}
      <section aria-labelledby="cipher-briefing-heading" className="bg-stone-950/70 border-y border-stone-800/80 -mx-4 sm:-mx-6 px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto">
          <div className="lg:col-span-5 space-y-4 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
              <Radio size={14} className="text-amber-400 animate-pulse" />
              <span>GAME MASTER TRANSMISSION</span>
            </div>
            <h2 id="cipher-briefing-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
              Official Mission Briefing
            </h2>
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
      </section>

      {/* $500 PRIZE PRESENTATION */}
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
              <h2 id="cipher-prize-heading" className="font-display font-black text-2xl sm:text-4xl text-white uppercase tracking-tight">
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

      {/* CLOSING CTA */}
      <section className="text-center max-w-xl mx-auto space-y-4">
        <h2 className="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-tight">
          Get Ready For September 11
        </h2>
        <p className="text-sm text-stone-400 font-body">
          Explore the site, create your Player Identity, and get ready — the Mission Grid comes online at launch.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/how-it-works"
            className="cq-dark-button w-full sm:w-auto text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
          >
            <HelpCircle size={15} />
            HOW IT WORKS
          </Link>
          <Link
            href="/leaderboard?operation=canton-weekend-1"
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
    </div>
  );
}
