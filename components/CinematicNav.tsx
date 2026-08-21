'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, LogOut, User, Compass, Trophy } from 'lucide-react';
import CantonQuestsLogo from '@/components/CantonQuestsLogo';
import { Player } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface CinematicNavProps {
  eventHref: string;
}

export default function CinematicNav({ eventHref }: CinematicNavProps) {
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
    <nav className="cq-nav" aria-label="Primary navigation">
      <Link href="/" className="cq-nav-logo" aria-label="Canton Quests home">
        <CantonQuestsLogo variant="mark" size={44} priority className="cq-nav-logo-mark" />
        <div className="cq-nav-brand-lockup">
          <span className="cq-nav-brand-title">
            CANTON <span className="cq-gold-text">QUESTS</span>
          </span>
          <span className="cq-nav-brand-subtitle">CITY ADVENTURE</span>
        </div>
      </Link>

      <div className="cq-nav-links">
        <Link href="/quests">QUESTS</Link>
        <Link href="/leaderboard">LEADERBOARD</Link>
        {player ? (
          <Link href="/profile" className="cq-gold-text font-bold">
            COMMAND CENTER
          </Link>
        ) : (
          <Link href="/how-it-works">HOW IT WORKS</Link>
        )}
      </div>

      <div className="cq-nav-actions">
        <Link href="/watch" className="cq-watch-link">
          <span aria-hidden="true" />
          WATCH LIVE
        </Link>

        {player ? (
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              className="cq-gold-button cq-nav-cta flex items-center gap-1.5"
              title={`Logged in as ${player.displayName}`}
            >
              <span>{player.avatarUrl || '⚡'}</span>
              <span className="truncate max-w-[110px]">{player.displayName}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-400 hover:text-red-400 text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer"
              title="Explicit Log Out"
              aria-label="Log Out"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">LOG OUT</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 hover:text-white text-xs font-mono transition-colors"
            >
              LOG IN
            </Link>
            <Link href={eventHref} className="cq-gold-button cq-nav-cta">
              START QUEST
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
