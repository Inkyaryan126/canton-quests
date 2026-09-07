'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { X, FastForward } from 'lucide-react';
import {
  GameEffectsState,
  gameMomentManager,
  GameMoment,
} from '@/lib/game-effects';
import CityScanOverlay from './CityScanOverlay';
import CommanderTransmissionEffect from './CommanderTransmissionEffect';
import CommanderTextTransmission from '../commander/CommanderTextTransmission';
import FlashDropEffect from './FlashDropEffect';
import SoundToggleControl from './SoundToggleControl';
import SystemStatusBadge from './SystemStatusBadge';

// Every moment below renders through HudParticlesCanvas — a <canvas>
// particle field. They're only ever needed once a matching game moment
// fires, so they're kept out of the initial bundle for every route
// (most never trigger one) and fetched on demand instead.
// Note: Next.js static analysis requires the options argument to be an
// inline object literal at each call site — a shared variable reference
// breaks the build ('next/dynamic options must be an object literal').
const PathLockEffect = dynamic(() => import('./PathLockEffect'), {
  ssr: false,
  loading: () => (
    <div className="cq-moment-loading">
      <SystemStatusBadge status="scanning" />
    </div>
  ),
});
const QuestCompleteEffect = dynamic(() => import('./QuestCompleteEffect'), {
  ssr: false,
  loading: () => (
    <div className="cq-moment-loading">
      <SystemStatusBadge status="scanning" />
    </div>
  ),
});
const RankUpEffect = dynamic(() => import('./RankUpEffect'), {
  ssr: false,
  loading: () => (
    <div className="cq-moment-loading">
      <SystemStatusBadge status="scanning" />
    </div>
  ),
});
const AchievementEffect = dynamic(() => import('./AchievementEffect'), {
  ssr: false,
  loading: () => (
    <div className="cq-moment-loading">
      <SystemStatusBadge status="scanning" />
    </div>
  ),
});
const ChainCompleteEffect = dynamic(() => import('./ChainCompleteEffect'), {
  ssr: false,
  loading: () => (
    <div className="cq-moment-loading">
      <SystemStatusBadge status="scanning" />
    </div>
  ),
});
const FinaleQualificationEffect = dynamic(() => import('./FinaleQualificationEffect'), {
  ssr: false,
  loading: () => (
    <div className="cq-moment-loading">
      <SystemStatusBadge status="scanning" />
    </div>
  ),
});
const ThreeLocksFragmentEffect = dynamic(() => import('./ThreeLocksFragmentEffect'), {
  ssr: false,
  loading: () => (
    <div className="cq-moment-loading">
      <SystemStatusBadge status="scanning" />
    </div>
  ),
});
const RewardTokenEffect = dynamic(() => import('./RewardTokenEffect'), {
  ssr: false,
  loading: () => (
    <div className="cq-moment-loading">
      <SystemStatusBadge status="scanning" />
    </div>
  ),
});
const UnlockEffect = dynamic(() => import('./UnlockEffect'), {
  ssr: false,
  loading: () => (
    <div className="cq-moment-loading">
      <SystemStatusBadge status="scanning" />
    </div>
  ),
});
const FieldEventEffect = dynamic(() => import('./FieldEventEffect'), {
  ssr: false,
  loading: () => (
    <div className="cq-moment-loading">
      <SystemStatusBadge status="scanning" />
    </div>
  ),
});
const ProgressionEffect = dynamic(() => import('./ProgressionEffect'), {
  ssr: false,
  loading: () => (
    <div className="cq-moment-loading">
      <SystemStatusBadge status="scanning" />
    </div>
  ),
});
const MajorCinematicEffect = dynamic(() => import('./MajorCinematicEffect'), {
  ssr: false,
  loading: () => (
    <div className="cq-moment-loading">
      <SystemStatusBadge status="scanning" />
    </div>
  ),
});

// CityScanOverlay, CommanderTransmissionEffect, CommanderTextTransmission,
// and FlashDropEffect render no canvas/particles, so they stay as regular
// imports above — no lazy-loading tradeoff needed for those.

export const BACKDROP_DISMISS_GRACE_MS = 300;

export function canBackdropDismissMoment(current: GameMoment, now = Date.now()): boolean {
  if (current.type === 'commander-transmission') return false;
  // Short/medium text transmissions are quick reads — a backdrop tap can
  // dismiss them like most moments. A LONG one (mission briefing, finale,
  // major reveals) gets the same protection as a video transmission: only
  // a deliberate Continue/Close/ESC may advance it.
  if (current.type === 'commander-text' && current.size === 'long') return false;

  const createdAt = current.timestamp ?? 0;
  if (createdAt > 0 && now - createdAt < BACKDROP_DISMISS_GRACE_MS) {
    return false;
  }

  return true;
}

export default function GameMomentOverlay() {
  const [effectsState, setEffectsState] = useState<GameEffectsState>(() =>
    gameMomentManager.getState()
  );

  useEffect(() => {
    const unsubscribe = gameMomentManager.subscribe((state) => {
      setEffectsState(state);
    });

    // Keyboard navigation (Escape to dismiss current moment)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        gameMomentManager.dismissCurrent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribe();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const current = effectsState.currentMoment;
  if (!current) return null;

  const handleDismiss = () => {
    gameMomentManager.dismissCurrent();
  };

  // Commander transmissions must never vanish from an accidental backdrop
  // tap, and newly-created moments should not be consumed by the same click
  // that opened them. Every other deliberate close path stays available.
  const handleBackdropDismiss = () => {
    if (!canBackdropDismissMoment(current)) return;
    handleDismiss();
  };

  const handleSkipAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    gameMomentManager.skipAll();
  };

  return (
    <div
      className="cq-moment-overlay"
      onClick={handleBackdropDismiss}
    >
      {/* Top HUD Utility Bar */}
      <header
        className="cq-moment-header"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cq-header-actions">
          <SoundToggleControl soundEnabled={effectsState.soundEnabled} />
          {effectsState.queue.length > 0 && (
            <span className="cq-moment-queue-badge">
              +{effectsState.queue.length} QUEUED
            </span>
          )}
        </div>

        <div className="cq-header-actions">
          {effectsState.queue.length > 0 && (
            <button
              type="button"
              onClick={handleSkipAll}
              className="cq-moment-skip-btn"
              aria-label="Skip all queued moments"
            >
              <FastForward size={14} />
              <span className="cq-sound-toggle-label">SKIP ALL</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className="cq-moment-close-btn"
            aria-label="Close current game moment"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Render Active Moment Content */}
      <main className="cq-moment-main">
        {current.type === 'city-scan' && (
          <CityScanOverlay
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'path-lock' && (
          <PathLockEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'quest-complete' && (
          <QuestCompleteEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'rank-up' && (
          <RankUpEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'achievement' && (
          <AchievementEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'flash-drop' && (
          <FlashDropEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'chain-complete' && (
          <ChainCompleteEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'finale-qualified' && (
          <FinaleQualificationEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {(current.type === 'three-locks-fragment' || current.type === 'three-locks-complete') && (
          <ThreeLocksFragmentEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'commander-transmission' && (
          <CommanderTransmissionEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'commander-text' && (
          <CommanderTextTransmission
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'reward-token' && (
          <RewardTokenEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'unlock' && (
          <UnlockEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'field-event' && (
          <FieldEventEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'leaderboard-milestone' && (
          <ProgressionEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}

        {current.type === 'major-cinematic' && (
          <MajorCinematicEffect
            moment={current}
            onDismiss={handleDismiss}
            reducedMotion={effectsState.reducedMotion}
          />
        )}
      </main>

      {/* Bottom Hint — never claims "tap anywhere" for a commander
          transmission, since backdrop taps are deliberately disabled there. */}
      <footer className="cq-moment-footer-hint">
        <span>
          {!canBackdropDismissMoment(current)
            ? 'USE THE CONTROLS ABOVE OR PRESS ESC TO CONTINUE'
            : 'TAP ANYWHERE OR PRESS ESC TO CONTINUE'}
        </span>
      </footer>
    </div>
  );
}
