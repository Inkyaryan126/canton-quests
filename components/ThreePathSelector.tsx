'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Compass,
  Zap,
  KeyRound,
  Sparkles,
  Trophy,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { StartingPath } from '@/lib/types';
import { cqImages } from '@/lib/marketing-assets';
import { showGameMoment } from '@/lib/game-effects';
import FastPlayerOnboardForm from './FastPlayerOnboardForm';

interface ThreePathSelectorProps {
  currentPath?: StartingPath | null;
  onSelectPath?: (path: StartingPath) => void;
  eventSlug?: string;
}

interface PathOption {
  id: StartingPath;
  title: string;
  subtitle: string;
  district: string;
  approximateArea: string;
  vibe: string;
  icon: any;
  color: string;
  badge: string;
  doorImage: string;
  flyerRoute: string;
  recommendedFor: string;
  sampleMissions: string[];
}

export const PATH_OPTIONS: PathOption[] = [
  {
    id: 'family',
    title: 'FAMILY',
    subtitle: 'Explore. Create. Discover Canton Together.',
    district: 'Arts District',
    approximateArea: 'Centennial Plaza · 4th St Murals · Aura Coffee · Palace Theatre',
    vibe: 'Walkable, family-friendly, public murals, history markers, and local cafe check-ins.',
    icon: Compass,
    color: '#f59e0b', // Amber / Gold
    badge: 'Arts District · Walkable',
    doorImage: cqImages.familyDoor,
    flyerRoute: '/start/family',
    recommendedFor: 'Families, friend groups, casual explorers, art lovers',
    sampleMissions: ['Open the Founder Signal', 'The Painted Witness', 'The Counter-Sign at Aura', 'Civic Seal Snapshot'],
  },
  {
    id: 'challenge',
    title: 'CHALLENGE',
    subtitle: 'Move. Compete. Prove Your Speed & Skill.',
    district: 'Mother Goose Land',
    approximateArea: 'Mother Goose Land · 9th St Skate Park · Athletic & Arcade Corridors',
    vibe: 'High-energy physical challenges, video proof loops, timed sprints, and athletic heritage.',
    icon: Zap,
    color: '#ef4444', // Crimson / Red
    badge: 'Mother Goose Land · High XP',
    doorImage: cqImages.challengeDoor,
    flyerRoute: '/start/challenge',
    recommendedFor: 'Competitive players, athletes, gamers, leaderboard chasers',
    sampleMissions: ['The Neon Victory Loop', 'The Helmet Trail Emblem', 'Flash Sprints'],
  },
  {
    id: 'secret',
    title: 'SECRET',
    subtitle: 'Decode. Investigate. Uncover Forgotten Lore.',
    district: 'Monument Park',
    approximateArea: 'Monument Park · McKinley Monument · West Lawn Cemetery Corridor',
    vibe: 'Cryptic ciphers, multi-step sequential fragment locks, quiet historic monument exploration.',
    icon: KeyRound,
    color: '#a855f7', // Purple / Violet
    badge: 'Monument Park · Ciphers',
    doorImage: cqImages.secretDoor,
    flyerRoute: '/start/secret',
    recommendedFor: 'Puzzle solvers, history sleuths, cipher decoders, mystery seekers',
    sampleMissions: ['The Stone Stair Cipher', "Frankenstein's Quiet Signal", "The Founder's Three Locks Chain"],
  },
];

// Ordered left-to-right matching the three_doors.png artwork: Left (Challenge), Center (Family), Right (Secret)
const DOOR_HOTSPOTS: {
  id: StartingPath;
  ariaLabel: string;
  positionClass: string;
  icon: any;
  color: string;
  district: string;
  label: string;
  tag: string;
}[] = [
  {
    id: 'challenge',
    ariaLabel: 'Choose Challenge path',
    positionClass: 'left-0 w-1/3',
    icon: Zap,
    color: '#ef4444',
    district: 'Mother Goose Land',
    label: 'CHALLENGE',
    tag: 'Red Door',
  },
  {
    id: 'family',
    ariaLabel: 'Choose Family path',
    positionClass: 'left-1/3 w-1/3',
    icon: Compass,
    color: '#f59e0b',
    district: 'Arts District',
    label: 'FAMILY',
    tag: 'Gold Door',
  },
  {
    id: 'secret',
    ariaLabel: 'Choose Secret path',
    positionClass: 'left-2/3 w-1/3',
    icon: KeyRound,
    color: '#a855f7',
    district: 'Monument Park',
    label: 'SECRET',
    tag: 'Purple Door',
  },
];

export default function ThreePathSelector({
  currentPath = null,
  onSelectPath,
  eventSlug = 'canton-weekend-1',
}: ThreePathSelectorProps) {
  const [selectedPath, setSelectedPath] = useState<StartingPath | null>(currentPath || null);

  useEffect(() => {
    if (currentPath) {
      setSelectedPath(currentPath);
    }
  }, [currentPath]);

  const activeOption = selectedPath ? PATH_OPTIONS.find((p) => p.id === selectedPath) || null : null;

  const handleSelect = (path: StartingPath) => {
    setSelectedPath(path);
    const opt = PATH_OPTIONS.find((p) => p.id === path);
    showGameMoment({
      type: 'path-lock',
      path,
      title: opt?.title,
      district: opt?.district,
      badge: opt?.badge,
    });
    if (onSelectPath) onSelectPath(path);
  };

  return (
    <div id="choose-path" className="w-full" aria-labelledby="three-paths-heading">
      <div className="text-center max-w-xl mx-auto mb-5 px-4">
        <span className="inline-block text-[11px] font-mono font-bold tracking-widest text-amber-400 uppercase mb-1.5">
          THREE DOORS. ONE CITY.
        </span>
        <h2 id="three-paths-heading" className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
          Choose Your Starting Path
        </h2>
        <p className="text-sm text-stone-300 mt-1.5 font-body leading-snug">
          Pick the door that fits your style. Your starting path gives you your first mission and identity — but every quest in Canton stays open to you.
        </p>
      </div>

      {/* Single Large Combined 3-Doors Artwork with Interactive Responsive Hotspots */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="relative rounded-3xl overflow-hidden border border-amber-500/30 shadow-2xl bg-black aspect-[1672/941]">
          {/* Base Combined Artwork */}
          <Image
            src={cqImages.threeDoors || '/canton-quests/three_doors.png'}
            alt="Three starting portal doors: Challenge (Red), Family (Gold), Secret (Purple)"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1200px"
            className="object-cover object-center select-none pointer-events-none"
          />

          {/* Scrim Overlay */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-black/30" />

          {/* Three Responsive Clickable Door Hotspots */}
          <div className="absolute inset-0 flex" role="group" aria-label="Select starting path door">
            {DOOR_HOTSPOTS.map((door) => {
              const isSelected = selectedPath === door.id;
              const Icon = door.icon;

              return (
                <button
                  key={door.id}
                  type="button"
                  onClick={() => handleSelect(door.id)}
                  aria-label={door.ariaLabel}
                  title={`${door.ariaLabel} (${door.district})`}
                  className={`absolute top-0 bottom-0 ${door.positionClass} group cursor-pointer focus-visible:outline-none transition-all duration-300 flex flex-col justify-between p-3 sm:p-6 rounded-2xl ${
                    isSelected
                      ? 'bg-black/30 ring-2 sm:ring-4 shadow-2xl'
                      : 'hover:bg-white/[0.04] focus-visible:ring-2'
                  }`}
                  style={{
                    borderColor: isSelected ? door.color : undefined,
                    boxShadow: isSelected ? `inset 0 0 40px ${door.color}40, 0 0 30px ${door.color}50` : undefined,
                  }}
                >
                  {/* Top Badge Indicator */}
                  <div className="w-full flex items-center justify-between pointer-events-none">
                    <span
                      className={`text-[9px] sm:text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full backdrop-blur-md border transition-all ${
                        isSelected
                          ? 'opacity-100 scale-105 shadow-md'
                          : 'opacity-70 group-hover:opacity-100 group-hover:scale-105'
                      }`}
                      style={{
                        backgroundColor: `${door.color}25`,
                        borderColor: `${door.color}60`,
                        color: door.color,
                      }}
                    >
                      {door.tag}
                    </span>

                    {/* Selected Checkmark / District Icon */}
                    <div
                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'scale-110 shadow-lg'
                          : 'opacity-80 group-hover:opacity-100 group-hover:scale-110'
                      }`}
                      style={{
                        backgroundColor: `${door.color}25`,
                        borderColor: `${door.color}60`,
                        color: door.color,
                      }}
                    >
                      {isSelected ? (
                        <CheckCircle2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                      ) : (
                        <Icon size={14} className="sm:w-[16px] sm:h-[16px]" />
                      )}
                    </div>
                  </div>

                  {/* Bottom Interactive Identity Pill */}
                  <div className="w-full flex justify-center pointer-events-none pb-1 sm:pb-2">
                    <div
                      className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-full backdrop-blur-md border text-center transition-all duration-300 shadow-xl flex items-center gap-1.5 sm:gap-2 ${
                        isSelected
                          ? 'scale-105 shadow-2xl ring-1'
                          : 'group-hover:scale-105 group-hover:brightness-125'
                      }`}
                      style={{
                        backgroundColor: isSelected ? `${door.color}35` : 'rgba(5, 6, 7, 0.85)',
                        borderColor: isSelected ? door.color : `${door.color}60`,
                        color: isSelected ? '#ffffff' : door.color,
                      }}
                    >
                      <Icon size={13} className="sm:w-[15px] sm:h-[15px] shrink-0" style={{ color: door.color }} />
                      <div className="flex flex-col text-left">
                        <span className="font-display font-black text-[11px] sm:text-sm tracking-tight uppercase leading-none">
                          {door.label}
                        </span>
                        <span className="text-[8px] sm:text-[10px] font-mono text-stone-300 leading-none mt-0.5 hidden xs:inline">
                          {door.district}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Path Lock Confirmation & Fast Onboarding Form (Revealed ONLY after explicit path selection) */}
      {selectedPath && activeOption ? (
        <div className="max-w-2xl mx-auto mt-8 px-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Confirmation Banner */}
          <div
            className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
            style={{
              backgroundColor: `${activeOption.color}15`,
              borderColor: `${activeOption.color}50`,
            }}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="shrink-0 mt-0.5" style={{ color: activeOption.color }} />
              <div>
                <strong className="text-xs font-mono text-white uppercase tracking-wider block">
                  STARTING PATH CONFIRMED: {activeOption.title} ({activeOption.district})
                </strong>
                <span className="text-[11px] text-stone-300 block mt-0.5">
                  {activeOption.vibe}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPath(null)}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-stone-400 hover:text-white shrink-0 underline underline-offset-2 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Change Door</span>
            </button>
          </div>

          {/* Fast Callsign / Email Onboarding */}
          <FastPlayerOnboardForm
            startingPath={selectedPath}
            acquisitionSource="main_site_path_selector"
            redirectTo={`/events/${eventSlug}`}
            themeAccent={activeOption.color}
            buttonLabel={`START ON ${activeOption.title}`}
          />
        </div>
      ) : (
        /* Prompt for unselected state */
        <div className="max-w-2xl mx-auto mt-6 px-4 text-center">
          <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-800 text-stone-400 text-xs font-mono flex items-center justify-center gap-2">
            <Sparkles size={14} className="text-amber-400" />
            <span>Click the Red, Gold, or Purple door in the image above to select your starting path.</span>
          </div>
        </div>
      )}

      {/* Rules Assurance Banner */}
      <div className="max-w-2xl mx-auto mt-6 px-4">
        <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800/80 flex items-center justify-between gap-3 text-xs text-stone-400 font-mono">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-amber-400 shrink-0" />
            <span>One citywide individual leaderboard for all players.</span>
          </div>
          <Link
            href="/how-it-works"
            className="text-amber-400 hover:text-amber-300 underline underline-offset-2 shrink-0"
          >
            How It Works →
          </Link>
        </div>
      </div>
    </div>
  );
}
