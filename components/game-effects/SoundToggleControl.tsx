'use client';

import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { gameMomentManager } from '@/lib/game-effects';
import { cqSoundManager } from '@/lib/audio';
import { useSoundPreference } from '@/lib/audio/sound-preference';
import { confirmHaptic } from '@/lib/motion';

interface SoundToggleControlProps {
  /** @deprecated cqSoundManager is authoritative; retained for existing callers. */
  soundEnabled?: boolean;
  /** Opt-in only: a brief confirmation pulse when sound is enabled. */
  hapticsEnabled?: boolean;
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

export default function SoundToggleControl({
  hapticsEnabled = false,
  className = '',
  showLabel = true,
  compact = false,
}: SoundToggleControlProps) {
  const isEnabled = useSoundPreference();

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = cqSoundManager.toggleSound();
    gameMomentManager.setSoundEnabled(next);

    // Play subtle confirm tone on unmuting
    if (next) {
      cqSoundManager.play('ui_confirm', { overrideCooldown: true, volume: 0.4 });
      confirmHaptic({ enabled: hapticsEnabled });
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`cq-sound-toggle-btn cq-transition-settle ${compact ? 'is-compact' : ''} ${
        isEnabled ? 'is-enabled' : 'is-muted'
      } ${className}`}
      aria-label={isEnabled ? 'Mute Canton Quests sound effects' : 'Unmute Canton Quests sound effects'}
      title={isEnabled ? 'Sound Effects Active (Click to mute)' : 'Sound Effects Muted (Click to enable)'}
    >
      {isEnabled ? <Volume2 size={compact ? 14 : 16} /> : <VolumeX size={compact ? 14 : 16} />}
      {showLabel && (
        <span className="cq-sound-toggle-label">
          {isEnabled ? 'SOUND ON' : 'SOUND OFF'}
        </span>
      )}
    </button>
  );
}
