'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  GameEffectsState,
  gameMomentManager,
  showGameMoment,
  GameMoment,
  GameMomentOptions,
  triggerQuestRewardSequence,
} from '@/lib/game-effects';
import GameMomentOverlay from './GameMomentOverlay';

interface GameEffectsContextValue {
  state: GameEffectsState;
  showMoment: (moment: GameMoment, options?: GameMomentOptions) => string;
  triggerRewardSequence: typeof triggerQuestRewardSequence;
  dismissCurrent: () => void;
  skipAll: () => void;
  toggleSound: () => boolean;
}

const GameEffectsContext = createContext<GameEffectsContextValue | null>(null);

export function GameEffectsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameEffectsState>(() => gameMomentManager.getState());

  useEffect(() => {
    return gameMomentManager.subscribe((nextState) => {
      setState(nextState);
    });
  }, []);

  const value: GameEffectsContextValue = {
    state,
    showMoment: showGameMoment,
    triggerRewardSequence: triggerQuestRewardSequence,
    dismissCurrent: () => gameMomentManager.dismissCurrent(),
    skipAll: () => gameMomentManager.skipAll(),
    toggleSound: () => gameMomentManager.toggleSound(),
  };

  return (
    <GameEffectsContext.Provider value={value}>
      {children}
      <GameMomentOverlay />
    </GameEffectsContext.Provider>
  );
}

export function useGameEffects(): GameEffectsContextValue {
  const ctx = useContext(GameEffectsContext);
  if (!ctx) {
    // Fallback if rendered outside provider so it never crashes
    return {
      state: gameMomentManager.getState(),
      showMoment: showGameMoment,
      triggerRewardSequence: triggerQuestRewardSequence,
      dismissCurrent: () => gameMomentManager.dismissCurrent(),
      skipAll: () => gameMomentManager.skipAll(),
      toggleSound: () => gameMomentManager.toggleSound(),
    };
  }
  return ctx;
}
