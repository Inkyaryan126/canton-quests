'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import CantonQuestsLogo from '@/components/CantonQuestsLogo';
import { Player } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function Header() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
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

    const headers: Record<string, string> = {};
    const authToken = typeof window !== 'undefined' ? window.localStorage.getItem('canton_auth_token') : null;
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    fetch('/api/auth/me', { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.isAuthenticated && data.player) {
          setPlayer(data.player);
        } else if (!authToken) {
          setPlayer(null);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      if (typeof window !== 'undefined') {
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
          <Link
            href="/watch"
            className="btn btn-primary text-xs px-3 py-1.5 min-h-[36px] font-mono font-bold flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            📺 WATCH LIVE
          </Link>
          {player ? (
            <div className="flex items-center gap-1.5">
              <Link
                href="/profile"
                className="btn btn-secondary text-xs px-3 py-1.5 min-h-[36px] font-mono font-bold text-amber-300 hover:text-white border-amber-500/40"
              >
                {player.avatarUrl || '⚡'} {player.displayName}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary text-xs px-2 py-1.5 min-h-[36px] font-mono text-stone-400 hover:text-red-400 cursor-pointer"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut size={13} />
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
