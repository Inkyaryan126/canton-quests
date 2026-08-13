'use client';

import { useState, useEffect } from 'react';
import { Player } from '@/lib/types';

interface PlayerIdentityBarProps {
  onPlayerChanged?: (player: Player) => void;
}

const AVATARS = ['⚡', '🧭', '🔍', '🏆', '🎯', '🦅', '👾', '🔥'];
const PLAYER_STORAGE_KEY = 'canton_quests_current_player';

function getStoredPlayer(): Player {
  const stored = window.localStorage.getItem(PLAYER_STORAGE_KEY);
  if (stored) return JSON.parse(stored) as Player;

  const player: Player = {
    id: `plr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    displayName: 'Canton Explorer',
    avatarUrl: '⚡',
    role: 'player',
    totalXp: 0,
    level: 1,
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
  return player;
}

function saveStoredPlayer(displayName: string, avatarUrl: string): Player {
  const existing = getStoredPlayer();
  const updated: Player = {
    ...existing,
    displayName,
    avatarUrl,
  };
  window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export default function PlayerIdentityBar({ onPlayerChanged }: PlayerIdentityBarProps) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('⚡');

  useEffect(() => {
    const current = getStoredPlayer();
    setPlayer(current);
    setNameInput(current.displayName);
    setSelectedAvatar(current.avatarUrl || '⚡');
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    const updated = saveStoredPlayer(nameInput.trim(), selectedAvatar);
    setPlayer(updated);
    setIsEditing(false);
    if (onPlayerChanged) onPlayerChanged(updated);
  };

  if (!player) return null;

  return (
    <div className="glass-panel p-3 mb-6 flex flex-wrap items-center justify-between gap-3 border-amber-500/20">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl">
          {player.avatarUrl || '⚡'}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-white">{player.displayName}</span>
            <span className="badge badge-medium text-[10px] py-0 px-2">Level {player.level}</span>
          </div>
          <p className="text-xs text-gray-400 font-mono">Total XP: {player.totalXp} XP</p>
        </div>
      </div>

      <div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="btn btn-secondary text-xs px-3 py-1.5 min-h-[36px]"
          >
            ✏️ Switch / Edit Agent
          </button>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-2 p-3 bg-obsidian/90 rounded-xl border border-amber-500/30">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter Player Name..."
                className="input-field text-xs min-h-[36px] py-1 px-3"
                autoFocus
              />
              <button type="submit" className="btn btn-primary text-xs px-3 py-1.5 min-h-[36px]">
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn btn-secondary text-xs px-2 py-1.5 min-h-[36px]"
              >
                ✕
              </button>
            </div>
            
            <div className="flex items-center gap-1.5 mt-1 overflow-x-auto pb-1">
              <span className="text-[10px] text-gray-400 font-mono mr-1">Icon:</span>
              {AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedAvatar(emoji)}
                  className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center border transition-all ${
                    selectedAvatar === emoji
                      ? 'border-amber-400 bg-amber-500/20 scale-110'
                      : 'border-transparent hover:bg-gray-800'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
