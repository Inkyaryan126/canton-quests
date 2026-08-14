'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Compass,
  Zap,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { StartingPath } from '@/lib/types';
import FastPlayerOnboardForm from './FastPlayerOnboardForm';

interface ThreePathSelectorProps {
  currentPath?: StartingPath;
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
  flyerRoute: string;
  recommendedFor: string;
  sampleMissions: string[];
}

const PATH_OPTIONS: PathOption[] = [
  {
    id: 'family',
    title: 'FAMILY ADVENTURE',
    subtitle: 'Explore. Create. Discover Canton Together.',
    district: 'Downtown Arts & Central District',
    approximateArea: 'Centennial Plaza · 4th St Murals · Aura Coffee · Palace Theatre',
    vibe: 'Walkable, family-friendly, public murals, history markers, and local cafe check-ins.',
    icon: Compass,
    color: '#f59e0b', // Amber / Gold
    badge: 'All Ages Walkable',
    flyerRoute: '/start/family',
    recommendedFor: 'Families, friend groups, casual explorers, art lovers',
    sampleMissions: ['Open the Founder Signal', 'The Painted Witness', 'The Counter-Sign at Aura', 'Civic Seal Snapshot'],
  },
  {
    id: 'challenge',
    title: 'KINETIC CHALLENGE',
    subtitle: 'Move. Compete. Prove Your Speed & Skill.',
    district: 'Kinetic & Skill Challenge District',
    approximateArea: '9th Street Skate Park · Athletic & Arcade Corridors',
    vibe: 'High-energy physical challenges, video proof loops, timed sprints, and athletic heritage.',
    icon: Zap,
    color: '#ef4444', // Crimson / Red
    badge: 'Athletic & High XP',
    flyerRoute: '/start/challenge',
    recommendedFor: 'Competitive players, athletes, gamers, leaderboard chasers',
    sampleMissions: ['The Neon Victory Loop', 'The Helmet Trail Emblem', 'Flash Sprints'],
  },
  {
    id: 'secret',
    title: 'SECRET MYSTERY',
    subtitle: 'Decode. Investigate. Uncover Forgotten Lore.',
    district: 'Mystery & Monument Secret District',
    approximateArea: 'McKinley Monument · West Lawn Cemetery Corridor',
    vibe: 'Cryptic ciphers, multi-step sequential fragment locks, quiet historic monument exploration.',
    icon: KeyRound,
    color: '#a855f7', // Purple / Violet
    badge: 'Ciphers & Lore',
    flyerRoute: '/start/secret',
    recommendedFor: 'Puzzle solvers, history sleuths, cipher decoders, mystery seekers',
    sampleMissions: ['The Stone Stair Cipher', "Frankenstein's Quiet Signal", "The Founder's Three Locks Chain"],
  },
];

export default function ThreePathSelector({
  currentPath,
  onSelectPath,
  eventSlug = 'canton-launch-2026',
}: ThreePathSelectorProps) {
  const [selectedPath, setSelectedPath] = useState<StartingPath>(currentPath || 'family');
  const [showOnboardModal, setShowOnboardModal] = useState(false);

  const activeOption = PATH_OPTIONS.find((p) => p.id === selectedPath) || PATH_OPTIONS[0];

  const handleSelect = (path: StartingPath) => {
    setSelectedPath(path);
    if (onSelectPath) onSelectPath(path);
  };

  return (
    <section className="w-full my-8" aria-labelledby="three-paths-heading">
      <div className="text-center max-w-2xl mx-auto mb-8 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold tracking-wider uppercase mb-3">
          <Sparkles size={14} className="text-amber-400" />
          <span>THREE DOORS. ONE CITY GRID.</span>
        </div>
        <h2 id="three-paths-heading" className="font-display font-extrabold text-2xl sm:text-3xl text-white uppercase tracking-tight">
          Choose Your Starting Path
        </h2>
        <p className="text-sm text-stone-300 mt-2 font-body leading-relaxed">
          Canton Quests has <strong>three starting districts</strong> to distribute city action.
          Your starting path shapes where you begin, but <strong>never locks you out</strong>: all players compete on
          one individual leaderboard and can solve any quest in Canton!
        </p>
      </div>

      {/* Path Option Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto px-4">
        {PATH_OPTIONS.map((path) => {
          const isSelected = selectedPath === path.id;
          const Icon = path.icon;

          return (
            <div
              key={path.id}
              onClick={() => handleSelect(path.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelect(path.id)}
              className={`relative rounded-2xl p-5 text-left cursor-pointer transition-all duration-200 flex flex-col justify-between border ${
                isSelected
                  ? 'bg-stone-900/95 border-2 shadow-2xl scale-[1.02]'
                  : 'bg-stone-950/70 border-stone-800 hover:border-stone-700 hover:bg-stone-900/50'
              }`}
              style={{
                borderColor: isSelected ? path.color : undefined,
                boxShadow: isSelected ? `0 8px 30px ${path.color}30` : undefined,
              }}
            >
              {/* Top Tag & Icon */}
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
                    className="w-9 h-9 rounded-xl flex items-center justify-center border"
                    style={{
                      backgroundColor: `${path.color}15`,
                      borderColor: `${path.color}40`,
                      color: path.color,
                    }}
                  >
                    <Icon size={19} />
                  </div>
                </div>

                <h3 className="font-display font-black text-lg text-white mb-1 tracking-tight">
                  {path.title}
                </h3>
                <p className="text-xs text-stone-300 font-medium mb-3 leading-snug">
                  {path.subtitle}
                </p>

                <div className="space-y-2 pt-2 border-t border-stone-800 text-xs">
                  <div className="flex items-start gap-1.5 text-stone-400">
                    <MapPin size={14} className="shrink-0 mt-0.5" style={{ color: path.color }} />
                    <span className="font-mono text-[11px] text-stone-300">{path.district}</span>
                  </div>
                  <p className="text-[11px] text-stone-400 font-body">
                    {path.vibe}
                  </p>
                </div>
              </div>

              {/* Action / Select Button */}
              <div className="mt-5 pt-3 border-t border-stone-800/80 flex items-center justify-between">
                <span className="text-[11px] font-mono text-stone-400">
                  {isSelected ? '✓ Selected Path' : 'Click to Select'}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(path.id);
                    setShowOnboardModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1 text-black"
                  style={{
                    backgroundColor: path.color,
                  }}
                >
                  <span>Start Here</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Launch Panel for the Selected Path */}
      <div className="max-w-2xl mx-auto mt-8 px-4">
        <FastPlayerOnboardForm
          startingPath={selectedPath}
          acquisitionSource="main_site_path_selector"
          redirectTo={`/events/${eventSlug}`}
          themeAccent={activeOption.color}
          buttonLabel={`START ADVENTURE ON ${activeOption.title}`}
        />
      </div>

      {/* Rules Assurance Banner */}
      <div className="max-w-2xl mx-auto mt-5 px-4">
        <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800/80 flex items-center justify-between gap-3 text-xs text-stone-400 font-mono">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-amber-400 shrink-0" />
            <span>One citywide individual leaderboard for all players.</span>
          </div>
          <Link
            href={activeOption.flyerRoute}
            className="text-amber-400 hover:text-amber-300 underline underline-offset-2 shrink-0"
          >
            View {activeOption.title} Flyer Page →
          </Link>
        </div>
      </div>
    </section>
  );
}
