'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Compass,
  ClipboardCheck,
  FileVideo,
  Hash,
  KeyRound,
  MapPin,
  Medal,
  QrCode,
  ShieldCheck,
  Ticket,
  Trophy,
  UserRound,
  Zap,
} from 'lucide-react';
import { PATH_TONES } from '@/lib/path-tone';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import { QuestEvent } from '@/lib/types';
import { cqImages, getActiveEvent } from '@/lib/marketing-assets';

const steps = [
  {
    title: 'Create identity',
    text: 'Make one permanent Player Identity before joining any Mission.',
    Icon: UserRound,
  },
  {
    title: 'Choose a Mission',
    text: 'Enter the active game world you want to play.',
    Icon: Compass,
  },
  {
    title: 'Pick a quest',
    text: 'Choose a task from that Mission\'s board.',
    Icon: MapPin,
  },
  {
    title: 'Submit proof',
    text: 'Scan, check in, solve, or capture evidence.',
    Icon: CheckCircle2,
  },
  {
    title: 'Earn rewards',
    text: 'Verified quests add XP and may award drawing entries.',
    Icon: Zap,
  },
];

const proofTypes = [
  { label: 'GPS Check-In', text: 'Arrive inside the target zone and submit location proof.', Icon: MapPin },
  { label: 'Passphrase', text: 'Enter the word, number, or answer found through play.', Icon: KeyRound },
  { label: 'QR Scan', text: 'Scan an official Canton Quests marker when a quest asks for it.', Icon: QrCode },
  { label: 'Photo Proof', text: 'Capture field evidence for review when visual proof is required.', Icon: Camera },
  { label: 'Video Proof', text: 'Record a short challenge clip for Missions that use motion proof.', Icon: FileVideo },
];

const identityDetails = [
  { title: 'One player record', text: 'Your display name, avatar, XP, and public game history stay attached to the same identity.', Icon: BadgeCheck },
  { title: 'Mission entry', text: 'A Mission can require its own entry record before you see that Mission\'s quest board.', Icon: ClipboardCheck },
  { title: 'Private account data', text: 'Your public player label is shown for gameplay; account credentials are not leaderboard copy.', Icon: ShieldCheck },
];

// FAMILY / CHALLENGE / SECRET are a universal player style choice, not a
// Mission-specific branch — see lib/path-tone.ts. Icons reuse the same ones
// as the door selector (components/ThreePathSelector.tsx) for consistency.
const pathStyleIcons = { family: Compass, challenge: Zap, secret: KeyRound } as const;
const pathStyles = (['family', 'challenge', 'secret'] as const).map((path) => ({
  title: PATH_TONES[path].label,
  text: PATH_TONES[path].description,
  Icon: pathStyleIcons[path],
}));

const missionDetails = [
  { title: 'Mission', text: 'A bounded game experience with its own rules, active window, leaderboard, rewards, and archive.', Icon: Compass },
  { title: 'Quest', text: 'A playable objective inside a Mission. Some are single-step; others unlock in sequence.', Icon: MapPin },
  { title: 'Proof', text: 'The evidence a quest requires before XP, entries, or completion can be awarded.', Icon: ClipboardCheck },
];

const leaderboardRules = [
  { title: 'Rank source', text: 'Mission leaderboards total verified score ledger points for that Mission only.', Icon: Trophy },
  { title: 'Tie break', text: 'If XP is tied, whoever reached that score first ranks higher.', Icon: Medal },
  { title: 'Zero score players', text: 'Entered players can appear before they have points, so the board reflects participation too.', Icon: UserRound },
];

const drawingRules = [
  { title: 'Build the number', text: 'The Final Quest Number is built from frozen Mission totals, but it is not the winning ticket.', Icon: Hash },
  { title: 'Set the window', text: 'N is the total valid tickets. W is the number of digits in N. With 356 tickets, W = 3.', Icon: Ticket },
  { title: 'Scan forward', text: 'Read overlapping W-digit windows from left to right, moving forward one digit at a time.', Icon: Compass },
  { title: 'Validate tickets', text: 'With 356 tickets, 809 is invalid because it exceeds 356. 092 is valid, so it points to ticket #92. Leading zeros are allowed.', Icon: CheckCircle2 },
  { title: 'Keep scanning', text: 'If a valid ticket belongs to someone ineligible for that specific prize, do not restart or reroll. Continue to the next overlapping window.', Icon: ShieldCheck },
  { title: 'Reverse scan', text: 'If the entire forward scan produces no eligible winner, reverse the Final Quest Number and scan again with the same rules.', Icon: ArrowRight },
  { title: 'Modulo fallback', text: 'If neither scan produces an eligible winner, use (FinalQuestNumber mod totalValidEntries) + 1.', Icon: ArrowRight },
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
      <CinematicNav eventHref={eventHref} context="global" />

      <main className="cq-page-main">
        <section className="cq-page-hero cq-page-hero-split">
          <div>
            <span className="cq-kicker">FIELD GUIDE</span>
            <h1>HOW TO PLAY.</h1>
            <p>
              Canton Quests turns real places and digital clues into playable Missions. Create a Player Identity,
              enter a Mission, complete quests, submit proof, and follow your XP, entries, and results from one
              account.
            </p>
            <div className="cq-page-actions">
              <Link href={eventHref} className="cq-gold-button">
                START PLAYING
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="cq-page-hero-art">
            <Image src={cqImages.coffeeQr} alt="Glowing Canton Quests QR card in a coffee shop" fill priority sizes="(max-width: 900px) 100vw, 44vw" />
          </div>
        </section>

        {/* GAMEPLAY STEPS */}
        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">GAMEPLAY LOOP</span>
              <h2>FROM PLAYER ID TO SCOREBOARD</h2>
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

        {/* PLAYER IDENTITY */}
        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">PLAYER IDENTITY</span>
              <h2>ONE IDENTITY, MANY MISSIONS</h2>
            </div>
          </div>
          <p>
            Your Player Identity is the account-level player record Canton Quests uses to recognize you. It holds
            your public callsign-style display name, avatar, permanent XP total, and the Mission entries tied to you.
            A Mission can still have its own participation state, but it connects back to the same player.
          </p>
          <div className="cq-proof-grid">
            {identityDetails.map(({ title, text, Icon }) => (
              <article key={title}>
                <Icon size={24} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* PLAYER PATH — a communication style, not a Mission branch */}
        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">PLAYER STYLE</span>
              <h2>FAMILY, CHALLENGE, OR SECRET</h2>
            </div>
          </div>
          <p>
            Your path is part of your Player Identity, not a Mission. It&apos;s a one-time style choice that stays
            with you everywhere in Canton Quests — it doesn&apos;t lock you into a location, a quest list, a prize
            pool, or a leaderboard. <strong>All three paths can play the same Quests. Your path mainly changes the
            way Canton Quests talks to you</strong> — tone, flavor text, and Commander wording.
          </p>
          <div className="cq-proof-grid">
            {pathStyles.map(({ title, text, Icon }) => (
              <article key={title}>
                <Icon size={24} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* MISSIONS AND QUESTS */}
        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">MISSIONS & QUESTS</span>
              <h2>WHAT YOU ENTER, WHAT YOU PLAY</h2>
            </div>
          </div>
          <p>
            A Mission is the container: rules, time window, leaderboard, prize structure, and the set of quests
            available inside it. A quest is the individual objective you complete. Some quests are solved on-screen,
            some send you into the field, and some require a specific proof type before the server awards anything.
          </p>
          <div className="cq-proof-grid">
            {missionDetails.map(({ title, text, Icon }) => (
              <article key={title}>
                <Icon size={24} aria-hidden="true" />
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
              <strong>XP and drawing entries are different.</strong> XP measures progress and performance. Your
              permanent Player Identity can show lifetime XP, while each Mission leaderboard ranks Mission-scoped XP.
              Drawing entries are separate. They may be earned through qualifying Quests, Entry Tokens, or other
              explicitly listed Mission objectives. Entries do not add XP or change leaderboard rank.
            </p>
            <Link href="/leaderboard" className="cq-gold-button">
              VIEW LEADERBOARD
              <Trophy size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* LEADERBOARD LOGIC */}
        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">LEADERBOARD WINNERS</span>
              <h2>HOW RANK IS DECIDED</h2>
            </div>
          </div>
          <p>
            The live leaderboard is XP-based. It reads verified score ledger rows for the selected Mission, totals
            each player&apos;s points, counts distinct completed quests, and sorts highest XP first. If XP is tied,
            whoever reached that score first ranks higher. Technically, the earlier latest scoring timestamp ranks
            first. Drawing entries are not a rank tie-breaker.
          </p>
          <div className="cq-proof-grid">
            {leaderboardRules.map(({ title, text, Icon }) => (
              <article key={title}>
                <Icon size={24} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
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

        {/* DRAWING ENTRIES */}
        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">PRIZES & ENTRIES</span>
              <h2>XP IS NOT A TICKET</h2>
            </div>
          </div>
          <p>
            Creating an account is free and gives 0 drawing entries. Each Mission publishes its own exact
            entry-earning rules. Drawing entries may come from qualifying Quests, Entry Tokens, or other explicitly
            listed Mission objectives. Completing your Player Identity earns <strong> +100 XP once</strong> — still
            0 entries.
          </p>
        </section>

        {/* FINAL QUEST NUMBER */}
        <section className="cq-page-section">
          <div className="cq-section-heading">
            <div>
              <span className="cq-kicker">DRAWING METHOD</span>
              <h2>FINAL QUEST NUMBER</h2>
            </div>
          </div>
          <p>
            When a Mission uses the Final Quest Number method, the drawing begins from the frozen valid ticket pool:
            totalPlayers = qualified players, totalValidEntries = valid drawing tickets, and totalCompletedQuests =
            verified Quest completions.
          </p>
          <p>
            <strong>
              FINAL QUEST NUMBER = (totalPlayers × totalValidEntries × totalCompletedQuests) × 311420151417215192019
            </strong>
          </p>
          <p>
            The Final Quest Number is not the winning ticket. It becomes the number stream used to locate the winning
            ticket.
          </p>
          <div className="cq-step-grid">
            {drawingRules.map(({ title, text, Icon }, index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <Icon size={30} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href="/#operations" />
    </div>
  );
}
