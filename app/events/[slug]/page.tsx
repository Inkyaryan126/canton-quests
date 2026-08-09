'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import PlayerIdentityBar from '@/components/PlayerIdentityBar';
import QuestCard from '@/components/QuestCard';
import Leaderboard from '@/components/Leaderboard';
import { QuestEvent, Quest, Player, LeaderboardEntry, PlayerEventProgress } from '@/lib/types';
import {
  getEventBySlug,
  getQuestsForEvent,
  getCurrentPlayer,
  getLeaderboardForEvent,
  getPlayerProgress,
} from '@/lib/game-engine';

export default function EventHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const eventSlug = resolvedParams.slug;

  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [currentPlayer, setCurrentPlayerState] = useState<Player | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [progress, setProgress] = useState<PlayerEventProgress | null>(null);
  const [activeTab, setActiveTab] = useState<'quests' | 'leaderboard' | 'rules'>('quests');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const refreshData = useCallback(() => {
    const foundEvent = getEventBySlug(eventSlug);
    if (!foundEvent) return;

    setEvent(foundEvent);
    const eventQuests = getQuestsForEvent(foundEvent.id);
    setQuests(eventQuests);

    const player = getCurrentPlayer();
    setCurrentPlayerState(player);

    const lb = getLeaderboardForEvent(foundEvent.id);
    setLeaderboard(lb);

    const pProgress = getPlayerProgress(player.id, foundEvent.id);
    setProgress(pProgress);
  }, [eventSlug]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  if (!event) {
    return (
      <div className="min-h-screen bg-[var(--bg-obsidian)] text-white flex flex-col justify-center items-center p-4">
        <h1 className="text-2xl font-bold mb-2">Event Not Found</h1>
        <p className="text-gray-400 text-sm mb-4">No active Canton event matching &quot;{eventSlug}&quot;.</p>
        <Link href="/" className="btn btn-primary text-sm">
          Return to City Hub
        </Link>
      </div>
    );
  }

  const filteredQuests = quests.filter((q) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'completed') return progress?.completedQuestIds.includes(q.id);
    if (selectedCategory === 'available') return !progress?.completedQuestIds.includes(q.id);
    if (selectedCategory === 'flash') return q.isFlash;
    return q.category === selectedCategory;
  });

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6">
        {/* Event Header Banner */}
        <div className="glass-panel p-5 md:p-6 mb-6 border-amber-500/30 glow-amber relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <span className="badge badge-medium bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              ● EVENT ACTIVE • CANTON, OH
            </span>
            <span className="text-xs font-mono text-amber-400 bg-amber-950/40 px-3 py-1 rounded-full border border-amber-800/40">
              ⏱️ Finale Countdown: 14h 22m
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-2">{event.title}</h1>
          <p className="text-xs sm:text-sm text-gray-300 mb-4 max-w-2xl leading-relaxed">
            {event.description}
          </p>

          {/* Quick Instructions Dropdown */}
          <div className="p-3 bg-obsidian/70 rounded-xl border border-gray-800 text-xs text-gray-300 font-mono">
            <span className="text-amber-400 font-bold block mb-1">🎮 GAME OBJECTIVE:</span>
            Visit quest locations around Canton, complete verification tasks, earn XP, and climb the leaderboard!
          </div>
        </div>

        {/* Player Identity Bar */}
        <PlayerIdentityBar onPlayerChanged={() => refreshData()} />

        {/* Player Progress Stat Bar */}
        {progress && currentPlayer && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="glass-card p-3 text-center border-amber-500/30">
              <span className="text-[10px] font-mono text-gray-400 uppercase block">Your Score</span>
              <span className="font-display font-extrabold text-2xl text-amber-400">
                {progress.totalPoints} <span className="text-xs text-amber-500">XP</span>
              </span>
            </div>

            <div className="glass-card p-3 text-center">
              <span className="text-[10px] font-mono text-gray-400 uppercase block">Completed</span>
              <span className="font-display font-extrabold text-2xl text-emerald-400">
                {progress.completedCount} / {progress.availableCount}
              </span>
            </div>

            <div className="glass-card p-3 text-center">
              <span className="text-[10px] font-mono text-gray-400 uppercase block">Leaderboard Rank</span>
              <span className="font-display font-extrabold text-2xl text-cyan-400">
                #{progress.rank}
              </span>
            </div>

            <div className="glass-card p-3 text-center">
              <span className="text-[10px] font-mono text-gray-400 uppercase block">Under Review</span>
              <span className="font-display font-extrabold text-2xl text-purple-400">
                {progress.pendingSubmissionQuestIds.length}
              </span>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] mb-6 font-display font-bold">
          <button
            onClick={() => setActiveTab('quests')}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${
              activeTab === 'quests'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🎯 Quests ({quests.length})
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${
              activeTab === 'leaderboard'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🏆 Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${
              activeTab === 'rules'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🛡️ Safety & Rules
          </button>
        </div>

        {/* TAB 1: QUESTS */}
        {activeTab === 'quests' && (
          <section className="space-y-4">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {[
                { id: 'all', label: 'All Quests' },
                { id: 'available', label: 'Available' },
                { id: 'completed', label: '✓ Completed' },
                { id: 'flash', label: '⚡ Flash' },
                { id: 'exploration', label: '🧭 Exploration' },
                { id: 'puzzle', label: '🧩 Puzzles' },
                { id: 'creative', label: '🎨 Creative' },
                { id: 'photo_video', label: '📸 Photo/Video' },
                { id: 'business_partner', label: '☕ Local Partners' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`text-xs px-3 py-1.5 rounded-full font-mono whitespace-nowrap border transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-amber-500 text-obsidian font-bold border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-card text-gray-300 border-gray-800 hover:border-gray-600'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Quests Grid */}
            {filteredQuests.length === 0 ? (
              <div className="glass-panel p-8 text-center text-gray-400 font-mono text-sm">
                No quests match the selected category filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredQuests.map((quest) => {
                  const isComp = progress?.completedQuestIds.includes(quest.id);
                  const isPend = progress?.pendingSubmissionQuestIds.includes(quest.id);
                  return (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      eventSlug={event.slug}
                      isCompleted={isComp}
                      isPending={isPend}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: LEADERBOARD */}
        {activeTab === 'leaderboard' && currentPlayer && (
          <section>
            <Leaderboard entries={leaderboard} currentPlayerId={currentPlayer.id} />
          </section>
        )}

        {/* TAB 3: SAFETY & RULES */}
        {activeTab === 'rules' && (
          <section className="glass-panel p-6 space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🛡️ Canton Quests Agent Safety & Conduct Rules
            </h2>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl text-red-300 font-mono text-xs">
                ⚠️ SAFETY FIRST DIRECTIVE: No quest, prize, or points value is worth injury or property damage. Obey all traffic laws and pedestrian signals.
              </div>
              <ul className="list-disc pl-5 space-y-2 text-xs font-mono text-gray-300">
                <li><strong className="text-white">Public Property Only:</strong> Stay within publicly accessible parks, sidewalks, plazas, or participating partner businesses.</li>
                <li><strong className="text-white">Crosswalk Compliance:</strong> Cross streets strictly within marked crosswalks.</li>
                <li><strong className="text-white">Respect Canton Merchants:</strong> Be courteous to local business owners and employees.</li>
                <li><strong className="text-white">No Physical Alteration:</strong> Never dig, climb structures over 3 feet, or tamper with city property.</li>
                <li><strong className="text-white">Original Submissions:</strong> Upload genuine photos and videos taken during active event hours.</li>
              </ul>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
