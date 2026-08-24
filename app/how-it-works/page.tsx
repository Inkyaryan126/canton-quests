'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Compass,
  FileVideo,
  KeyRound,
  MapPin,
  QrCode,
  Trophy,
  Zap,
  Play,
  Gift,
  HelpCircle,
  Radio,
} from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import BriefingVideoModal from '@/components/BriefingVideoModal';
import { QuestEvent } from '@/lib/types';
import { cqImages, getActiveEvent } from '@/lib/marketing-assets';

const steps = [
  {
    title: 'Pick a quest',
    text: 'Choose a mission from the quest board.',
    Icon: Compass,
  },
  {
    title: 'Go there',
    text: 'Head to the real Canton location.',
    Icon: MapPin,
  },
  {
    title: 'Complete it',
    text: 'Scan, check in, solve, or capture proof.',
    Icon: CheckCircle2,
  },
  {
    title: 'Earn XP',
    text: 'Verified missions add XP score to your profile.',
    Icon: Zap,
  },
  {
    title: 'Climb the board',
    text: 'Keep playing to rise on the citywide leaderboard.',
    Icon: Trophy,
  },
];

const proofTypes = [
  { label: 'GPS Check-In', text: 'Arrive inside the target zone.', Icon: MapPin },
  { label: 'Passphrase', text: 'Find the word, year, or cipher answer.', Icon: KeyRound },
  { label: 'QR Scan', text: 'Locate official Canton Quests emblems.', Icon: QrCode },
  { label: 'Photo Proof', text: 'Capture creative field evidence.', Icon: Camera },
  { label: 'Video Proof', text: 'Record short challenge moments.', Icon: FileVideo },
];

export default function HowItWorksPage() {
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/game/events')
      .then((res) => res.json())
      .then((data: { events?: QuestEvent[] }) => setEvents(data.events || []));
  }, []);

  const activeEvent = getActiveEvent(events);
  const eventHref = activeEvent ? `/events/${activeEvent.slug}` : '/events';

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref={eventHref} />

      <main className="cq-page-main">
        <section className="cq-page-hero cq-page-hero-split">
          <div>
            <span className="cq-kicker">FIELD GUIDE</span>
            <h1>HOW TO PLAY.</h1>
            <p>
              Start with one quest. The app tells you what to do, where to go, and how to prove it. Free to enter for all ages.
            </p>
            <div className="cq-page-actions">
              <Link href={eventHref} className="cq-gold-button">
                START PLAYING
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() => setIsVideoModalOpen(true)}
                className="cq-dark-button inline-flex items-center gap-2 cursor-pointer hover:border-amber-400/60"
              >
                <Play size={15} className="text-amber-400 fill-amber-400" />
                <span>WATCH BRIEFING</span>
              </button>
            </div>
          </div>
          <div className="cq-page-hero-art">
            <Image src={cqImages.coffeeQr} alt="Glowing Canton Quests QR card in a coffee shop" fill priority sizes="(max-width: 900px) 100vw, 44vw" />
          </div>
        </section>

        {/* MISSION BRIEFING TRANSMISSION SECTION */}
        <section className="cq-page-section" aria-labelledby="briefing-transmission-heading">
          <div className="relative rounded-3xl overflow-hidden border border-amber-500/30 bg-stone-950 p-6 sm:p-10 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
                  <Radio size={14} className="text-amber-400 animate-pulse" />
                  <span>OFFICIAL VIDEO TRANSMISSION</span>
                </div>
                <h2 id="briefing-transmission-heading" className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                  Game Commander Briefing
                </h2>
                <p className="text-sm text-stone-300 font-body leading-relaxed">
                  Watch the full field briefing video before heading out. Understand how real-world landmarks,
                  time-sensitive flash signals, and cryptographic proof work during the event window.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsVideoModalOpen(true)}
                    className="cq-gold-button inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Play size={16} className="fill-black" />
                    <span>WATCH FULL BRIEFING (2:17)</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div
                  onClick={() => setIsVideoModalOpen(true)}
                  className="relative aspect-video rounded-2xl overflow-hidden border border-stone-800 shadow-2xl cursor-pointer group bg-black"
                >
                  <Image
                    src={cqImages.promoVideoPoster}
                    alt="Game Commander Mission Briefing"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-amber-500/90 text-black flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:bg-amber-400 transition-all">
                      <Play size={22} className="fill-black ml-1" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5 GAMEPLAY STEPS */}
        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">GAMEPLAY LOOP</span>
              <h2>FIVE SIMPLE STEPS</h2>
            </div>
          </div>

          <div className="cq-step-grid">
            {steps.map(({ title, text, Icon }, index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <Icon size={30} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* XP EXPLAINER FEATURE PANEL */}
        <section className="cq-feature-panel cq-feature-panel-reverse">
          <Image src={cqImages.mapHud} alt="Canton route planning HUD" fill sizes="100vw" />
          <div>
            <span className="cq-kicker">SCORE & PROGRESSION</span>
            <h2>WHAT IS XP?</h2>
            <p>
              <strong>XP means Experience Points.</strong> You earn XP when verified quests are completed. XP is your score in Canton Quests. The more XP you earn, the higher you climb on the citywide leaderboard.
            </p>
            <Link href="/leaderboard" className="cq-gold-button">
              VIEW LEADERBOARD
              <Trophy size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* SUPPORTED PROOF TYPES */}
        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">SUPPORTED PROOF</span>
              <h2>WHAT COUNTS IN THE FIELD</h2>
            </div>
          </div>

          <div className="cq-proof-grid">
            {proofTypes.map(({ label, text, Icon }) => (
              <article key={label}>
                <Icon size={24} aria-hidden="true" />
                <h3>{label}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* PUBLICLY VERIFIABLE PRIZE DRAWINGS SECTION */}
        <section id="prize-drawings" className="cq-page-section scroll-mt-24">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">TRANSPARENT WINNER SELECTION</span>
              <h2>PUBLICLY VERIFIABLE PRIZE DRAWINGS</h2>
            </div>
          </div>

          <div className="relative overflow-hidden bg-stone-950 border border-amber-500/30 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl">
            <Image
              src={cqImages.prizeVault}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 1200px"
              className="object-cover opacity-15 pointer-events-none"
            />
            <div className="relative z-10 space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
                  <Gift size={14} className="text-amber-400" />
                  <span>EVERY COMPLETED QUEST = ONE DRAWING ENTRY</span>
                </div>
                <p className="text-amber-200 font-display font-bold text-lg sm:text-2xl uppercase">
                  $500 in Cash Prizes. Zero secret winners.
                </p>
                <p className="text-stone-300 text-sm leading-relaxed max-w-3xl">
                  Sign up and get <strong>1 free drawing entry</strong>. Every verified completed quest gives you <strong>+1 drawing entry</strong>. Entries feed three separate cash drawings ($100 + $50 + $50 = $200 total). Leaderboard prizes ($200 champion + $100 runner-up) go to the top two XP scorers — no drawing entries needed for those.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                <div className="bg-stone-900/90 border border-amber-500/20 p-4 rounded-xl">
                  <span className="text-amber-400 font-bold block mb-1">01 // FROZEN EVENT TOTALS</span>
                  <p className="text-stone-300">
                    Total participating players, valid entries, completed quests, and finishers freeze when the event closes.
                  </p>
                </div>

                <div className="bg-stone-900/90 border border-amber-500/20 p-4 rounded-xl">
                  <span className="text-amber-400 font-bold block mb-1">02 // PERMANENT CQ NUMBER</span>
                  <p className="text-stone-300">
                    Fixed letter-to-number constant <strong>311420151417215192019</strong> derived from CANTON QUESTS.
                  </p>
                </div>

                <div className="bg-stone-900/90 border border-amber-500/20 p-4 rounded-xl">
                  <span className="text-amber-400 font-bold block mb-1">03 // FINAL QUEST NUMBER</span>
                  <p className="text-stone-300">
                    Event totals multiplied by the permanent number create a single deterministic Final Quest Number.
                  </p>
                </div>

                <div className="bg-stone-900/90 border border-amber-500/20 p-4 rounded-xl">
                  <span className="text-amber-400 font-bold block mb-1">04 // FOLLOW THE TRAIL</span>
                  <p className="text-stone-300">
                    A public sliding-window scan examines digit groups from left to right. The first valid ticket wins.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-stone-800 text-xs font-mono">
                <span className="text-stone-400">
                  Fixed beforehand · Automatic · Publicly documented · Reproducible · Zero administrator bias
                </span>
                <Link
                  href={activeEvent ? `/events/${activeEvent.slug}/drawing` : '/events/canton-weekend-1/drawing'}
                  className="text-amber-400 hover:text-amber-300 underline font-bold inline-flex items-center gap-1"
                >
                  View Live Event Drawing Ledger →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <BriefingVideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
      />
      <CinematicFooter />
      <MobileStartBar href={eventHref} />
    </div>
  );
}
