'use client';

import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { gameMomentManager } from '@/lib/game-effects';
import { proceduralSoundEngine } from '@/lib/game-audio';

interface SoundToggleControlProps {
  soundEnabled: boolean;
  className?: string;
}

export default function SoundToggleControl({
  soundEnabled,
  className = '',
}: SoundToggleControlProps) {
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = gameMomentManager.toggleSound();
    proceduralSoundEngine.setMuted(!next);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`p-2 rounded-xl border transition-all text-xs font-mono flex items-center gap-1.5 cursor-pointer select-none ${
        soundEnabled
          ? 'bg-stone-900/90 border-amber-500/50 text-amber-400 hover:bg-stone-800'
          : 'bg-stone-950/80 border-stone-800 text-stone-500 hover:bg-stone-900'
      } ${className}`}
      aria-label={soundEnabled ? 'Mute game sound effects' : 'Unmute game sound effects'}
      title={soundEnabled ? 'Sound Effects Active' : 'Sound Effects Muted'}
    >
      {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
      <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">
        {soundEnabled ? 'HUD AUDIO' : 'MUTED'}
      </span>
    </button>
  );
}
