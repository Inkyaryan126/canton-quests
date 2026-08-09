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

  const activeEvent = events.find((e) => e.status === 'active') || events[0];

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col font-mono text-xs">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Returning Player Quick Continue Bar */}
        {currentPlayer && activeEvent && (
          <div className="p-4 bg-amber-950/40 border border-amber-500/50 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{currentPlayer.avatarUrl || '⚡'}</span>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">WELCOME BACK AGENT</span>
                <span className="text-white font-extrabold text-sm">{currentPlayer.displayName}</span>
                <span className="text-amber-400 font-bold ml-2 font-mono">({currentPlayer.totalXp} XP)</span>
              </div>
            </div>
            <Link
              href={`/events/${activeEvent.slug}`}
              className="btn btn-primary text-xs py-2 px-4 font-bold flex items-center gap-1.5"
            >
              🚀 CONTINUE GAME →
            </Link>
          </div>
        )}

        {/* Hero Section */}
        <section className="text-center space-y-3 py-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono animate-fade-in font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            ACTIVE CITY REALITY GAME • CANTON, OHIO
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            CANTON IS HIDING <span className="text-gradient-amber">SOMETHING.</span>
          </h1>

          <p className="text-xs sm:text-sm text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Turn physical downtown streets into an unfolding game world. Decode ciphers, scan QR emblems,
            verify physical location proximity, collect badges, and compete on the Canton leaderboard.
          </p>
        </section>

        {/* First-Time Player Onboarding Card */}
        <section className="glass-panel p-5 space-y-3 border-cyan-500/40 glow-cyan">
          <h2 className="text-sm font-bold text-white uppercase flex items-center gap-2">
            <span>❓ How Canton Quests Works</span>
            <span className="badge badge-medium">FAST ONBOARDING</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-left pt-1">
            <div className="p-3 bg-obsidian/70 rounded-xl border border-gray-800 space-y-1">
              <span className="text-amber-400 font-bold text-xs block">1. PICK AGENT NAME</span>
              <span className="text-gray-300 text-[11px] block">No long signups or app download needed. Choose your callsign below.</span>
            </div>
            <div className="p-3 bg-obsidian/70 rounded-xl border border-gray-800 space-y-1">
              <span className="text-amber-400 font-bold text-xs block">2. EXPLORE CANTON</span>
              <span className="text-gray-300 text-[11px] block">Use the interactive Canton map to find available check-ins and secret drops.</span>
            </div>
            <div className="p-3 bg-obsidian/70 rounded-xl border border-gray-800 space-y-1">
              <span className="text-amber-400 font-bold text-xs block">3. VERIFY PROOF</span>
              <span className="text-gray-300 text-[11px] block">Check in via GPS, enter passphrases, scan QR codes, or upload photos.</span>
            </div>
            <div className="p-3 bg-obsidian/70 rounded-xl border border-gray-800 space-y-1">
              <span className="text-amber-400 font-bold text-xs block">4. TOP THE BOARD</span>
              <span className="text-gray-300 text-[11px] block">Earn XP, form squads with friends, unlock collectibles, and qualify for the Finale!</span>
            </div>
          </div>
        </section>

        {/* Player Identity Setup Component */}
        <PlayerIdentityBar onPlayerChanged={setCurrentPlayerState} />

        {/* Events Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              📍 Playable Canton Events
            </h2>
            <span className="text-xs text-cyan-400 font-mono">Canton, OH • Event Grid</span>
          </div>

          <div className="grid gap-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="glass-panel p-6 border-amber-500/30 glow-amber flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-medium bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold uppercase">
                      ● {event.status}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">Downtown Canton</span>
                  </div>

                  <h3 className="text-xl font-extrabold text-white">{event.title}</h3>
                  <p className="text-xs text-gray-300 leading-relaxed">{event.description}</p>

                  <div className="flex flex-wrap gap-3 text-xs font-mono text-gray-400 pt-1">
                    <span>⚡ Multiple Quests</span>
                    <span>📍 Downtown Canton</span>
                    <span>🏆 Live Leaderboard</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 min-w-[180px]">
                  <Link
                    href={`/events/${event.slug}`}
                    className="btn btn-primary w-full text-center text-xs py-3 font-bold"
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
      </main>

      <footer className="border-t border-[var(--border-subtle)] py-4 text-center text-xs font-mono text-gray-500 mt-8">
        Canton Quests Event Factory Engine • Urban Gameplay Layer • Canton, OH
      </footer>
    </div>
  );
}
