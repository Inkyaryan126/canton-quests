'use client';

import React, { useEffect, useState } from 'react';
import { X, FastForward } from 'lucide-react';
import {
  GameEffectsState,
  gameMomentManager,
  GameMoment,
} from '@/lib/game-effects';
import CityScanOverlay from './CityScanOverlay';
import PathLockEffect from './PathLockEffect';
import QuestCompleteEffect from './QuestCompleteEffect';
import RankUpEffect from './RankUpEffect';
import AchievementEffect from './AchievementEffect';
import FlashDropEffect from './FlashDropEffect';
import ChainCompleteEffect from './ChainCompleteEffect';
import FinaleQualificationEffect from './FinaleQualificationEffect';
import ThreeLocksFragmentEffect from './ThreeLocksFragmentEffect';
import CommanderTransmissionEffect from './CommanderTransmissionEffect';
import RewardTokenEffect from './RewardTokenEffect';
import UnlockEffect from './UnlockEffect';
import FieldEventEffect from './FieldEventEffect';
import ProgressionEffect from './ProgressionEffect';
import MajorCinematicEffect from './MajorCinematicEffect';
import SoundToggleControl from './SoundToggleControl';

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

  const handleSkipAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    gameMomentManager.skipAll();
  };

  return (
    <div
      className="cq-moment-overlay"
      onClick={handleDismiss}
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

      {/* Bottom Hint */}
      <footer className="cq-moment-footer-hint">
        <span>
          TAP ANYWHERE OR PRESS ESC TO CONTINUE
        </span>
      </footer>
    </div>
  );
}
