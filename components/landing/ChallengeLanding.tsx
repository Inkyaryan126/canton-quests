'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  Camera,
  CheckCircle2,
  Clock,
  Compass,
  Crown,
  Lock,
  Radar,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import FastPlayerOnboardForm from '@/components/FastPlayerOnboardForm';
import { ACQUISITION_ENTRY_HREF } from '@/lib/acquisition-landing-content';
import { cqImages, challengeSectorCards } from '@/lib/marketing-assets';

export default function ChallengeLanding() {
  return (
    <div className="cq-home-shell cq-fair-shell cq-fair-challenge">
      <CinematicNav eventHref={ACQUISITION_ENTRY_HREF} context="main-operation" />

      <main className="cq-fair-main">
        {/* HERO SECTION */}
        <section className="cq-fair-hero" aria-labelledby="challenge-headline">
          <div className="cq-fair-copy">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 font-mono text-xs font-bold tracking-wider uppercase">
              <Radio size={14} className="text-cyan-400 animate-pulse" aria-hidden="true" />
              <span>COMPETITIVE LIVE GRID // CITYWIDE PLAYERS</span>
            </div>

            <h1 id="challenge-headline" className="text-white">
              THINK YOU CAN BEAT CANTON?
            </h1>

            <h2 className="text-cyan-300 font-display font-black text-xl sm:text-2xl mt-3 uppercase tracking-wide">
              THE CITY IS THE BOARD. YOU&apos;RE IN THE RACE.
            </h2>

            <div className="cq-fair-support mt-3">
              <p className="text-gray-200 text-base leading-relaxed">
                Hidden codes. Real locations. Timed flash drops. Cryptographic ciphers. Live leaderboard pressure.
                Enter your callsign and jump straight into the individual competition.
              </p>
            </div>

            <div className="cq-fair-actions mt-6">
              <FastPlayerOnboardForm
                startingPath="challenge"
                acquisitionSource="challenge_flyer"
                buttonLabel="ACCEPT THE CHALLENGE"
                themeAccent="#ef4444"
                redirectTo="/profile"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-mono text-cyan-200/90 font-bold">
              <span className="inline-flex items-center gap-1.5 bg-cyan-950/60 border border-cyan-500/40 px-2.5 py-1 rounded-md">
                <Zap size={13} className="text-cyan-400" /> LIVE SCORE LEDGER
              </span>
              <span className="inline-flex items-center gap-1.5 bg-cyan-950/60 border border-cyan-500/40 px-2.5 py-1 rounded-md">
                <ShieldCheck size={13} className="text-emerald-400" /> INDIVIDUAL LEADERBOARD
              </span>
            </div>
          </div>

          <div className="cq-fair-visual !border-red-500/40" aria-hidden="true">
            <Image
              src={cqImages.challengeDoor}
              alt="Challenge starting portal doorway in Mother Goose Land"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 48vw"
              className="object-contain p-4 bg-stone-950/80"
            />
            <div className="cq-fair-visual-badge !border-red-400/50 !text-red-300 !bg-[#050b10]/90">
              <Radar size={16} className="text-red-400 animate-spin" />
              <span>MOTHER GOOSE LAND • CHALLENGE PORTAL</span>
            </div>
          </div>
        </section>

        {/* TELEMETRY METRIC STRIP */}
        <section className="cq-fair-proof !border-cyan-500/30" aria-label="Competitive metrics">
          <div>
            <Target size={18} aria-hidden="true" className="text-cyan-400" />
            <span>HIDDEN CODES</span>
          </div>
          <div>
            <Zap size={18} aria-hidden="true" className="text-cyan-400" />
            <span>GPS CHECK-INS</span>
          </div>
          <div>
            <Clock size={18} aria-hidden="true" className="text-cyan-400" />
            <span>TIMED FLASH DROPS</span>
          </div>
          <div>
            <Crown size={18} aria-hidden="true" className="text-cyan-400" />
            <span>LIVE LEADERBOARD</span>
          </div>
        </section>

        {/* TACTICAL SCORING MATRIX */}
        <section className="cq-fair-objection mt-6 bg-[#060e14]/90 border border-cyan-500/35 p-6 md:p-8 rounded-2xl" aria-labelledby="scoring-matrix">
          <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">PROGRESSION ENGINE</span>
          <h2 id="scoring-matrix" className="text-2xl sm:text-4xl font-extrabold text-white mt-1">
            THE TACTICAL SCORING MATRIX
          </h2>
          <p className="text-gray-300 text-sm mt-2 max-w-2xl">
            Points are earned strictly through physical field verification, observation accuracy, and puzzle execution.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 mt-6">
            <div className="bg-[#03070a]/90 border border-cyan-500/25 p-4 rounded-xl">
              <span className="text-xs font-mono text-cyan-400 uppercase font-bold block">01 // Base XP</span>
              <strong className="text-white text-lg block mt-1">75 – 650 XP</strong>
              <p className="text-gray-300 text-xs mt-2 leading-relaxed">
                4 verified mission tiers (Easy, Medium, Hard, Epic) awarded immediately upon proof verification.
              </p>
            </div>

            <div className="bg-[#03070a]/90 border border-cyan-500/25 p-4 rounded-xl">
              <span className="text-xs font-mono text-cyan-400 uppercase font-bold block">02 // Timed Drops</span>
              <strong className="text-white text-lg block mt-1">Flash Pop-Ups</strong>
              <p className="text-gray-300 text-xs mt-2 leading-relaxed">
                Pop-up missions broadcast live during active game hours. Hit the coordinate before the countdown expires.
              </p>
            </div>

            <div className="bg-[#03070a]/90 border border-cyan-500/25 p-4 rounded-xl">
              <span className="text-xs font-mono text-cyan-400 uppercase font-bold block">03 // Cipher Chains</span>
              <strong className="text-white text-lg block mt-1">Multi-Step Locks</strong>
              <p className="text-gray-300 text-xs mt-2 leading-relaxed">
                Sequential lock chains where solving step N deciphers the physical clue for step N+1.
              </p>
            </div>

            <div className="bg-[#03070a]/90 border border-cyan-500/25 p-4 rounded-xl">
              <span className="text-xs font-mono text-cyan-400 uppercase font-bold block">04 // Live Ranks</span>
              <strong className="text-white text-lg block mt-1">Board Dominance</strong>
              <p className="text-gray-300 text-xs mt-2 leading-relaxed">
                Real-time scoreboard recalculation tracking all verified field agents across Canton.
              </p>
            </div>
          </div>
        </section>

        {/* CHALLENGE SECTOR ROUTE CARDS (01 - 05) */}
        <section className="cq-challenge-cards-section" aria-labelledby="challenge-route-cards">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
                CHALLENGE SECTOR ROUTE
              </span>
              <h2 id="challenge-route-cards" className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                5 CANONICAL FIELD MISSION CARDS
              </h2>
            </div>
            <span className="text-xs font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-3 py-1 rounded-full font-bold">
              ROUTE SEQUENCE: 01 → 05
            </span>
          </div>

          <p className="text-gray-300 text-sm mt-2 max-w-3xl leading-relaxed">
            Follow the Challenge Sector path from the 9th Street Skate Park to the historic Mother Goose Land grounds.
            Each standalone mission card establishes on-site coordinates and field verification.
          </p>

          <div className="cq-challenge-cards-grid">
            {challengeSectorCards.map((card) => (
              <div key={card.number} className="cq-challenge-card-item">
                <div className="cq-challenge-card-image-wrap">
                  <Image
                    src={card.image}
                    alt={`${card.number} — ${card.title} (${card.location})`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                    className="object-contain"
                  />
                </div>
                <div className="cq-challenge-card-meta">
                  <span className="cq-challenge-card-meta-num">{card.number}</span>
                  <span className="cq-challenge-card-meta-loc" title={card.location}>{card.location}</span>
                  <span className="cq-challenge-card-meta-xp">+{card.rewardXp} XP</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FIELD ARCHETYPES SECTION */}
        <section className="cq-fair-sections mt-6" aria-labelledby="squad-roles">
          <div className="col-span-full mb-2">
            <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">TACTICAL PROFILES</span>
            <h2 id="squad-roles" className="text-2xl sm:text-4xl font-extrabold text-white mt-1">
              EXPLORER ARCHETYPES & SPEED TACTICS
            </h2>
            <p className="text-gray-300 text-sm mt-1 max-w-2xl">
              The highest-scoring agents master distinct field capabilities to minimize traversal delays and crack clues fast.
            </p>
          </div>

          <article className="bg-[#060e14]/90 border border-cyan-500/25 p-5 rounded-2xl">
            <span className="text-cyan-400 font-mono text-xs font-bold uppercase flex items-center gap-1.5">
              <Compass size={16} aria-hidden="true" /> ROUTE NAVIGATOR
            </span>
            <h3 className="text-xl font-bold text-white mt-2">Transit Optimization</h3>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">
              Calculates shortest pedestrian paths between Centennial Plaza, Court Ave murals, and downtown stops to maximize XP per minute.
            </p>
          </article>

          <article className="bg-[#060e14]/90 border border-cyan-500/25 p-5 rounded-2xl">
            <span className="text-cyan-400 font-mono text-xs font-bold uppercase flex items-center gap-1.5">
              <Brain size={16} aria-hidden="true" /> CRYPTOGRAPHER
            </span>
            <h3 className="text-xl font-bold text-white mt-2">Rapid Codebreaker</h3>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">
              Decrypts architectural dates, monument inscriptions, and secret passphrases without needing hints.
            </p>
          </article>

          <article className="bg-[#060e14]/90 border border-cyan-500/25 p-5 rounded-2xl">
            <span className="text-cyan-400 font-mono text-xs font-bold uppercase flex items-center gap-1.5">
              <Target size={16} aria-hidden="true" /> FIELD SCOUT
            </span>
            <h3 className="text-xl font-bold text-white mt-2">Point Verification</h3>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">
              Enters GPS geo-fences, scans on-site QR cards at partner venues, and identifies physical clue markers.
            </p>
          </article>

          <article className="bg-[#060e14]/90 border border-cyan-500/25 p-5 rounded-2xl">
            <span className="text-cyan-400 font-mono text-xs font-bold uppercase flex items-center gap-1.5">
              <Camera size={16} aria-hidden="true" /> PROOF SPECIALIST
            </span>
            <h3 className="text-xl font-bold text-white mt-2">Ledger Verification</h3>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">
              Captures clean photo/video evidence matching quest requirements and submits directly to the authoritative verification engine.
            </p>
          </article>
        </section>

        {/* COMPETITIVE INTEGRITY & SAFETY GUARD */}
        <section className="cq-fair-objection mt-6 bg-[#060e14]/90 border border-amber-500/35 p-6 md:p-8 rounded-2xl" aria-labelledby="rules-integrity">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
            <ShieldAlert size={18} aria-hidden="true" />
            <span>FAIR PLAY & SAFETY PROTOCOLS</span>
          </div>
          <h2 id="rules-integrity" className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            COMPETITIVE INTEGRITY GUARANTEE
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-5 text-xs font-mono">
            <div className="bg-[#03070a]/90 border border-amber-500/25 p-3.5 rounded-xl">
              <strong className="text-white text-sm block mb-1">Zero Pay-To-Win</strong>
              <p className="text-gray-300">
                You cannot purchase hints, skips, or leaderboard ranking. Pure observation, speed, and problem-solving determine the ranking.
              </p>
            </div>
            <div className="bg-[#03070a]/90 border border-amber-500/25 p-3.5 rounded-xl">
              <strong className="text-white text-sm block mb-1">Pedestrian & Crosswalk Safety</strong>
              <p className="text-gray-300">
                Explore on foot using marked sidewalks and pedestrian crosswalks. Dangerous shortcuts and vehicle-based point farming are prohibited.
              </p>
            </div>
            <div className="bg-[#03070a]/90 border border-amber-500/25 p-3.5 rounded-xl">
              <strong className="text-white text-sm block mb-1">Zero Trespassing</strong>
              <p className="text-gray-300">
                All physical targets are on public sidewalks or partner sites during open hours. No scaling fences or entering private lots.
              </p>
            </div>
          </div>
        </section>

        {/* PRIZE TRANSPARENCY CUE */}
        <section className="cq-fair-objection mt-6 bg-[#060e14]/90 border border-cyan-500/35 p-6 md:p-8 rounded-2xl" aria-labelledby="challenge-prize-trust">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider">
            <Trophy size={18} aria-hidden="true" />
            <span>PUBLICLY VERIFIABLE PRIZE DRAWINGS</span>
          </div>
          <h2 id="challenge-prize-trust" className="text-xl sm:text-2xl font-extrabold text-white mt-1">
            VERIFIABLE, DETERMINISTIC PRIZE DRAWINGS
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
              className="text-cyan-400 hover:text-cyan-300 underline font-bold inline-flex items-center gap-1"
            >
              Learn how drawings work →
            </Link>
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}
        <section className="cq-fair-final mt-8 !border-cyan-500/40" aria-label="Accept challenge call to action">
          <Image src={cqImages.mapHud} alt="" fill sizes="100vw" />
          <div>
            <span className="text-cyan-400 font-mono text-xs font-bold uppercase tracking-widest">
              THE LIVE GRID IS WAITING
            </span>
            <h2 className="text-white">THINK YOU CAN BEAT CANTON?</h2>
            <Link
              href={ACQUISITION_ENTRY_HREF}
              className="cq-gold-button font-display font-extrabold text-base py-3 px-6"
              data-fair-cta="challenge"
            >
              ACCEPT THE CHALLENGE
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href={ACQUISITION_ENTRY_HREF} label="ACCEPT THE CHALLENGE" eyebrow="Competitive grid active" />
    </div>
  );
}
