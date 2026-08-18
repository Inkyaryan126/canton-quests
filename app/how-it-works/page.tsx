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
} from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
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
    text: 'Verified missions add points to your profile.',
    Icon: Zap,
  },
  {
    title: 'Climb the board',
    text: 'Keep playing to move up the leaderboard.',
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
              Start with one quest. The app tells you what to do, where to go, and how to prove it.
            </p>
            <div className="cq-page-actions">
              <Link href={eventHref} className="cq-gold-button">
                START PLAYING
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/quests" className="cq-dark-button">
                BROWSE QUESTS
              </Link>
            </div>
          </div>
          <div className="cq-page-hero-art">
            <Image src={cqImages.coffeeQr} alt="Glowing Canton Quests QR card in a coffee shop" fill priority sizes="(max-width: 900px) 100vw, 44vw" />
          </div>
        </section>

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

        <section className="cq-feature-panel cq-feature-panel-reverse">
          <Image src={cqImages.mapHud} alt="Canton route planning HUD" fill sizes="100vw" />
          <div>
            <span className="cq-kicker">PROGRESSION</span>
            <h2>PLAY MORE. SCORE MORE.</h2>
            <p>
              Every completed quest earns XP. Higher-value missions and live drops help you rise faster.
            </p>
            <Link href="/leaderboard" className="cq-gold-button">
              VIEW LEADERBOARD
              <Trophy size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>

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

          <div className="bg-[#0c0d12] border border-amber-500/30 rounded-2xl p-6 sm:p-8 space-y-6">
            <div>
              <p className="text-amber-200 font-display font-bold text-lg sm:text-xl uppercase">
                Canton Quests does not secretly choose prize winners.
              </p>
              <p className="text-gray-300 text-sm mt-2 leading-relaxed">
                Our drawing process follows a fixed public method that can be followed and verified after the event.
                Every step is mathematically reproducible from frozen event totals and publicly assigned ticket numbers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
              <div className="bg-[#05070a] border border-amber-500/20 p-4 rounded-xl">
                <span className="text-amber-400 font-bold block mb-1">01 // FROZEN EVENT TOTALS</span>
                <p className="text-gray-300">
                  Total participating players, valid entries, completed quests, and finishers freeze when the event closes.
                </p>
              </div>

              <div className="bg-[#05070a] border border-amber-500/20 p-4 rounded-xl">
                <span className="text-amber-400 font-bold block mb-1">02 // PERMANENT CQ NUMBER</span>
                <p className="text-gray-300">
                  Fixed letter-to-number constant <strong>311420151417215192019</strong> derived from CANTON QUESTS.
                </p>
              </div>

              <div className="bg-[#05070a] border border-amber-500/20 p-4 rounded-xl">
                <span className="text-amber-400 font-bold block mb-1">03 // FINAL QUEST NUMBER</span>
                <p className="text-gray-300">
                  Event totals multiplied by the permanent number create a single deterministic Final Quest Number.
                </p>
              </div>

              <div className="bg-[#05070a] border border-amber-500/20 p-4 rounded-xl">
                <span className="text-amber-400 font-bold block mb-1">04 // FOLLOW THE TRAIL</span>
                <p className="text-gray-300">
                  A public sliding-window scan examines digit groups from left to right. The first valid ticket wins.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 text-xs font-mono">
              <span className="text-gray-400">
                Fixed beforehand · Automatic · Publicly documented · Reproducible · Zero manual administrator choice
              </span>
              <Link
                href={activeEvent ? `/events/${activeEvent.slug}/drawing` : '/events/canton-weekend-1/drawing'}
                className="text-amber-400 hover:text-amber-300 underline font-bold inline-flex items-center gap-1"
              >
                View Live Event Drawing Ledger →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href={eventHref} />
    </div>
  );
}
