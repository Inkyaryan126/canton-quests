'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, LogOut, User, Compass, Trophy } from 'lucide-react';
import CantonQuestsLogo from '@/components/CantonQuestsLogo';
import SoundToggleControl from '@/components/game-effects/SoundToggleControl';
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
        <SoundToggleControl compact showLabel={false} className="hidden sm:flex" />
        <Link href="/watch" className="cq-watch-link">
          <span aria-hidden="true" />
          WATCH LIVE
        </Link>

        {player ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link
              href="/profile"
              className="cq-gold-button cq-nav-cta"
              title={`Logged in as ${player.displayName}`}
            >
              {player.avatarUrl && (
                player.avatarUrl.startsWith('/') ||
                player.avatarUrl.startsWith('http://') ||
                player.avatarUrl.startsWith('https://') ||
                player.avatarUrl.startsWith('data:image/') ||
                /\.(png|jpe?g|webp|svg|gif)($|\?)/i.test(player.avatarUrl)
              ) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={player.avatarUrl.trim()}
                  alt=""
                  width={28}
                  height={28}
                  className="cq-nav-avatar-img"
                  style={{
                    width: '28px',
                    height: '28px',
                    minWidth: '28px',
                    minHeight: '28px',
                    maxWidth: '28px',
                    maxHeight: '28px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <span
                  className="cq-nav-avatar-fallback"
                  style={{
                    width: '28px',
                    height: '28px',
                    minWidth: '28px',
                    minHeight: '28px',
                    borderRadius: '50%',
                    flexShrink: 0,
                  }}
                >
                  {player.avatarUrl && player.avatarUrl.trim()
                    ? player.avatarUrl.trim()
                    : (player.displayName?.slice(0, 1).toUpperCase() || '⚡')}
                </span>
              )}
              <span className="cq-nav-player-callsign">{player.displayName}</span>
              <ArrowRight size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.375rem 0.625rem',
                borderRadius: '0.5rem',
                backgroundColor: '#1c1917',
                border: '1px solid #44403c',
                color: '#a8a29e',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono, monospace)',
                cursor: 'pointer',
              }}
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
