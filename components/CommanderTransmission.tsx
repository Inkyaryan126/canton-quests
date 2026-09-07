'use client';

import { Radio, Video, RotateCcw } from 'lucide-react';
import { QuestCommanderTransmission } from '@/lib/types';
import CommanderMedia from './commander/CommanderMedia';
import TransmissionPanel from './game-effects/TransmissionPanel';

interface CommanderTransmissionProps {
  transmission: QuestCommanderTransmission;
  className?: string;
  /** Shows a small "Replay Transmission" affordance — pass when this transmission has already auto-shown once as a cinematic moment and is replayable. */
  onReplay?: () => void;
  reducedMotion?: boolean;
}

/**
 * Renders a Commander transmission as a persistent, inline briefing card —
 * VIDEO or PHOTO_MESSAGE, always visible on the page (not a one-time
 * overlay). For the cinematic full-screen "INCOMING TRANSMISSION" reveal
 * shown on quest open/completion/etc., see
 * components/game-effects/CommanderTransmissionEffect.tsx — both share the
 * same media rendering via components/commander/CommanderMedia.tsx.
 */
export default function CommanderTransmission({
  transmission,
  className = '',
  onReplay,
  reducedMotion = false,
}: CommanderTransmissionProps) {
  const Icon = transmission.type === 'VIDEO' ? Video : Radio;

  return (
    <TransmissionPanel
      eyebrow={transmission.headline || 'Commander Transmission'}
      icon={Icon}
      tone="amber"
      className={className}
      action={
        onReplay ? (
          <button
            type="button"
            onClick={onReplay}
            className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-stone-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <RotateCcw size={11} />
            Replay
          </button>
        ) : undefined
      }
    >
      <CommanderMedia transmission={transmission} variant="inline" reducedMotion={reducedMotion} />

      <p className="text-sm text-stone-200 leading-relaxed italic">&ldquo;{transmission.message}&rdquo;</p>
    </TransmissionPanel>
  );
}
