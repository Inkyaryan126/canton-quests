'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, LogOut, Compass } from 'lucide-react';
import CantonQuestsLogo from '@/components/CantonQuestsLogo';
import SoundToggleControl from '@/components/game-effects/SoundToggleControl';
import PlayerAvatar from '@/components/PlayerAvatar';
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
          <span className="cq-nav-brand-subtitle">CANTON, OHIO</span>
        </div>
      </Link>

      <div className="cq-nav-links">
        <Link href="/quests">QUESTS</Link>
        <Link href="/leaderboard">LEADERBOARD</Link>
        {player ? (
          <Link href="/profile" className="cq-gold-text font-bold">
            COMMAND CENTER
          </Link>
        ) : null}
        <Link href="/how-it-works">HOW IT WORKS</Link>
      </div>

      <div className="cq-nav-actions">
        <SoundToggleControl compact showLabel={false} className="cq-nav-sound-toggle" />
        <Link href="/watch" className="cq-watch-link">
          <span aria-hidden="true" />
          WATCH LIVE
        </Link>

        {player ? (
          <div className="cq-nav-user-cluster">
            <Link
              href="/profile"
              className="cq-gold-button cq-nav-cta"
              title={`Logged in as ${player.displayName}`}
            >
              <PlayerAvatar
                avatarUrl={player.avatarUrl}
                cropZoom={player.profileImageCropZoom}
                cropX={player.profileImageCropX}
                cropY={player.profileImageCropY}
                size={28}
                className="cq-nav-avatar-img cq-nav-avatar-fallback"
                fallback={player.displayName?.slice(0, 1).toUpperCase() || '⚡'}
                ariaLabel={`${player.displayName || 'Player'} avatar`}
              />
              <span className="cq-nav-player-callsign">{player.displayName}</span>
              <ArrowRight size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="cq-nav-logout-btn"
              title="Explicit Log Out"
              aria-label="Log Out"
            >
              <LogOut size={13} />
              <span className="cq-nav-logout-text">LOG OUT</span>
            </button>
          </div>
        ) : (
          <div className="cq-nav-user-cluster">
            <Link
              href="/login"
              className="cq-nav-login-btn"
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
