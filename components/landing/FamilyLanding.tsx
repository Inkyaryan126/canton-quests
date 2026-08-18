'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  Compass,
  Footprints,
  Heart,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import FastPlayerOnboardForm from '@/components/FastPlayerOnboardForm';
import { ACQUISITION_ENTRY_HREF } from '@/lib/acquisition-landing-content';
import { cqImages } from '@/lib/marketing-assets';

export default function FamilyLanding() {
  return (
    <div className="cq-home-shell cq-fair-shell cq-fair-family">
      <CinematicNav eventHref={ACQUISITION_ENTRY_HREF} />

      <main className="cq-fair-main">
        {/* HERO SECTION */}
        <section className="cq-fair-hero" aria-labelledby="family-headline">
          <div className="cq-fair-copy">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 font-mono text-xs font-bold tracking-wider uppercase">
              <Sparkles size={14} className="text-amber-400" aria-hidden="true" />
              <span>ALL-AGES CITY ADVENTURE</span>
            </div>

            <h1 id="family-headline" className="text-white">
              TURN CANTON INTO YOUR PLAYGROUND
            </h1>

            <div className="cq-fair-support">
              <p className="text-amber-200 font-display font-extrabold text-lg sm:text-xl uppercase">
                Explore Canton together, solve clues, discover places, complete challenges, earn XP, and make memories.
              </p>
              <p className="text-gray-200 text-base leading-relaxed">
                Canton is hiding missions, clues, strange landmarks, and challenges in plain sight.
                Enter your callsign below and turn the city into a shared real-world adventure.
              </p>
            </div>

            <div className="cq-fair-actions mt-6">
              <FastPlayerOnboardForm
                startingPath="family"
                acquisitionSource="family_flyer"
                buttonLabel="START FAMILY QUEST"
                themeAccent="#f59e0b"
                redirectTo={ACQUISITION_ENTRY_HREF}
              />
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs font-mono text-amber-300/90 font-bold">
              <ShieldCheck size={15} className="text-emerald-400 shrink-0" aria-hidden="true" />
              <span>Zero App Store Download · Free Instant Walk-Up Play · One City Leaderboard</span>
            </div>
          </div>

          <div className="cq-fair-visual" aria-hidden="true">
            <Image
              src={cqImages.familyDoor}
              alt="Family starting portal doorway in Arts District"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 48vw"
              className="object-contain p-4 bg-stone-950/80"
            />
            <div className="cq-fair-visual-badge">
              <Users size={16} />
              <span>ARTS DISTRICT • FAMILY PORTAL</span>
            </div>
          </div>
        </section>

        {/* PROOF PILL ROW */}
        <section className="cq-fair-proof" aria-label="Family quest highlights">
          <div>
            <Zap size={18} aria-hidden="true" className="text-amber-400" />
            <span>NO APP DOWNLOAD</span>
          </div>
          <div>
            <Users size={18} aria-hidden="true" className="text-amber-400" />
            <span>PLAY TOGETHER</span>
          </div>
          <div>
            <MapPin size={18} aria-hidden="true" className="text-amber-400" />
            <span>REAL CANTON PLACES</span>
          </div>
          <div>
            <Trophy size={18} aria-hidden="true" className="text-amber-400" />
            <span>XP + PRIZE DRAWINGS</span>
          </div>
        </section>

        {/* 10-SECOND QUICK START SECTION */}
        <section className="cq-fair-objection mt-6 bg-[#0c0d0f]/90 border border-amber-500/30 p-6 md:p-8 rounded-2xl" aria-labelledby="family-quick-start">
          <span className="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase">10-SECOND QUICK START</span>
          <h2 id="family-quick-start" className="text-2xl sm:text-4xl font-extrabold text-white mt-1">
            HOW YOUR CREW PLAYS IN 3 SIMPLE STEPS
          </h2>
          <p className="text-gray-300 text-sm mt-2 max-w-2xl">
            No mandatory signup or login required before beginning. Pick a family callsign and jump straight into the live Canton game board.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-[#050607]/80 border border-amber-500/25 p-4 rounded-xl">
              <span className="text-amber-400 font-display font-black text-2xl">01</span>
              <h3 className="text-white font-extrabold text-lg mt-2">PICK A MISSION</h3>
              <p className="text-gray-300 text-xs leading-relaxed mt-1">
                Browse walkable downtown landmarks, public murals, and partner stops like Centennial Plaza or Aura Coffee.
              </p>
            </div>
            <div className="bg-[#050607]/80 border border-amber-500/25 p-4 rounded-xl">
              <span className="text-amber-400 font-display font-black text-2xl">02</span>
              <h3 className="text-white font-extrabold text-lg mt-2">EXPLORE TOGETHER</h3>
              <p className="text-gray-300 text-xs leading-relaxed mt-1">
                Walk to the physical location as a crew. Look up at historical markers, brass plaques, and street murals.
              </p>
            </div>
            <div className="bg-[#050607]/80 border border-amber-500/25 p-4 rounded-xl">
              <span className="text-amber-400 font-display font-black text-2xl">03</span>
              <h3 className="text-white font-extrabold text-lg mt-2">SNAP & SCORE</h3>
              <p className="text-gray-300 text-xs leading-relaxed mt-1">
                Scan on-site QR passcodes, enter puzzle answers, or submit team photos to earn instant XP and prize drawing tickets.
              </p>
            </div>
          </div>
        </section>

        {/* ALL-AGES ROLES SECTION */}
        <section className="cq-fair-sections mt-6" aria-labelledby="family-roles">
          <div className="col-span-full mb-2">
            <span className="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase">EVERYONE CONTRIBUTES</span>
            <h2 id="family-roles" className="text-2xl sm:text-4xl font-extrabold text-white mt-1">
              ROLES FOR PARENTS, KIDS & FRIENDS
            </h2>
            <p className="text-gray-300 text-sm mt-1 max-w-2xl">
              Canton Quests is designed for shared teamwork where different ages and observation skills make the difference.
            </p>
          </div>

          <article className="bg-[#0c0d0f]/90 border border-amber-500/25 p-5 rounded-2xl">
            <span className="text-amber-400 font-mono text-xs font-bold uppercase flex items-center gap-1.5">
              <Search size={16} aria-hidden="true" /> THE CLUE SPOTTER
            </span>
            <h3 className="text-xl font-bold text-white mt-2">Finds Hidden Details</h3>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">
              Sharp eyes find the 4-digit year on the McKinley monument stairs, spot the hidden word in Onesto&apos;s brass doorway, or find QR cards.
            </p>
          </article>

          <article className="bg-[#0c0d0f]/90 border border-amber-500/25 p-5 rounded-2xl">
            <span className="text-amber-400 font-mono text-xs font-bold uppercase flex items-center gap-1.5">
              <Compass size={16} aria-hidden="true" /> THE NAVIGATOR
            </span>
            <h3 className="text-xl font-bold text-white mt-2">Maps The Next Stop</h3>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">
              Plots the walking route between Centennial Plaza, the Palace Theatre, and the 4th Street Arts Corridor using the live game map.
            </p>
          </article>

          <article className="bg-[#0c0d0f]/90 border border-amber-500/25 p-5 rounded-2xl">
            <span className="text-amber-400 font-mono text-xs font-bold uppercase flex items-center gap-1.5">
              <Camera size={16} aria-hidden="true" /> THE PHOTOGRAPHER
            </span>
            <h3 className="text-xl font-bold text-white mt-2">Captures The Moment</h3>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">
              Snaps the team pose in front of the giant Arts District butterfly and octopus murals to verify photo quests and make memories.
            </p>
          </article>

          <article className="bg-[#0c0d0f]/90 border border-amber-500/25 p-5 rounded-2xl">
            <span className="text-amber-400 font-mono text-xs font-bold uppercase flex items-center gap-1.5">
              <Zap size={16} aria-hidden="true" /> THE DECODER
            </span>
            <h3 className="text-xl font-bold text-white mt-2">Solves The Puzzles</h3>
            <p className="text-gray-300 text-xs leading-relaxed mt-1">
              Breaks the Founder Cipher riddles, enters mystery passcodes, and unlocks collectible cipher tokens for the crew.
            </p>
          </article>
        </section>

        {/* THE CITY IS THE GAME BOARD SECTION */}
        <section className="cq-fair-objection mt-6 bg-[#0c0d0f]/90 border border-amber-500/30 p-6 md:p-8 rounded-2xl" aria-labelledby="city-playground">
          <span className="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase">REAL CANTON PLACES</span>
          <h2 id="city-playground" className="text-2xl sm:text-4xl font-extrabold text-white mt-1">
            WALKABLE DOWNTOWN + LANDMARK DETOURS
          </h2>
          <p className="text-gray-300 text-sm mt-2 max-w-2xl">
            Most family quests are clustered in walkable downtown Canton. A few landmark adventures (like the McKinley Memorial) are a short 5-minute drive away.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <div className="bg-[#050607]/80 border border-amber-500/20 p-3.5 rounded-xl">
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase block">Walkable Hub</span>
              <strong className="text-white text-sm block mt-1">Centennial Plaza</strong>
              <p className="text-gray-400 text-xs mt-1">Central plaza signal, open seating, and live outdoor screens.</p>
            </div>
            <div className="bg-[#050607]/80 border border-amber-500/20 p-3.5 rounded-xl">
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase block">Walkable Arts</span>
              <strong className="text-white text-sm block mt-1">4th Street Murals</strong>
              <p className="text-gray-400 text-xs mt-1">Colorful street murals and family photo challenges.</p>
            </div>
            <div className="bg-[#050607]/80 border border-amber-500/20 p-3.5 rounded-xl">
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase block">Walkable Treats</span>
              <strong className="text-white text-sm block mt-1">Local Partner Stops</strong>
              <p className="text-gray-400 text-xs mt-1">Aura Craft Coffee and Arcade Vault with exclusive player perks.</p>
            </div>
            <div className="bg-[#050607]/80 border border-amber-500/20 p-3.5 rounded-xl">
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase block">5-Min Drive</span>
              <strong className="text-white text-sm block mt-1">McKinley Monument</strong>
              <p className="text-gray-400 text-xs mt-1">108 stone steps, historic views, and stone-carved ciphers.</p>
            </div>
          </div>
        </section>

        {/* FAMILY SAFETY & FAIR PLAY DIRECTIVES */}
        <section className="cq-fair-objection mt-6 bg-[#0c0d0f]/90 border border-emerald-500/30 p-6 md:p-8 rounded-2xl" aria-labelledby="family-safety">
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>REAL-WORLD SAFETY DIRECTIVES</span>
          </div>
          <h2 id="family-safety" className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            FAMILY ADVENTURE WITH SAFETY BUILT IN
          </h2>
          <p className="text-gray-300 text-sm mt-1 max-w-2xl">
            Real-world player safety always overrides game progress. Please review these simple field rules:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs font-mono">
            <div className="bg-[#050607]/80 border border-emerald-500/20 p-3 rounded-xl flex items-start gap-2.5">
              <Users size={16} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <strong className="text-white block">Stay Together</strong>
                <span className="text-gray-300">Keep children and team members within sight during all missions.</span>
              </div>
            </div>
            <div className="bg-[#050607]/80 border border-emerald-500/20 p-3 rounded-xl flex items-start gap-2.5">
              <Footprints size={16} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <strong className="text-white block">Use Marked Crosswalks</strong>
                <span className="text-gray-300">Always cross Canton streets at pedestrian crosswalks and obey signals.</span>
              </div>
            </div>
            <div className="bg-[#050607]/80 border border-emerald-500/20 p-3 rounded-xl flex items-start gap-2.5">
              <Heart size={16} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <strong className="text-white block">Respect Local Spaces</strong>
                <span className="text-gray-300">Local shops and public spaces are partners—never enter private or staff areas.</span>
              </div>
            </div>
            <div className="bg-[#050607]/80 border border-emerald-500/20 p-3 rounded-xl flex items-start gap-2.5">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <strong className="text-white block">No Trespassing or Dangerous Shortcuts</strong>
                <span className="text-gray-300">Every clue is accessible from safe, open public sidewalks during daylight hours.</span>
              </div>
            </div>
          </div>
        </section>

        {/* PRIZE TRANSPARENCY CUE */}
        <section className="cq-fair-objection mt-6 bg-[#0c0d0f]/90 border border-amber-500/30 p-6 md:p-8 rounded-2xl" aria-labelledby="family-prize-trust">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
            <Trophy size={18} aria-hidden="true" />
            <span>PUBLICLY VERIFIABLE PRIZE DRAWINGS</span>
          </div>
          <h2 id="family-prize-trust" className="text-xl sm:text-2xl font-extrabold text-white mt-1">
            TRANSPARENT, REPRODUCIBLE PRIZE DRAWINGS
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
              className="text-amber-400 hover:text-amber-300 underline font-bold inline-flex items-center gap-1"
            >
              Learn how drawings work →
            </Link>
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}
        <section className="cq-fair-final mt-8" aria-label="Start quest call to action">
          <Image src={cqImages.questStrip} alt="" fill sizes="100vw" />
          <div>
            <span className="text-amber-400 font-mono text-xs font-bold uppercase tracking-widest">
              YOUR CANTON ADVENTURE BEGINS NOW
            </span>
            <h2 className="text-white">TURN CANTON INTO YOUR PLAYGROUND</h2>
            <Link
              href={ACQUISITION_ENTRY_HREF}
              className="cq-gold-button font-display font-extrabold text-base py-3 px-6"
              data-fair-cta="family"
            >
              START THE FAMILY QUEST
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href={ACQUISITION_ENTRY_HREF} label="START THE FAMILY QUEST" eyebrow="All-ages adventure ready" />
    </div>
  );
}
