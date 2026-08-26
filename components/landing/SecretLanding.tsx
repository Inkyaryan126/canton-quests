'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle,
  Eye,
  FileText,
  KeyRound,
  Lock,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Unlock,
} from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import FastPlayerOnboardForm from '@/components/FastPlayerOnboardForm';
import { ACQUISITION_ENTRY_HREF } from '@/lib/acquisition-landing-content';
import { cqImages } from '@/lib/marketing-assets';

export default function SecretLanding() {
  const [isDecrypted, setIsDecrypted] = useState(false);

  return (
    <div className="cq-home-shell cq-fair-shell cq-fair-secret">
      <CinematicNav eventHref={ACQUISITION_ENTRY_HREF} context="main-operation" />

      <main className="cq-fair-main">
        {/* HERO SECTION */}
        <section className="cq-fair-hero" aria-labelledby="secret-headline">
          <div className="cq-fair-copy">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-purple-500/15 border border-purple-400/40 text-purple-300 font-mono text-xs font-bold tracking-wider uppercase">
              <KeyRound size={14} className="text-purple-400" aria-hidden="true" />
              <span>CLASSIFIED ENTRY // UNLISTED SIGNAL</span>
            </div>

            <h1 id="secret-headline" className="text-white">
              YOU FOUND AN UNLISTED ENTRY POINT.
            </h1>

            <div className="cq-fair-support mt-3">
              <p className="text-amber-200 font-display font-extrabold text-lg sm:text-xl uppercase tracking-wide">
                Most players enter Canton Quests through the front door. You didn&apos;t.
              </p>
              <p className="text-gray-200 text-base leading-relaxed">
                Graves. Symbols. Forgotten names. Architectural dates. Multi-step cipher locks hiding in plain sight.
                Enter your callsign to claim this frequency and begin the investigation.
              </p>
            </div>

            <div className="cq-fair-actions mt-6">
              <FastPlayerOnboardForm
                startingPath="secret"
                acquisitionSource="secret_flyer"
                buttonLabel="INITIALIZE CIPHER AGENT"
                themeAccent="#a855f7"
                redirectTo="/profile"
              />
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs font-mono text-purple-200/90 font-bold">
              <Lock size={14} className="text-amber-400 shrink-0" aria-hidden="true" />
              <span>Unlisted Field Frequency Active · Individual Leaderboard Sync</span>
            </div>
          </div>

          <div className="cq-fair-visual !border-purple-500/40" aria-hidden="true">
            <Image
              src={cqImages.secretDoor}
              alt="Secret starting portal doorway in Monument Park"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 48vw"
              className="object-contain p-4 bg-stone-950/80"
            />
            <div className="cq-fair-visual-badge !border-purple-400/50 !text-purple-300 !bg-[#09070e]/90">
              <Radio size={16} className="text-purple-400 animate-pulse" />
              <span>MONUMENT PARK • SECRET PORTAL</span>
            </div>
          </div>
        </section>

        {/* MYSTERY HIGHLIGHT STRIP */}
        <section className="cq-fair-proof !border-purple-500/30" aria-label="Mystery characteristics">
          <div>
            <KeyRound size={18} aria-hidden="true" className="text-purple-400" />
            <span>UNLISTED CIPHERS</span>
          </div>
          <div>
            <Eye size={18} aria-hidden="true" className="text-purple-400" />
            <span>LOCAL MYSTERIES</span>
          </div>
          <div>
            <FileText size={18} aria-hidden="true" className="text-purple-400" />
            <span>REAL-WORLD NODES</span>
          </div>
          <div>
            <ShieldCheck size={18} aria-hidden="true" className="text-purple-400" />
            <span>NO SPOILERS</span>
          </div>
        </section>

        {/* INTERACTIVE SIGNAL DECRYPTION CARD */}
        <section className="cq-fair-objection mt-6 bg-[#0a0810]/90 border border-purple-500/35 p-6 md:p-8 rounded-2xl" aria-labelledby="signal-decrypt">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-mono font-bold tracking-widest text-purple-400 uppercase">
              FIELD SIGNAL INTERCEPT
            </span>
            <span className="text-[11px] font-mono text-gray-400">UNLISTED DOSSIER #00</span>
          </div>

          <h2 id="signal-decrypt" className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            INITIAL COORDINATE DECRYPTION
          </h2>

          <p className="text-gray-300 text-sm mt-1 max-w-2xl">
            Click to decrypt the first physical rendezvous coordinate before entering the game.
          </p>

          <div className="mt-4 p-4 rounded-xl bg-[#040407] border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="font-mono text-xs text-left w-full">
              <span className="text-gray-400 block text-[10px] uppercase">Rendezvous Signal:</span>
              <strong className="text-purple-300 text-sm block mt-0.5">
                {isDecrypted ? 'CENTENNIAL PLAZA / ARTS CORRIDOR // GRID 40.7989° N, 81.3748° W' : '•••••••• ••••• // •••••••••• ••••••• [ENCRYPTED]'}
              </strong>
            </div>

            <button
              type="button"
              onClick={() => setIsDecrypted(!isDecrypted)}
              className="btn btn-secondary !border-purple-500/50 !text-purple-300 hover:!bg-purple-950/40 text-xs font-mono font-bold py-2.5 px-4 whitespace-nowrap"
            >
              {isDecrypted ? (
                <>
                  <CheckCircle size={14} className="inline mr-1 text-emerald-400" /> SIGNAL DECRYPTED
                </>
              ) : (
                <>
                  <Unlock size={14} className="inline mr-1 text-purple-400" /> DECRYPT SIGNAL
                </>
              )}
            </button>
          </div>
        </section>

        {/* ACTIVE CLASSIFIED DOSSIERS */}
        <section className="cq-fair-teasers mt-6" aria-label="Secret quest case files">
          <div className="col-span-full mb-1">
            <span className="text-xs font-mono font-bold tracking-widest text-purple-400 uppercase">CLASSIFIED CASE FILES</span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-1">
              THE UNLISTED CANTON DOSSIERS
            </h2>
            <p className="text-gray-300 text-sm mt-1 max-w-2xl">
              These are real, playable missions embedded into the physical architecture of Canton, Ohio.
            </p>
          </div>

          <article className="bg-[#09070e]/95 border border-purple-500/25 p-5 rounded-2xl">
            <span className="text-purple-400 font-mono text-xs font-bold uppercase flex items-center gap-1.5">
              <KeyRound size={15} /> DOSSIER 01 // MULTI-STEP
            </span>
            <h3 className="text-lg font-bold text-white mt-2">The Founder&apos;s Three Locks</h3>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">
              A 3-step sequential cipher chain hidden across downtown Canton. Solving Lock One reveals the Painted Fragment; all three locks yield 650 XP and 4 prize entries.
            </p>
          </article>

          <article className="bg-[#09070e]/95 border border-purple-500/25 p-5 rounded-2xl">
            <span className="text-purple-400 font-mono text-xs font-bold uppercase flex items-center gap-1.5">
              <Search size={15} /> DOSSIER 02 // HISTORIC NODE
            </span>
            <h3 className="text-lg font-bold text-white mt-2">Frankenstein&apos;s Quiet Signal</h3>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">
              West Lawn Cemetery holds an unexpected piece of Canton lore. A quiet daytime historical node requiring respectful observation from a safe standing distance.
            </p>
          </article>

          <article className="bg-[#09070e]/95 border border-purple-500/25 p-5 rounded-2xl">
            <span className="text-purple-400 font-mono text-xs font-bold uppercase flex items-center gap-1.5">
              <Radio size={15} /> DOSSIER 03 // ROAMING NPC
            </span>
            <h3 className="text-lg font-bold text-white mt-2">The Courier&apos;s Secret Code</h3>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">
              A roaming Game Master agent spotted in the 4th Street Arts Corridor carrying physical passcode drops for alert puzzle solvers.
            </p>
          </article>
        </section>

        {/* UNWRITTEN DIRECTIVES & SAFETY PROTOCOLS */}
        <section className="cq-fair-sections mt-6" aria-labelledby="secret-directives">
          <div className="col-span-full mb-1">
            <span className="text-xs font-mono font-bold tracking-widest text-purple-400 uppercase">FIELD PROTOCOLS</span>
            <h2 id="secret-directives" className="text-2xl sm:text-4xl font-extrabold text-white mt-1">
              THE UNWRITTEN FIELD DIRECTIVES
            </h2>
          </div>

          <article className="bg-[#09070e]/95 border border-purple-500/25 p-5 rounded-2xl">
            <span className="text-purple-400 font-mono text-xs font-bold uppercase">OBSERVATION OVER SPEED</span>
            <h3 className="text-xl font-bold text-white mt-2">Look Up, Not Down</h3>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">
              The clues are etched into physical stone, brass entrance doors, and historical markers. Your phone acts as the field decoder—the actual game is in the city around you.
            </p>
          </article>

          <article className="bg-[#09070e]/95 border border-emerald-500/30 p-5 rounded-2xl">
            <span className="text-emerald-400 font-mono text-xs font-bold uppercase flex items-center gap-1">
              <ShieldCheck size={15} /> SAFETY OVER IMMERSION
            </span>
            <h3 className="text-xl font-bold text-white mt-2">Respect The Site</h3>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">
              Mystery never overrides real-world safety. All clues are reachable from safe public sidewalks during open hours. No trespassing, no night climbs, and zero disturbance of historic spaces.
            </p>
          </article>
        </section>

        {/* PROGRESSIVE REVELATION SEQUENCE */}
        <section className="cq-fair-objection mt-6 bg-[#0a0810]/90 border border-purple-500/35 p-6 md:p-8 rounded-2xl" aria-labelledby="secret-sequence">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <span className="text-xs font-mono font-bold tracking-widest text-purple-400 uppercase">
              DECODED PROTOCOL // PROGRESSION
            </span>
            <span className="text-[11px] font-mono text-gray-400">SEQUENCE 01–05</span>
          </div>

          <h2 id="secret-sequence" className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            WHAT YOU JUST UNLOCKED
          </h2>
          <p className="text-gray-300 text-sm mt-1 max-w-2xl">
            You didn&apos;t just scan a flyer. You uncovered an active signal layer over Canton.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mt-6 text-xs font-mono">
            <div className="bg-[#050408] border border-purple-500/25 p-3.5 rounded-xl">
              <span className="text-purple-400 font-bold block text-sm mb-1">01 // YOU FOUND IT</span>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                You spotted a hidden physical QR marker placed in the city.
              </p>
            </div>
            <div className="bg-[#050408] border border-purple-500/25 p-3.5 rounded-xl">
              <span className="text-purple-400 font-bold block text-sm mb-1">02 // HIDDEN GRID</span>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                Canton monuments, murals, and brass doorways conceal active clues.
              </p>
            </div>
            <div className="bg-[#050408] border border-purple-500/25 p-3.5 rounded-xl">
              <span className="text-purple-400 font-bold block text-sm mb-1">03 // UNLISTED GATE</span>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                This frequency is an unlisted portal directly into the field game.
              </p>
            </div>
            <div className="bg-[#050408] border border-purple-500/25 p-3.5 rounded-xl">
              <span className="text-purple-400 font-bold block text-sm mb-1">04 // CANTON QUESTS</span>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                A living real-world game turning the entire city into an adventure.
              </p>
            </div>
            <div className="bg-[#050408] border border-amber-500/40 p-3.5 rounded-xl bg-purple-950/20">
              <span className="text-amber-300 font-bold block text-sm mb-1">05 // ENTER THE GAME</span>
              <p className="text-gray-200 text-[11px] leading-relaxed">
                Pick a mission, walk the sidewalks, and start solving.
              </p>
            </div>
          </div>
        </section>

        {/* PRIZE TRANSPARENCY CUE */}
        <section className="cq-fair-objection mt-6 bg-[#0a0810]/90 border border-purple-500/35 p-6 md:p-8 rounded-2xl" aria-labelledby="secret-prize-trust">
          <div className="flex items-center gap-2 text-purple-400 font-mono text-xs font-bold uppercase tracking-wider">
            <Trophy size={18} aria-hidden="true" />
            <span>PUBLICLY VERIFIABLE PRIZE DRAWINGS</span>
          </div>
          <h2 id="secret-prize-trust" className="text-xl sm:text-2xl font-extrabold text-white mt-1">
            OPEN, VERIFIABLE PRIZE DRAWINGS
          </h2>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed max-w-2xl">
            Canton Quests does not secretly choose prize winners. Our drawing process follows a fixed public method that can be followed and verified after the event.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3 text-xs font-mono">
            <span className="text-gray-400">
              Fixed beforehand · Based on frozen event totals · Zero manual selection
            </span>
            <Link
              href="/how-it-works#prize-drawings"
              className="text-purple-400 hover:text-purple-300 underline font-bold inline-flex items-center gap-1"
            >
              Learn how drawings work →
            </Link>
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}
        <section className="cq-fair-final mt-8 !border-purple-500/40" aria-label="Enter the quest call to action">
          <Image src={cqImages.mckinleySunset} alt="" fill sizes="100vw" />
          <div>
            <span className="text-purple-400 font-mono text-xs font-bold uppercase tracking-widest">
              THE DOOR IS OPEN
            </span>
            <h2 className="text-white">YOU FOUND AN UNLISTED ENTRY POINT.</h2>
            <Link
              href={ACQUISITION_ENTRY_HREF}
              className="cq-gold-button font-display font-extrabold text-base py-3 px-6"
              data-fair-cta="secret"
            >
              ENTER THE QUEST
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href={ACQUISITION_ENTRY_HREF} label="ENTER THE QUEST" eyebrow="Unlisted cipher ready" />
    </div>
  );
}
