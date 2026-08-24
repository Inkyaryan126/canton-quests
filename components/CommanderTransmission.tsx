'use client';

import { Radio, Video, RotateCcw } from 'lucide-react';
import { QuestCommanderTransmission } from '@/lib/types';
import CommanderMedia from './commander/CommanderMedia';

interface CommanderTransmissionProps {
  transmission: QuestCommanderTransmission;
  className?: string;
  /** Shows a small "Replay Transmission" affordance — pass when this transmission has already auto-shown once as a cinematic moment and is replayable. */
  onReplay?: () => void;
}

/**
 * Renders a Commander transmission as a persistent, inline briefing card —
 * VIDEO or PHOTO_MESSAGE, always visible on the page (not a one-time
 * overlay). For the cinematic full-screen "INCOMING TRANSMISSION" reveal
 * shown on quest open/completion/etc., see
 * components/game-effects/CommanderTransmissionEffect.tsx — both share the
 * same media rendering via components/commander/CommanderMedia.tsx.
 */
export default function CommanderTransmission({ transmission, className = '', onReplay }: CommanderTransmissionProps) {
  const Icon = transmission.type === 'VIDEO' ? Video : Radio;

  return (
    <div className={`rounded-xl border border-amber-500/30 bg-[#0a0806] p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-amber-400" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
            {transmission.headline || 'Commander Transmission'}
          </span>
        </div>
        {onReplay && (
          <button
            type="button"
            onClick={onReplay}
            className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-stone-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <RotateCcw size={11} />
            Replay
          </button>
        )}
      </div>

      <CommanderMedia transmission={transmission} variant="inline" />

      <p className="text-sm text-stone-200 leading-relaxed italic">&ldquo;{transmission.message}&rdquo;</p>
    </div>
  );
}
