'use client';

import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { gameMomentManager } from '@/lib/game-effects';
import { cqSoundManager, useSoundPreference } from '@/lib/audio';
import { triggerHaptic } from '@/lib/motion';
import motionStyles from '@/lib/motion/primitives.module.css';

interface SoundToggleControlProps {
  soundEnabled?: boolean;
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

export default function SoundToggleControl({
  soundEnabled: controlledEnabled,
  className = '',
  showLabel = true,
  compact = false,
}: SoundToggleControlProps) {
  // useSoundPreference is the shared primitive (lib/audio) — it subscribes
  // to cqSoundManager directly, so this control never tracks a duplicate
  // enabled/disabled flag of its own.
  const soundPreference = useSoundPreference();
  const isEnabled = controlledEnabled !== undefined ? controlledEnabled : soundPreference.enabled;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = soundPreference.toggle();
    gameMomentManager.setSoundEnabled(next);

    // Sparing, optional confirmation haptic — feature-detected, never
    // required, and never blocks the (already-instant) toggle.
    triggerHaptic();

    // Play subtle confirm tone on unmuting
    if (next) {
      cqSoundManager.play('ui_confirm', { overrideCooldown: true, volume: 0.4 });
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`cq-sound-toggle-btn ${motionStyles.transitionBase} ${compact ? 'is-compact' : ''} ${
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
