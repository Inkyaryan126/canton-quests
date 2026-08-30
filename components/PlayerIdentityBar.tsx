'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';
import { Player } from '@/lib/types';
import { createPlayerFileClickHandler } from '@/lib/player-file-nav';

interface PlayerIdentityBarProps {
  onPlayerChanged?: (player: Player) => void;
}

const AVATARS = ['⚡', '🧭', '🔍', '🏆', '🎯', '🦅', '👾', '🔥'];
const PLAYER_STORAGE_KEY = 'canton_quests_current_player';

function getStoredPlayer(): Player | null {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(PLAYER_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as Player;
      } catch {
        // ignore
      }
    }
  }
  return null;
}

function saveStoredPlayer(displayName: string, avatarUrl: string): Player {
  const existing = getStoredPlayer() || {
    id: `plr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    displayName: 'Canton Explorer',
    avatarUrl: '⚡',
    role: 'player' as const,
    totalXp: 0,
    level: 1,
    createdAt: new Date().toISOString(),
  };

  const updated: Player = {
    ...existing,
    displayName,
    avatarUrl,
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(updated));
  }
  return updated;
}

export default function PlayerIdentityBar({ onPlayerChanged }: PlayerIdentityBarProps) {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('⚡');
  // Shared with every other "go to /profile" control — see lib/player-file-nav.ts.
  const handlePlayerFileClick = createPlayerFileClickHandler(router, player);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.isAuthenticated && data.player) {
          setPlayer(data.player);
          setNameInput(data.player.displayName);
          setSelectedAvatar(data.player.avatarUrl || '⚡');
        } else {
          const current = getStoredPlayer();
          if (current) {
            setPlayer(current);
            setNameInput(current.displayName);
            setSelectedAvatar(current.avatarUrl || '⚡');
          }
        }
      })
      .catch(() => {
        const current = getStoredPlayer();
        if (current) {
          setPlayer(current);
          setNameInput(current.displayName);
          setSelectedAvatar(current.avatarUrl || '⚡');
        }
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    try {
      const res = await fetch('/api/player/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player?.id,
          displayName: nameInput.trim(),
          avatarUrl: selectedAvatar,
        }),
      });
      const data = await res.json();
      const updated = data.player || saveStoredPlayer(nameInput.trim(), selectedAvatar);
      setPlayer(updated);
      setIsEditing(false);
      if (onPlayerChanged) onPlayerChanged(updated);
    } catch {
      const updated = saveStoredPlayer(nameInput.trim(), selectedAvatar);
      setPlayer(updated);
      setIsEditing(false);
      if (onPlayerChanged) onPlayerChanged(updated);
    }
  };

  if (!player) return null;

  return (
    <div className="glass-panel p-3.5 mb-6 rounded-2xl border border-stone-800 bg-stone-950/80 shadow-lg flex flex-wrap items-center justify-between gap-3">
      {/* Player Bio Snippet */}
      <div className="flex items-center gap-3">
        <div
          className="cq-player-bar-avatar"
          style={{ borderColor: player.themeColor || '#f59e0b' }}
        >
          <PlayerAvatar
            avatarUrl={player.avatarUrl}
            cropZoom={player.profileImageCropZoom}
            cropX={player.profileImageCropX}
            cropY={player.profileImageCropY}
            size={44}
            className="cq-player-bar-avatar-img"
            style={{ borderRadius: '12px' }}
            ariaLabel={`${player.displayName || 'Player'} avatar`}
          />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-black text-white text-base tracking-tight">
              {player.displayName}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-stone-400 font-mono mt-0.5">
            <span className="text-amber-400 font-bold">{player.totalXp || 0} XP</span>
            {player.tagline && (
              <span className="italic text-stone-400 truncate max-w-[200px]">
                &quot;{player.tagline}&quot;
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          onClick={handlePlayerFileClick}
          className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <User size={13} className="text-amber-400" />
          <span>Profile & Badges</span>
        </Link>

        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 text-xs font-mono transition-colors cursor-pointer"
          >
            ✏️ Quick Edit
          </button>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-2 p-3 bg-stone-900 rounded-xl border border-amber-500/40 absolute z-30 right-4 mt-2 shadow-2xl">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter Callsign..."
                className="px-2.5 py-1.5 text-xs rounded-lg bg-stone-950 border border-stone-700 text-white font-mono"
                autoFocus
              />
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-mono font-bold cursor-pointer">
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2 py-1.5 rounded-lg bg-stone-800 text-stone-300 text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedAvatar(emoji)}
                  className={`w-6 h-6 rounded text-xs flex items-center justify-center border transition-all cursor-pointer ${
                    selectedAvatar === emoji
                      ? 'border-amber-400 bg-amber-500/20'
                      : 'border-transparent hover:bg-stone-800'
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
