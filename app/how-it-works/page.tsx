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
import { QuestEvent } from '@/lib/types';
import { getEvents } from '@/lib/game-engine';
import { cqImages, getActiveEvent } from '@/lib/marketing-assets';

const steps = [
  {
    title: 'Find a quest',
    text: 'Open the quest board and choose a signal by location, XP, or mission type.',
    Icon: Compass,
  },
  {
    title: 'Go to the location',
    text: 'The phone is your field tool. The real game happens at Canton landmarks.',
    Icon: MapPin,
  },
  {
    title: 'Complete the mission',
    text: 'Read the city, solve the clue, scan the emblem, or capture proof.',
    Icon: CheckCircle2,
  },
  {
    title: 'Earn XP',
    text: 'Verified missions push you up the board and unlock the next layer of play.',
    Icon: Zap,
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
    setEvents(getEvents());
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
            <h1>HOW THE CITY BECOMES A GAME.</h1>
            <p>
              Canton Quests is built for fast entry: pick a mission, move through the city,
              submit proof, earn XP, and keep unlocking the weekend.
            </p>
            <div className="cq-page-actions">
              <Link href="/quests" className="cq-gold-button">
                BROWSE QUESTS
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href={eventHref} className="cq-dark-button">
                JOIN THE QUESTS
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
              <h2>SEVEN MOVES</h2>
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
            <h2>CLIMB THE BOARD. UNLOCK THE NEXT SIGNAL.</h2>
            <p>
              XP comes from proof, speed, puzzle difficulty, and live drops. Some missions
              open the path to harder ciphers, finale moments, and squad advantages.
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
      </main>

      <CinematicFooter />
    </div>
  );
}
