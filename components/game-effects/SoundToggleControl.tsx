'use client';

import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { gameMomentManager } from '@/lib/game-effects';
import { cqSoundManager } from '@/lib/audio';

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
  const [internalEnabled, setInternalEnabled] = useState<boolean>(() =>
    controlledEnabled !== undefined ? controlledEnabled : cqSoundManager.isSoundEnabled()
  );

  useEffect(() => {
    if (controlledEnabled !== undefined) {
      setInternalEnabled(controlledEnabled);
    }
  }, [controlledEnabled]);

  useEffect(() => {
    // Subscribe to sound manager updates for live sync across views
    const unsubscribe = cqSoundManager.subscribe((state) => {
      setInternalEnabled(state.soundEnabled);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const isEnabled = controlledEnabled !== undefined ? controlledEnabled : internalEnabled;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = cqSoundManager.toggleSound();
    gameMomentManager.setSoundEnabled(next);
    setInternalEnabled(next);

    // Play subtle confirm tone on unmuting
    if (next) {
      cqSoundManager.play('ui_confirm', { overrideCooldown: true, volume: 0.4 });
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`cq-sound-toggle-btn ${compact ? 'is-compact' : ''} ${
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
