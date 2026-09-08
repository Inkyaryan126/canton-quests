'use client';

import React, { useEffect } from 'react';
import { cqSoundManager } from '@/lib/audio';
import HudSystemState from './HudSystemState';
import QuestMomentReveal from './QuestMomentReveal';

interface QuestStartEffectProps {
  questTitle: string;
  className?: string;
  reducedMotion?: boolean;
}

/**
 * The quest-start flagship moment: a brief HUD "signal acquired" beat when
 * a player arrives at a quest they can still attempt. This doesn't gate or
 * delay the real briefing content below it — it's presentation layered on
 * top of the existing page, using the same reveal/sound primitives as
 * quest completion.
 */
export default function QuestStartEffect({ questTitle, className = '', reducedMotion = false }: QuestStartEffectProps) {
  useEffect(() => {
    cqSoundManager.play('quest_start');
    // Fire once per mount (i.e. once per quest, since callers key this by
    // quest id) — never on every re-render of the host page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QuestMomentReveal
      reducedMotion={reducedMotion}
      className={`rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 to-stone-950 px-4 py-3 mb-4 ${className}`}
    >
      <HudSystemState
        state="armed"
        label="QUEST SIGNAL ACQUIRED"
        detail={`Tracking: ${questTitle}`}
        reducedMotion={reducedMotion}
      />
    </QuestMomentReveal>
  );
}
