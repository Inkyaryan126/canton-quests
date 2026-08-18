'use client';

import React, { useEffect, useState } from 'react';
import { Compass, Zap, KeyRound, CheckCircle2, ArrowRight, Shield } from 'lucide-react';
import { PathLockMoment } from '@/lib/game-effects';
import HudReticle from './HudReticle';
import HudParticlesCanvas, { ParticleMode } from './HudParticlesCanvas';
import { proceduralSoundEngine } from '@/lib/game-audio';

interface PathLockEffectProps {
  moment: PathLockMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

const PATH_THEMES = {
  family: {
    title: 'FAMILY',
    subtitle: 'Arts District Corridor',
    color: '#f59e0b',
    colorDark: '#78350f',
    icon: Compass,
    particleMode: 'gold-embers' as ParticleMode,
    reticleVariant: 'compass' as const,
    glow: 'rgba(245, 158, 11, 0.5)',
    description: 'Walkable downtown quests, public arts, family-friendly landmarks, and partner cafes.',
  },
  challenge: {
    title: 'CHALLENGE',
    subtitle: 'Mother Goose Land Corridor',
    color: '#ef4444',
    colorDark: '#7f1d1d',
    icon: Zap,
    particleMode: 'kinetic-streaks' as ParticleMode,
    reticleVariant: 'kinetic' as const,
    glow: 'rgba(239, 68, 68, 0.5)',
    description: 'High-energy physical challenges, video proof loops, timed sprints, and athletic heritage.',
  },
  secret: {
    title: 'SECRET',
    subtitle: 'Monument Park Corridor',
    color: '#a855f7',
    colorDark: '#581c87',
    icon: KeyRound,
    particleMode: 'cryptic-glyphs' as ParticleMode,
    reticleVariant: 'cryptic' as const,
    glow: 'rgba(168, 85, 247, 0.5)',
    description: 'Cryptic ciphers, multi-step sequential fragment locks, and forgotten Canton lore.',
  },
};

export default function PathLockEffect({
  moment,
  onDismiss,
  reducedMotion = false,
}: PathLockEffectProps) {
  const [stage, setStage] = useState<'locking' | 'confirmed'>('locking');
  const path = moment.path || 'family';
  const theme = PATH_THEMES[path] || PATH_THEMES.family;
  const Icon = theme.icon;

  useEffect(() => {
    proceduralSoundEngine.playPathLock(path);

    const t1 = setTimeout(() => {
      setStage('confirmed');
    }, reducedMotion ? 400 : 700);

    return () => {
      clearTimeout(t1);
    };
  }, [path, reducedMotion]);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg select-none"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
    >
      {/* Particle Canvas Background */}
      <HudParticlesCanvas
        mode={theme.particleMode}
        color={theme.color}
        reducedMotion={reducedMotion}
      />

      {/* Screen edge flash / pulse */}
      {!reducedMotion && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-700"
          style={{
            boxShadow: `inset 0 0 100px ${theme.glow}`,
            opacity: stage === 'locking' ? 0.8 : 0.35,
          }}
        />
      )}

      {/* Main HUD Card */}
      <div
        className="relative z-10 max-w-md w-full bg-[#07090e]/95 border-2 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl overflow-hidden transition-all duration-500"
        style={{
          borderColor: theme.color,
          boxShadow: `0 0 60px ${theme.glow}`,
          transform: reducedMotion ? 'none' : stage === 'locking' ? 'scale(0.96)' : 'scale(1)',
        }}
      >
        {/* Top HUD Geometry Reticle */}
        <div className="relative mx-auto flex items-center justify-center">
          <HudReticle
            size={110}
            color={theme.color}
            variant={theme.reticleVariant}
            spinning={!reducedMotion}
          />
          <div
            className="absolute w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-500"
            style={{
              backgroundColor: `${theme.color}25`,
              border: `1.5px solid ${theme.color}`,
              color: theme.color,
              transform: stage === 'confirmed' ? 'scale(1.1)' : 'scale(0.9)',
            }}
          >
            <Icon size={28} />
          </div>
        </div>

        {/* Lock Confirmation Badge */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-black uppercase tracking-widest bg-stone-900 border border-stone-700 text-stone-300">
            <Shield size={13} style={{ color: theme.color }} />
            <span>{stage === 'locking' ? 'LOCKING PROTOCOL...' : 'PATH LOCKED'}</span>
          </div>

          <h2
            className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight uppercase"
            style={{ textShadow: `0 0 20px ${theme.color}80` }}
          >
            {theme.title}
          </h2>
          <p className="text-xs font-mono text-stone-400 font-medium">
            {theme.subtitle}
          </p>
        </div>

        {/* Core Invariant Explanation Box */}
        <div
          className="p-3.5 rounded-2xl text-left space-y-1.5 border"
          style={{
            backgroundColor: `${theme.colorDark}30`,
            borderColor: `${theme.color}40`,
          }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} style={{ color: theme.color }} className="shrink-0" />
            <strong className="text-xs font-mono text-white uppercase tracking-wider">
              Starting Path Confirmed
            </strong>
          </div>
          <p className="text-[11px] text-stone-300 font-body leading-relaxed pl-6">
            All Canton quests remain 100% open to you. Solve any mission across the entire city on one unified leaderboard!
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="w-full py-3.5 px-5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider text-black flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer hover:brightness-110"
          style={{
            backgroundColor: theme.color,
            boxShadow: `0 4px 20px ${theme.glow}`,
          }}
        >
          <span>ENTER CANTON GRID</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
