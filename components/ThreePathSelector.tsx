'use client';

import React, { useEffect, useRef, useState } from 'react';
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
import { getPathTone } from '@/lib/path-tone';
import FastPlayerOnboardForm from './FastPlayerOnboardForm';

interface ThreePathSelectorProps {
  currentPath?: StartingPath | null;
  onSelectPath?: (path: StartingPath) => void;
  eventSlug?: string;
  /** Overrides the default `/events/${eventSlug}` destination after signup — e.g. to preserve an intended Operation entry point. */
  redirectTo?: string;
  /**
   * When true, door selection does NOT show the account-creation form —
   * instead shows a lightweight "confirm & continue" action that calls
   * `onConfirm`. Use this for an already-logged-in player choosing their
   * path for an Operation that requires one (e.g. the Sept 11 Main
   * Operation) — they already have a permanent account, so re-showing
   * signup would be wrong.
   */
  confirmOnly?: boolean;
  onConfirm?: (path: StartingPath) => void | Promise<void>;
  confirmPending?: boolean;
  confirmError?: string | null;
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
export const DOOR_HOTSPOTS: {
  id: StartingPath;
  ariaLabel: string;
  className: string;
  icon: any;
  color: string;
  district: string;
  label: string;
  tag: string;
}[] = [
  {
    id: 'challenge',
    ariaLabel: 'Choose Challenge path',
    className: 'cq-door-challenge',
    icon: Zap,
    color: '#ef4444',
    district: 'Mother Goose Land',
    label: 'CHALLENGE',
    tag: 'Red Door',
  },
  {
    id: 'family',
    ariaLabel: 'Choose Family path',
    className: 'cq-door-family',
    icon: Compass,
    color: '#f59e0b',
    district: 'Arts District',
    label: 'FAMILY',
    tag: 'Gold Door',
  },
  {
    id: 'secret',
    ariaLabel: 'Choose Secret path',
    className: 'cq-door-secret',
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
  redirectTo,
  confirmOnly = false,
  onConfirm,
  confirmPending = false,
  confirmError = null,
}: ThreePathSelectorProps) {
  const [selectedPath, setSelectedPath] = useState<StartingPath | null>(currentPath || null);
  const confirmationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentPath) {
      setSelectedPath(currentPath);
    }
  }, [currentPath]);

  // Selecting a door reveals the onboarding form below the (often
  // full-viewport-tall) doors artwork — without this, players click a door
  // and never realize there's a form to fill in just below the fold. Scroll
  // it into view and, once visible, focus its first field so a keyboard/
  // screen-reader user lands right where they need to type.
  useEffect(() => {
    if (!selectedPath || !confirmationRef.current) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    confirmationRef.current.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    const focusTimer = window.setTimeout(() => {
      const firstField = confirmationRef.current?.querySelector<HTMLInputElement>('#onboard-callsign');
      // Only steal focus if the field is genuinely empty — never yank focus
      // away from a returning player already mid-typing after a re-render.
      if (firstField && document.activeElement !== firstField && !firstField.value) {
        firstField.focus({ preventScroll: true });
      }
    }, prefersReducedMotion ? 0 : 450);
    return () => window.clearTimeout(focusTimer);
  }, [selectedPath]);

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
    <div id="choose-path" className="cq-three-doors-section scroll-mt-28" aria-labelledby="three-paths-heading">
      <div className="cq-three-doors-intro">
        <span className="cq-three-doors-eyebrow">
          THREE VOICES. ONE CITY.
        </span>
        <h2 id="three-paths-heading" className="cq-three-doors-title">
          Choose How Canton Quests Speaks To You
        </h2>
        <p className="cq-three-doors-desc">
          Pick the style that feels like you. Your path changes the tone, flavor text, and Commander wording you see —
          it doesn&apos;t change which Quests you can play. Every Quest in Canton stays open to every path.
        </p>
      </div>

      {/* Single Large Combined 3-Doors Artwork with Interactive Responsive Hotspots */}
      <div className="cq-three-doors-frame">
        {/* Base Combined Artwork */}
        <Image
          src={cqImages.threeDoors || '/canton-quests/three_doors.png'}
          alt="Three starting portal doors: Challenge (Red), Family (Gold), Secret (Purple)"
          width={1672}
          height={941}
          priority
          sizes="(max-width: 1024px) 100vw, 1200px"
          className="cq-three-doors-image"
        />

        {/* Scrim Overlay */}
        <div className="cq-three-doors-scrim" />

        {/* Three Responsive Clickable Door Hotspots */}
        <div className="cq-three-doors-hotspots" role="group" aria-label="Select starting path door">
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
                className={`cq-door-hotspot ${door.className} ${isSelected ? 'is-selected' : ''}`}
              >
                {/* Top Badge Indicator */}
                <div className="cq-door-badge-row">
                  <span
                    className="cq-door-tag"
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
                    className="cq-door-icon-box"
                    style={{
                      backgroundColor: `${door.color}25`,
                      borderColor: `${door.color}60`,
                      color: door.color,
                    }}
                  >
                    {isSelected ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <Icon size={14} />
                    )}
                  </div>
                </div>

                {/* Bottom Interactive Identity Pill */}
                <div className="cq-door-pill-row">
                  <div
                    className="cq-door-pill"
                    style={{
                      backgroundColor: isSelected ? `${door.color}35` : 'rgba(5, 6, 7, 0.85)',
                      borderColor: isSelected ? door.color : `${door.color}60`,
                      color: isSelected ? '#ffffff' : door.color,
                    }}
                  >
                    <Icon size={13} style={{ color: door.color }} />
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                      <span className="cq-door-pill-title">
                        {door.label}
                      </span>
                      <span className="cq-door-pill-district">
                        {getPathTone(door.id)?.styleTag || door.district}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Path Lock Confirmation & Fast Onboarding Form (Revealed ONLY after explicit path selection) */}
      {selectedPath && activeOption ? (
        <div ref={confirmationRef} className="cq-door-confirmation scroll-mt-20" style={{ backgroundColor: `${activeOption.color}15`, borderColor: `${activeOption.color}50` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <CheckCircle2 size={20} style={{ color: activeOption.color, flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#ffffff', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block' }}>
                  PATH CONFIRMED: {activeOption.title}
                </strong>
                <span style={{ fontSize: '0.75rem', color: '#d1d5db', display: 'block', marginTop: '3px' }}>
                  {getPathTone(activeOption.id)?.description || activeOption.vibe}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#9ca3af', display: 'block', marginTop: '4px' }}>
                  Suggested Founder&apos;s Cipher starting point: {activeOption.district}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPath(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#9ca3af', textDecoration: 'underline' }}
            >
              <RotateCcw size={12} />
              <span>Change Door</span>
            </button>
          </div>

          {confirmOnly ? (
            <div className="cq-door-confirm-only">
              {confirmError && (
                <p style={{ color: '#f87171', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
                  {confirmError}
                </p>
              )}
              <button
                type="button"
                disabled={confirmPending}
                onClick={() => onConfirm?.(selectedPath)}
                className="cq-gold-button"
                style={{ width: '100%', marginTop: '0.5rem', opacity: confirmPending ? 0.6 : 1 }}
              >
                {confirmPending ? 'CONFIRMING...' : `CONFIRM ${activeOption.title} & CONTINUE`}
              </button>
            </div>
          ) : (
            /* Fast Callsign / Email Onboarding */
            <FastPlayerOnboardForm
              startingPath={selectedPath}
              acquisitionSource="main_site_path_selector"
              redirectTo={redirectTo || `/events/${eventSlug}`}
              themeAccent={activeOption.color}
              buttonLabel={`START ON ${activeOption.title}`}
            />
          )}
        </div>
      ) : (
        /* Prompt for unselected state */
        <div className="cq-door-prompt">
          <Sparkles size={14} style={{ color: '#f59e0b' }} />
          <span>Click the Red, Gold, or Purple door above to choose the style that fits you.</span>
        </div>
      )}

      {/* Rules Assurance Banner */}
      <div className="cq-door-rules-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span>One citywide individual leaderboard for all players.</span>
        </div>
        <Link
          href="/how-it-works"
          style={{ color: '#f59e0b', textDecoration: 'underline', flexShrink: 0 }}
        >
          How It Works →
        </Link>
      </div>
    </div>
  );
}
