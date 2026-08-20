'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Compass,
  Zap,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  MapPin,
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
    <section id="choose-path" className="w-full my-8 scroll-mt-20" aria-labelledby="three-paths-heading">
      <div className="text-center max-w-2xl mx-auto mb-8 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold tracking-wider uppercase mb-3">
          <Sparkles size={14} className="text-amber-400" />
          <span>THREE DOORS • ONE CITY GRID</span>
        </div>
        <h2 id="three-paths-heading" className="font-display font-extrabold text-2xl sm:text-3xl text-white uppercase tracking-tight">
          Choose Your Starting Path
        </h2>
        <p className="text-sm text-stone-300 mt-2 font-body leading-relaxed">
          Canton Quests has <strong>three starting sections</strong> across Canton.
          Your starting path shapes your starting identity and first missions, but <strong>never locks you out</strong>: all players compete on
          one individual leaderboard and can solve any quest in Canton!
        </p>
      </div>

      {/* Path Option Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 max-w-6xl mx-auto px-4 items-stretch">
        {PATH_OPTIONS.map((path) => {
          const isSelected = selectedPath === path.id;
          const hasSelection = selectedPath !== null;
          const isDimmed = hasSelection && !isSelected;
          const Icon = path.icon;

          return (
            <div
              key={path.id}
              onClick={() => handleSelect(path.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelect(path.id)}
              className={`relative group rounded-2xl p-4 sm:p-5 text-left cursor-pointer transition-all duration-300 flex flex-col justify-between border ${
                isSelected
                  ? 'bg-stone-900/95 border-2 shadow-2xl scale-[1.02] opacity-100'
                  : isDimmed
                  ? 'bg-stone-950/60 border-stone-800/80 opacity-75 hover:opacity-100 hover:border-stone-700'
                  : 'bg-stone-950/85 border-stone-800 hover:border-stone-600 hover:bg-stone-900/60 hover:scale-[1.01]'
              }`}
              style={{
                borderColor: isSelected ? path.color : undefined,
                boxShadow: isSelected ? `0 8px 30px ${path.color}35` : undefined,
              }}
            >
              {/* Card Header: Badge & District Icon */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                    style={{
                      backgroundColor: `${path.color}18`,
                      borderColor: `${path.color}40`,
                      color: path.color,
                    }}
                  >
                    {path.badge}
                  </span>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors shrink-0"
                    style={{
                      backgroundColor: `${path.color}15`,
                      borderColor: `${path.color}40`,
                      color: path.color,
                    }}
                  >
                    <Icon size={17} />
                  </div>
                </div>

                {/* Cinematic Portal Doorway Art - Constrained & Cropped Cleanly (220-280px tall) */}
                <div
                  className="w-full rounded-xl overflow-hidden mb-3.5 bg-black/90 border border-stone-800/90 flex items-center justify-center transition-all group-hover:border-stone-700"
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '240px',
                    minHeight: '240px',
                    maxHeight: '260px',
                    overflow: 'hidden',
                  }}
                >
                  <Image
                    src={path.doorImage}
                    alt={`${path.title} starting portal door`}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    style={{
                      objectFit: 'cover',
                      objectPosition: 'center',
                    }}
                    className="transition-transform duration-500 group-hover:scale-105"
                  />
                  <div
                    className="absolute inset-0 pointer-events-none opacity-20 group-hover:opacity-35 transition-opacity"
                    style={{
                      background: `radial-gradient(circle at center, ${path.color}50 0%, transparent 75%)`,
                    }}
                  />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                  
                  {/* Subtle Doorway Identity Tag in Image */}
                  <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between pointer-events-none text-[10px] font-mono font-bold">
                    <span className="text-white/90 drop-shadow-md uppercase tracking-wider">
                      {path.district}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest bg-black/70 backdrop-blur-sm border"
                      style={{ borderColor: `${path.color}60`, color: path.color }}
                    >
                      DOORWAY
                    </span>
                  </div>
                </div>

                <h3 className="font-display font-black text-xl text-white mb-1 tracking-tight flex items-center justify-between">
                  <span>{path.title}</span>
                </h3>
                <p className="text-xs text-stone-300 font-medium mb-3 leading-snug">
                  {path.subtitle}
                </p>

                <div className="space-y-1.5 pt-2.5 border-t border-stone-800/90 text-xs">
                  <div className="flex items-start gap-1.5 text-stone-300">
                    <MapPin size={13} className="shrink-0 mt-0.5" style={{ color: path.color }} />
                    <span className="font-mono text-[11px] font-bold" style={{ color: path.color }}>
                      {path.district}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 font-body leading-relaxed">
                    {path.vibe}
                  </p>
                </div>
              </div>

              {/* Action / Select Button */}
              <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-stone-400 truncate">
                  {isSelected ? '✓ Path Active' : 'Starting Choice'}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(path.id);
                  }}
                  className="px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 text-black cursor-pointer hover:brightness-110 active:scale-95 shrink-0"
                  style={{
                    backgroundColor: path.color,
                  }}
                >
                  <span>{isSelected ? 'Selected' : `Choose ${path.title}`}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
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
                  All Canton quests remain 100% open to you on one unified citywide leaderboard.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPath(null)}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-stone-400 hover:text-white shrink-0 underline underline-offset-2 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Change Path</span>
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
            <span>Click one of the three paths above to lock in your starting door and unlock fast callsign setup.</span>
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
    </section>
  );
}
