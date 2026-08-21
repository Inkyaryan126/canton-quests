'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, ArrowRight } from 'lucide-react';
import CantonQuestsLogo from '@/components/CantonQuestsLogo';
import SoundToggleControl from '@/components/game-effects/SoundToggleControl';
import PlayerAvatar from '@/components/PlayerAvatar';
import { Player } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function Header() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    // 1. Instant check from localStorage display cache
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('canton_quests_current_player') ||
        window.localStorage.getItem('canton_player_profile');
      if (stored) {
        try {
          setPlayer(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    }

    // 2. Validate authoritative session with /api/auth/me via HTTP-only cookies
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.isAuthenticated && data.player) {
          setPlayer(data.player);
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('canton_quests_current_player', JSON.stringify(data.player));
          }
        } else {
          setPlayer(null);
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem('canton_quests_current_player');
            window.localStorage.removeItem('canton_player_profile');
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('canton_auth_token');
        window.localStorage.removeItem('canton_refresh_token');
        window.localStorage.removeItem('canton_quests_current_player');
        window.localStorage.removeItem('canton_player_profile');
      }
      setPlayer(null);
      router.push('/');
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-subtle)] bg-[#0b0f17]/90 backdrop-blur-md px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group text-decoration-none" aria-label="Canton Quests home">
          <CantonQuestsLogo
            variant="mark"
            size={38}
            priority
            className="rounded-lg shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0"
          />
          <div>
            <span className="font-display font-extrabold text-lg text-white tracking-tight leading-none block">
              CANTON <span className="text-amber-400">QUESTS</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400 tracking-wider block uppercase">
              Field Operations • Canton, OH
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <SoundToggleControl compact showLabel={false} />
          <Link
            href="/watch"
            className="btn btn-primary text-xs px-3 py-1.5 min-h-[36px] font-mono font-bold flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            📺 WATCH LIVE
          </Link>
          {player ? (
            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                className="cq-nav-player-pill group"
                title={`Player Command Center: ${player.displayName}`}
                aria-label={`Player Command Center for ${player.displayName}`}
              >
                <PlayerAvatar
                  avatarUrl={player.avatarUrl}
                  displayName={player.displayName}
                  size={30}
                  className="cq-nav-avatar"
                  showRing={true}
                />
                <div className="cq-nav-player-info">
                  <span className="cq-nav-player-eyebrow">AGENT</span>
                  <span className="cq-nav-player-name">{player.displayName}</span>
                </div>
                <ArrowRight size={13} className="cq-nav-player-arrow" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="cq-nav-logout-btn"
                title="Explicit Log Out"
                aria-label="Log Out"
              >
                <LogOut size={13} aria-hidden="true" />
                <span className="hidden sm:inline">LOG OUT</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="btn btn-secondary text-xs px-3 py-1.5 min-h-[36px] font-mono text-gray-300 hover:text-white"
            >
              🔑 Log In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
