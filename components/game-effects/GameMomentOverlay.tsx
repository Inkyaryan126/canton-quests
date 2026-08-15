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
      className="fixed inset-0 z-[9990] flex flex-col justify-between pointer-events-auto"
      style={{ isolation: 'isolate' }}
    >
      {/* Top HUD Utility Bar */}
      <header className="relative z-[9999] flex items-center justify-between p-4 sm:p-6 pointer-events-auto">
        <div className="flex items-center gap-2">
          <SoundToggleControl soundEnabled={effectsState.soundEnabled} />
          {effectsState.queue.length > 0 && (
            <span className="text-[10px] font-mono text-stone-400 bg-stone-900/90 border border-stone-800 px-2.5 py-1 rounded-lg">
              +{effectsState.queue.length} QUEUED
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {effectsState.queue.length > 0 && (
            <button
              type="button"
              onClick={handleSkipAll}
              className="p-2 px-3 rounded-xl bg-stone-900/90 border border-stone-700 text-stone-300 hover:text-white text-xs font-mono flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              aria-label="Skip all queued moments"
            >
              <FastForward size={14} />
              <span className="hidden sm:inline text-[10px] uppercase font-bold">SKIP ALL</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className="p-2 rounded-xl bg-stone-900/90 border border-stone-700 text-stone-300 hover:text-white text-xs cursor-pointer transition-all active:scale-95"
            aria-label="Close current game moment"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Render Active Moment Content */}
      <main className="relative z-[9995] flex-1 flex items-center justify-center">
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
      </main>

      {/* Bottom Hint */}
      <footer className="relative z-[9999] p-3 text-center pointer-events-none select-none">
        <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest bg-black/60 px-3 py-1 rounded-full border border-stone-900">
          TAP ANYWHERE OR PRESS ESC TO CONTINUE
        </span>
      </footer>
    </div>
  );
}
