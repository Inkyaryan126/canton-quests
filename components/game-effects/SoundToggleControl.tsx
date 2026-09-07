'use client';

import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { gameMomentManager } from '@/lib/game-effects';
import { cqSoundManager } from '@/lib/audio';
import { useSoundPreference } from '@/lib/audio/use-sound-preference';
import { confirmHaptic } from '@/lib/motion/haptics';
import motion from '@/lib/motion/primitives.module.css';

interface SoundToggleControlProps {
  /** @deprecated The manager is authoritative; retained for existing callers. */
  soundEnabled?: boolean;
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
  hapticsEnabled?: boolean;
}

export default function SoundToggleControl({
  className = '',
  showLabel = true,
  compact = false,
  hapticsEnabled = false,
}: SoundToggleControlProps) {
  const isEnabled = useSoundPreference();

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = cqSoundManager.toggleSound();
    gameMomentManager.setSoundEnabled(next);

    // Play subtle confirm tone on unmuting
    if (next) {
      void cqSoundManager.play('ui_confirm', { overrideCooldown: true, volume: 0.4 });
      confirmHaptic(hapticsEnabled);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`cq-sound-toggle-btn ${motion['cq-motion-control']} ${compact ? 'is-compact' : ''} ${
        isEnabled ? 'is-enabled' : 'is-muted'
      } ${className}`}
      aria-pressed={isEnabled}
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
