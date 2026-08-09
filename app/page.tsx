'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import PlayerIdentityBar from '@/components/PlayerIdentityBar';
import { QuestEvent, Player } from '@/lib/types';
import { getEvents, getCurrentPlayer } from '@/lib/game-engine';

export default function HomePage() {
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [currentPlayer, setCurrentPlayerState] = useState<Player | null>(null);

  useEffect(() => {
    setEvents(getEvents());
    setCurrentPlayerState(getCurrentPlayer());
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 flex flex-col justify-between">
        <section className="my-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono mb-4 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            ACTIVE CITY EVENT • CANTON, OHIO
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-3">
            CANTON IS HIDING <span className="text-gradient-amber">SOMETHING.</span>
          </h1>

          <p className="text-sm sm:text-base text-gray-300 max-w-2xl mx-auto mb-6 leading-relaxed">
            Turn physical streets into an unfolding game world. Decode ciphers, scan QR emblems,
            complete real-world challenges, and compete on the Canton leaderboard.
          </p>
        </section>

        <PlayerIdentityBar onPlayerChanged={setCurrentPlayerState} />

        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              📍 Playable Canton Events
            </h2>
            <span className="text-xs font-mono text-cyan-400">Canton, OH • Vol. 1</span>
          </div>

          <div className="grid gap-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="glass-panel p-6 border-amber-500/30 glow-amber flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge badge-medium bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      ● LIVE EVENT ACTIVE
                    </span>
                    <span className="text-xs font-mono text-gray-400">Aug 7 – Aug 9</span>
                  </div>

                  <h3 className="text-2xl font-extrabold text-white mb-2">{event.title}</h3>
                  <p className="text-sm text-gray-300 mb-4 leading-relaxed">{event.description}</p>

                  <div className="flex flex-wrap gap-4 text-xs font-mono text-gray-400">
                    <span>⚡ 12 Playable Quests</span>
                    <span>📍 Downtown Canton</span>
                    <span>🏆 Live Leaderboard</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col gap-3 min-w-[180px]">
                  <Link
                    href={`/events/${event.slug}`}
                    className="btn btn-primary w-full text-center text-sm py-3"
                  >
                    🚀 ENTER EVENT HUB
                  </Link>

                  <Link
                    href={`/qr/AURA-BREW-2026`}
                    className="btn btn-secondary text-xs w-full text-center py-2 font-mono text-cyan-300 border-cyan-800/40 hover:border-cyan-500"
                  >
                    📷 Scan Test QR
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="glass-card p-4 text-center">
            <span className="text-3xl mb-2 block">📱</span>
            <h4 className="font-bold text-white mb-1 text-sm">Mobile Scanner PWA</h4>
            <p className="text-xs text-gray-400">Zero app store download. Works directly in browser on your phone.</p>
          </div>

          <div className="glass-card p-4 text-center">
            <span className="text-3xl mb-2 block">🧩</span>
            <h4 className="font-bold text-white mb-1 text-sm">5 Proof Verification Types</h4>
            <p className="text-xs text-gray-400">Check-ins, Passphrases, QR Codes, Photos, and Video Submissions.</p>
          </div>

          <div className="glass-card p-4 text-center">
            <span className="text-3xl mb-2 block">🏆</span>
            <h4 className="font-bold text-white mb-1 text-sm">Real-Time Scoring</h4>
            <p className="text-xs text-gray-400">Earn XP immediately, view event progress, and top the leaderboard.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border-subtle)] py-4 text-center text-xs font-mono text-gray-500">
        Canton Quests Phase 1 Core • Urban Gameplay Engine • Canton, OH
      </footer>
    </div>
  );
}
