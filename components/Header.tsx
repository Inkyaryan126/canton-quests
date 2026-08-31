'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Compass, Gift, KeyRound, LogOut, Map, Radio, Trophy, UserCircle2 } from 'lucide-react';
import CantonQuestsLogo from '@/components/CantonQuestsLogo';
import SoundToggleControl from '@/components/game-effects/SoundToggleControl';
import { Player } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isKnownCantonLaunchSlug } from '@/lib/launch-status';
import { createPlayerFileClickHandler } from '@/lib/player-file-nav';

interface HeaderProps {
  /**
   * When set, this is the Operation's own in-game nav bar — it shows quick
   * links to that Operation's Mission Board / Map / Leaderboard / Drawing,
   * scoped to /events/{eventSlug}/... Omit for chrome shared outside any
   * single Operation.
   */
  eventSlug?: string;
}

export default function Header({ eventSlug }: HeaderProps) {
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

  // PLAYER FILE is a permanent, platform-level nav destination — never
  // Mission-specific. See lib/player-file-nav.ts for the shared first-click
  // intro / already-viewed / logged-out branching, reused by every other
  // "go to /profile" control across the app so none of them can silently
  // bypass the one-time Transmission #11 intro.
  const handlePlayerFileClick = createPlayerFileClickHandler(router, player);

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
    <header className="cq-header-bar">
      <div className="cq-header-inner">
        <Link href="/" className="cq-header-logo-link" aria-label="Canton Quests home">
          <CantonQuestsLogo
            variant="mark"
            size={38}
            priority
            className="cq-nav-logo-mark"
          />
          <div>
            <span className="cq-header-brand-title">
              CANTON <span className="cq-gold-text">QUESTS</span>
            </span>
            <span className="cq-header-brand-subtitle">
              Field Operations • Canton, OH
            </span>
          </div>
        </Link>

        <div className="cq-header-actions">
          <SoundToggleControl compact showLabel={false} className="cq-nav-sound-toggle" />
          {/* Watch Live is a Mission-owned experience — only shown here for
              Founder's Cipher, which is the only Mission with real
              spectator content right now. */}
          {isKnownCantonLaunchSlug(eventSlug) && (
            <Link
              href={`/events/${eventSlug}/watch`}
              className="cq-header-live-btn"
            >
              <span className="cq-header-live-dot" />
              📺 WATCH LIVE
            </Link>
          )}
          {player ? (
            <div className="cq-nav-user-cluster">
              <Link
                href="/profile"
                onClick={handlePlayerFileClick}
                className="cq-header-profile-btn"
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
                    width={20}
                    height={20}
                    className="cq-nav-avatar-img"
                    style={{
                      width: '20px',
                      height: '20px',
                      minWidth: '20px',
                      minHeight: '20px',
                      maxWidth: '20px',
                      maxHeight: '20px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <span>{player.avatarUrl || '⚡'}</span>
                )}
                <span>{player.displayName}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="cq-header-logout-btn"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="cq-header-login-btn"
            >
              🔑 Log In
            </Link>
          )}
        </div>
      </div>

      {eventSlug && (
        <nav className="cq-header-operation-links" aria-label="Mission navigation">
          <Link href={`/events/${eventSlug}`}>
            <Compass size={13} aria-hidden="true" />
            Mission Home
          </Link>
          <Link href={`/events/${eventSlug}/quests`}>Mission Board</Link>
          <Link href={`/events/${eventSlug}/map`}>
            <Map size={13} aria-hidden="true" />
            Map
          </Link>
          <Link href={`/events/${eventSlug}/leaderboard`}>
            <Trophy size={13} aria-hidden="true" />
            Leaderboard
          </Link>
          <Link href={`/events/${eventSlug}/drawing`}>
            <Gift size={13} aria-hidden="true" />
            Drawing
          </Link>
          {isKnownCantonLaunchSlug(eventSlug) && (
            <Link href={`/events/${eventSlug}/transmissions`}>
              <Radio size={13} aria-hidden="true" />
              Transmissions
            </Link>
          )}
          {isKnownCantonLaunchSlug(eventSlug) && (
            <Link href={`/events/${eventSlug}/finale`}>
              <KeyRound size={13} aria-hidden="true" />
              Master Cipher
            </Link>
          )}
          {/* PLAYER FILE is a permanent platform nav item, not Mission-scoped
              — shown here regardless of auth state (a logged-out click
              routes through the existing register flow). */}
          <Link href="/profile" onClick={handlePlayerFileClick}>
            <UserCircle2 size={13} aria-hidden="true" />
            Player File
          </Link>
        </nav>
      )}
    </header>
  );
}
