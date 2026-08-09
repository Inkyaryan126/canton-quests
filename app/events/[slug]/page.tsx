'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import PlayerIdentityBar from '@/components/PlayerIdentityBar';
import QuestCard from '@/components/QuestCard';
import Leaderboard from '@/components/Leaderboard';
import CantonMapWrapper from '@/components/CantonMapWrapper';
import TeamHub from '@/components/TeamHub';
import GameFeedbackModal from '@/components/GameFeedbackModal';
import {
  QuestEvent,
  Quest,
  Player,
  LeaderboardEntry,
  TeamLeaderboardEntry,
  PlayerEventProgress,
  Team,
  TeamMember,
} from '@/lib/types';
import {
  getEventBySlug,
  getQuestsForEvent,
  getCurrentPlayer,
  getLeaderboardForEvent,
  getTeamLeaderboardForEvent,
  getPlayerProgress,
  getTeamForPlayer,
} from '@/lib/game-engine';
import { calculateDistanceMeters, formatDistance } from '@/lib/geo';

export default function EventHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const eventSlug = resolvedParams.slug;

  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [currentPlayer, setCurrentPlayerState] = useState<Player | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<TeamLeaderboardEntry[]>([]);
  const [progress, setProgress] = useState<PlayerEventProgress | null>(null);
  const [team, setTeam] = useState<Team | undefined>(undefined);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Navigation & View Filters
  const [activeTab, setActiveTab] = useState<'quests' | 'map' | 'teams' | 'leaderboard' | 'rules'>('quests');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'nearest' | 'points'>('default');

  // User Geolocation State
  const [userLat, setUserLat] = useState<number | undefined>(undefined);
  const [userLon, setUserLon] = useState<number | undefined>(undefined);

  // Finale Countdown Timer
  const [finaleTimerStr, setFinaleTimerStr] = useState<string>('14h 22m');

  // Feedback Modal State
  const [feedback, setFeedback] = useState<any | null>(null);

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

    const teamLb = getTeamLeaderboardForEvent(foundEvent.id);
    setTeamLeaderboard(teamLb);

    const pProgress = getPlayerProgress(player.id, foundEvent.id);
    setProgress(pProgress);

    const teamInfo = getTeamForPlayer(player.id, foundEvent.id);
    setTeam(teamInfo.team);
    setTeamMembers(teamInfo.members);
  }, [eventSlug]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Geolocation Sensor
  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLon(pos.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  // Update Finale Timer
  useEffect(() => {
    if (!event || !event.endTime) return;
    const interval = setInterval(() => {
      const remainingMs = new Date(event.endTime!).getTime() - Date.now();
      if (remainingMs <= 0) {
        setFinaleTimerStr('EVENT ENDED');
      } else {
        const hrs = Math.floor(remainingMs / (1000 * 60 * 60));
        const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        setFinaleTimerStr(`${hrs}h ${mins}m`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [event]);

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

  // Active Flash Quests Filter
  const activeFlashQuests = quests.filter((q) => q.isFlash && q.status === 'active');

  // Filter and Sort Quests
  let filteredQuests = quests.filter((q) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'completed') return progress?.completedQuestIds.includes(q.id);
    if (selectedCategory === 'available') return !progress?.completedQuestIds.includes(q.id);
    if (selectedCategory === 'flash') return q.isFlash;
    return q.category === selectedCategory;
  });

  if (sortBy === 'points') {
    filteredQuests = [...filteredQuests].sort((a, b) => b.pointValue - a.pointValue);
  } else if (sortBy === 'nearest' && userLat !== undefined && userLon !== undefined) {
    filteredQuests = [...filteredQuests].sort((a, b) => {
      const distA =
        a.location?.latitude !== undefined && a.location?.longitude !== undefined
          ? calculateDistanceMeters(userLat, userLon, a.location.latitude, a.location.longitude)
          : 999999;
      const distB =
        b.location?.latitude !== undefined && b.location?.longitude !== undefined
          ? calculateDistanceMeters(userLat, userLon, b.location.latitude, b.location.longitude)
          : 999999;
      return distA - distB;
    });
  }

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6">
        {/* Event Header Banner */}
        <div className="glass-panel p-5 md:p-6 mb-6 border-amber-500/30 glow-amber relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <span className="badge badge-medium bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              ● LIVING GAME WORLD • CANTON, OH
            </span>
            <span className="text-xs font-mono text-amber-400 bg-amber-950/40 px-3 py-1 rounded-full border border-amber-800/40">
              ⏱️ Event Finale: {finaleTimerStr}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-2">{event.title}</h1>
          <p className="text-xs sm:text-sm text-gray-300 mb-4 max-w-2xl leading-relaxed">
            {event.description}
          </p>

          {/* Quick Objective Bar */}
          <div className="p-3 bg-obsidian/80 rounded-xl border border-gray-800 text-xs text-gray-300 font-mono flex flex-wrap items-center justify-between gap-2">
            <span>🎮 Use the Canton Map, GPS check-ins, QR emblems & squad play to conquer the city.</span>
            {userLat === undefined && (
              <button
                onClick={requestLocation}
                className="text-[11px] text-cyan-400 hover:underline font-bold"
              >
                📍 Enable GPS Proximity
              </button>
            )}
          </div>
        </div>

        {/* Live Flash Quest Pop-Up Alert Banner */}
        {activeFlashQuests.length > 0 && (
          <div className="p-4 bg-red-950/40 border-2 border-red-500/60 rounded-2xl mb-6 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚡</span>
              <div>
                <span className="text-[10px] font-mono uppercase text-red-400 font-bold tracking-widest block">
                  LIVE POP-UP FLASH QUEST ACTIVE
                </span>
                <h3 className="text-base font-extrabold text-white">
                  {activeFlashQuests[0].title} (+{activeFlashQuests[0].pointValue} XP)
                </h3>
              </div>
            </div>
            <Link
              href={`/events/${event.slug}/quests/${activeFlashQuests[0].id}`}
              className="btn btn-primary text-xs py-2 px-4 font-bold"
            >
              Hurry to Location →
            </Link>
          </div>
        )}

        {/* Player Identity Bar */}
        <PlayerIdentityBar onPlayerChanged={() => refreshData()} />

        {/* Player Progress Stat Bar */}
        {progress && currentPlayer && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="glass-card p-3 text-center border-amber-500/30">
              <span className="text-[10px] font-mono text-gray-400 uppercase block">Your XP Score</span>
              <span className="font-display font-extrabold text-2xl text-amber-400">
                {progress.totalPoints} <span className="text-xs text-amber-500">XP</span>
              </span>
            </div>

            <div className="glass-card p-3 text-center">
              <span className="text-[10px] font-mono text-gray-400 uppercase block">Quests Solved</span>
              <span className="font-display font-extrabold text-2xl text-emerald-400">
                {progress.completedCount} / {progress.availableCount}
              </span>
            </div>

            <div className="glass-card p-3 text-center">
              <span className="text-[10px] font-mono text-gray-400 uppercase block">Agent Rank</span>
              <span className="font-display font-extrabold text-2xl text-cyan-400">
                #{progress.rank}
              </span>
            </div>

            <div className="glass-card p-3 text-center">
              <span className="text-[10px] font-mono text-gray-400 uppercase block">Squad</span>
              <span className="font-display font-extrabold text-sm text-cyan-300 block truncate pt-1">
                {team ? team.name : 'Solo Agent'}
              </span>
            </div>
          </div>
        )}

        {/* Main Event Navigation Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] mb-6 font-display font-bold text-xs sm:text-sm overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('quests')}
            className={`flex-1 min-w-[100px] py-3 text-center border-b-2 transition-all ${
              activeTab === 'quests'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🎯 Quests ({quests.length})
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`flex-1 min-w-[100px] py-3 text-center border-b-2 transition-all ${
              activeTab === 'map'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🗺️ Canton Map
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex-1 min-w-[100px] py-3 text-center border-b-2 transition-all ${
              activeTab === 'teams'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            👥 Squads {team ? `(${team.name})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 min-w-[100px] py-3 text-center border-b-2 transition-all ${
              activeTab === 'leaderboard'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🏆 Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 min-w-[100px] py-3 text-center border-b-2 transition-all ${
              activeTab === 'rules'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🛡️ Safety & Rules
          </button>
        </div>

        {/* TAB 1: QUESTS LIST */}
        {activeTab === 'quests' && (
          <section className="space-y-4">
            {/* Sort & Filter Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-obsidian/70 p-3 rounded-2xl border border-gray-800">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'available', label: 'Available' },
                  { id: 'completed', label: '✓ Solved' },
                  { id: 'flash', label: '⚡ Flash' },
                  { id: 'exploration', label: '🧭 Exploration' },
                  { id: 'puzzle', label: '🧩 Puzzles' },
                  { id: 'creative', label: '🎨 Creative' },
                  { id: 'business_partner', label: '☕ Partners' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`text-[11px] px-3 py-1 rounded-full font-mono whitespace-nowrap border transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-amber-500 text-obsidian font-bold border-amber-400 shadow'
                        : 'bg-card text-gray-300 border-gray-800 hover:border-gray-600'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Sort dropdown */}
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-gray-400">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-card text-amber-400 border border-gray-800 rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option value="default">Default Order</option>
                  <option value="points">Highest XP</option>
                  {userLat !== undefined && <option value="nearest">Nearest Location</option>}
                </select>
              </div>
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

                  let distStr: string | undefined = undefined;
                  if (userLat !== undefined && userLon !== undefined && quest.location?.latitude && quest.location?.longitude) {
                    const distM = calculateDistanceMeters(userLat, userLon, quest.location.latitude, quest.location.longitude);
                    distStr = formatDistance(distM);
                  }

                  return (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      eventSlug={event.slug}
                      isCompleted={isComp}
                      isPending={isPend}
                      allQuests={quests}
                      completedQuestIds={progress?.completedQuestIds || []}
                      pendingQuestIds={progress?.pendingSubmissionQuestIds || []}
                      distanceStr={distStr}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: CANTON MAP */}
        {activeTab === 'map' && (
          <section className="space-y-4 animate-fade-in">
            <CantonMapWrapper
              quests={quests}
              eventSlug={event.slug}
              completedQuestIds={progress?.completedQuestIds}
              pendingQuestIds={progress?.pendingSubmissionQuestIds}
              userLat={userLat}
              userLon={userLon}
              onLocateMe={requestLocation}
            />
          </section>
        )}

        {/* TAB 3: SQUAD OPERATIONS */}
        {activeTab === 'teams' && currentPlayer && (
          <section className="animate-fade-in">
            <TeamHub
              eventId={event.id}
              currentPlayer={currentPlayer}
              team={team}
              teamMembers={teamMembers}
              onTeamUpdated={refreshData}
            />
          </section>
        )}

        {/* TAB 4: LEADERBOARD */}
        {activeTab === 'leaderboard' && currentPlayer && (
          <section className="animate-fade-in">
            <Leaderboard
              entries={leaderboard}
              teamEntries={teamLeaderboard}
              currentPlayerId={currentPlayer.id}
            />
          </section>
        )}

        {/* TAB 5: SAFETY & RULES */}
        {activeTab === 'rules' && (
          <section className="glass-panel p-6 space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🛡️ Canton Quests Real-World Field Guidelines
            </h2>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl text-red-300 font-mono text-xs">
                ⚠️ SAFETY FIRST DIRECTIVE: No quest or points value is worth injury or property damage. Stay on public sidewalks and observe traffic signals.
              </div>
              <ul className="list-disc pl-5 space-y-2 text-xs font-mono text-gray-300">
                <li><strong className="text-white">Public Access Hours:</strong> Observe park opening hours (Dawn to Dusk) and business hours. Never trespass on private property.</li>
                <li><strong className="text-white">Crosswalk Safety:</strong> Cross Canton streets strictly at marked crosswalks. Pay attention to vehicles.</li>
                <li><strong className="text-white">Local Merchant Courtesy:</strong> Show respect to Canton coffee shops, arcades, and historical landmarks.</li>
                <li><strong className="text-white">Zero Tampering:</strong> Do not climb monuments, tamper with plaques, or alter city property.</li>
              </ul>
            </div>
          </section>
        )}
      </main>

      {/* Game Celebration Modal */}
      <GameFeedbackModal feedback={feedback} onClose={() => setFeedback(null)} />
    </div>
  );
}
