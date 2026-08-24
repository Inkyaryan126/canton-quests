'use client';

import { useState } from 'react';
import { Radio } from 'lucide-react';
import { QuestCommanderTransmission } from '@/lib/types';
import { resolveTransmissionMediaMode } from '@/lib/commander-transmission-utils';

interface CommanderMediaProps {
  transmission: QuestCommanderTransmission;
  /** 'inline' for the briefing-card treatment, 'cinematic' for the full-overlay treatment. */
  variant?: 'inline' | 'cinematic';
  className?: string;
}

/**
 * Renders the media half of a Commander transmission — VIDEO or
 * PHOTO_MESSAGE — shared by the inline briefing card
 * (components/CommanderTransmission.tsx) and the cinematic overlay moment
 * (components/game-effects/CommanderTransmissionEffect.tsx) so the two
 * never duplicate the photo/video/fallback logic.
 *
 * No real Commander photo/video assets exist yet in this codebase — every
 * `mediaKey`/`posterKey` is a configurable placeholder string, never a
 * generated binary file. When a key is unset, or a VIDEO fails to load,
 * this renders a placeholder "Commander photo" treatment instead — never a
 * broken image/video element.
 */
export default function CommanderMedia({ transmission, variant = 'inline', className = '' }: CommanderMediaProps) {
  const [videoFailed, setVideoFailed] = useState(false);

  const isCinematic = variant === 'cinematic';
  const wantsVideo = resolveTransmissionMediaMode(transmission, videoFailed) === 'video';

  if (wantsVideo) {
    return (
      <div className={`relative w-full aspect-video bg-black overflow-hidden ${isCinematic ? 'rounded-t-2xl' : 'rounded-lg border border-amber-500/20'} ${className}`}>
        <video
          className="w-full h-full object-contain"
          src={transmission.mediaKey}
          poster={transmission.posterKey}
          controls
          playsInline
          onError={() => setVideoFailed(true)}
        >
          Your browser does not support video playback.
        </video>
      </div>
    );
  }

  // PHOTO_MESSAGE treatment (also used as the VIDEO fallback when no
  // mediaKey is configured yet, or playback failed).
  return (
    <div
      className={`relative w-full ${isCinematic ? 'aspect-[4/3] rounded-t-2xl' : 'aspect-video rounded-lg border border-amber-500/20'} bg-gradient-to-b from-stone-900 to-black overflow-hidden flex items-center justify-center ${className}`}
    >
      {transmission.posterKey || transmission.mediaKey ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={transmission.posterKey || transmission.mediaKey}
          alt="Commander transmission"
          className="cq-commander-media-img"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" aria-hidden="true" />
      <div className="relative flex flex-col items-center gap-2 text-stone-500">
        <Radio size={isCinematic ? 40 : 22} className="text-amber-500/70" />
        <span className="text-[10px] font-mono uppercase tracking-widest">
          {videoFailed ? 'Transmission unstable — audio only' : 'Photo transmission — media pending'}
        </span>
      </div>
    </div>
  );
}
