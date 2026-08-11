'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import PlayerIdentityBar from '@/components/PlayerIdentityBar';
import QuestCard from '@/components/QuestCard';
import Leaderboard from '@/components/Leaderboard';
import CantonMapWrapper from '@/components/CantonMapWrapper';
import TeamHub from '@/components/TeamHub';
import GameFeedbackModal from '@/components/GameFeedbackModal';
import MobileStartBar from '@/components/MobileStartBar';
import {
  QuestEvent,
  Quest,
  Player,
  LeaderboardEntry,
  TeamLeaderboardEntry,
  PlayerEventProgress,
  Team,
  TeamMember,
  LiveAnnouncement,
  PlayerCollectible,
  NPCCharacter,
} from '@/lib/types';
import {
  getEventBySlug,
  getQuestsForEvent,
  getCurrentPlayer,
  getLeaderboardForEvent,
  getTeamLeaderboardForEvent,
  getPlayerProgress,
  getTeamForPlayer,
  getAnnouncements,
  redeemSecretCode,
  getCollectiblesForPlayer,
  getNPCCharacters,
} from '@/lib/game-engine';
import { calculateDistanceMeters, formatDistance } from '@/lib/geo';
import { cleanQuestTitle, cqImages, formatEventWindow } from '@/lib/marketing-assets';

function getEventCountdown(event: QuestEvent) {
  const now = Date.now();
  const start = event.startTime ? new Date(event.startTime).getTime() : null;
  const end = event.endTime ? new Date(event.endTime).getTime() : null;
  const target = start && now < start ? start : end;

  if (!target) {
    return {
      label: 'Event time',
      value: 'Announcing soon',
      subtext: 'Full schedule will appear here.',
    };
  }

  const remainingMs = target - now;
  if (remainingMs <= 0) {
    return {
      label: 'Event status',
      value: 'Event complete',
      subtext: 'Final results are being wrapped.',
    };
  }

  const totalMinutes = Math.floor(remainingMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return {
    label: start && now < start ? 'Starts in' : 'Ends in',
    value: `${days}d ${hours}h ${minutes}m`,
    subtext: start && now < start ? 'Get your callsign ready.' : 'Keep earning XP before the finale.',
  };
}

export default function EventHubPage({ params }: { params: { slug: string } }) {
  const eventSlug = params.slug;

  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [currentPlayer, setCurrentPlayerState] = useState<Player | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<TeamLeaderboardEntry[]>([]);
  const [progress, setProgress] = useState<PlayerEventProgress | null>(null);
  const [team, setTeam] = useState<Team | undefined>(undefined);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Phase 3 Live States
  const [announcements, setAnnouncements] = useState<LiveAnnouncement[]>([]);
  const [collectibles, setCollectibles] = useState<PlayerCollectible[]>([]);
  const [npcs, setNpcs] = useState<NPCCharacter[]>([]);

  // Secret Passcode Input State
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeResult, setPasscodeResult] = useState<{ success: boolean; message: string } | null>(null);

  // Navigation & View Filters
  const [activeTab, setActiveTab] = useState<'quests' | 'map' | 'teams' | 'leaderboard' | 'collectibles' | 'rules'>('quests');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'nearest' | 'points'>('default');

  // User Geolocation State
  const [userLat, setUserLat] = useState<number | undefined>(undefined);
  const [userLon, setUserLon] = useState<number | undefined>(undefined);

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

    // Phase 3 Live Data
    setAnnouncements(getAnnouncements(foundEvent.id));
    setCollectibles(getCollectiblesForPlayer(player.id));
    setNpcs(getNPCCharacters(foundEvent.id));
  }, [eventSlug]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 6000);
    return () => clearInterval(interval);
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

  // Handle Passcode Redemption
  const handleRedeemPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !currentPlayer || !passcodeInput.trim()) return;

    const res = redeemSecretCode(passcodeInput, currentPlayer.id, event.id);
    setPasscodeResult(res);
    if (res.success) {
      setFeedback({
        title: '🔑 SECRET PASSCODE CRACKED!',
        points: res.pointsAwarded,
        unlockedQuestTitle: res.collectibleAwarded ? `Unlocked Collectible: ${res.collectibleAwarded.name}` : undefined,
      });
      setPasscodeInput('');
    }
    refreshData();
  };

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

  const activeFlashQuests = quests.filter((q) => q.isFlash && q.status === 'active');
  const latestAnnouncement = announcements[0];
  const activeNpc = npcs[0];
  const recommendedQuest =
    activeFlashQuests[0] ||
    quests
      .filter((quest) => quest.status === 'active' && !progress?.completedQuestIds.includes(quest.id))
      .sort((a, b) => b.pointValue - a.pointValue)[0] ||
    quests[0];
  const countdown = getEventCountdown(event);

  let filteredQuests = quests.filter((q) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'available') return !progress?.completedQuestIds.includes(q.id);
    if (selectedCategory === 'completed') return progress?.completedQuestIds.includes(q.id);
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
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col pb-24 md:pb-0">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6">
        {/* LIVE TICKER ANNOUNCEMENT BANNER */}
        {latestAnnouncement && (
          <div
            className={`p-3.5 rounded-2xl mb-4 text-xs font-mono border flex items-center justify-between gap-3 shadow-lg ${
              latestAnnouncement.urgency === 'flash' || latestAnnouncement.urgency === 'urgent'
                ? 'bg-red-950/70 border-red-500 text-red-200 animate-pulse'
                : latestAnnouncement.urgency === 'warning'
                ? 'bg-amber-950/70 border-amber-500 text-amber-200'
                : 'bg-cyan-950/70 border-cyan-500 text-cyan-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">📢</span>
              <div>
                <span className="font-bold uppercase tracking-wider block">{latestAnnouncement.title}</span>
                <span className="text-[11px] opacity-90">{latestAnnouncement.message}</span>
              </div>
            </div>
            {latestAnnouncement.linkedQuestId && (
              <Link
                href={`/events/${event.slug}/quests/${latestAnnouncement.linkedQuestId}`}
                className="btn btn-primary text-[11px] py-1 px-3 whitespace-nowrap font-bold"
              >
                Inspect Quest →
              </Link>
            )}
          </div>
        )}

        {/* Event Hero */}
        <section className="relative overflow-hidden border border-amber-500/30 bg-[#050607] shadow-2xl shadow-black/40 mb-6">
          <div className="absolute inset-0">
            <Image
              src={cqImages.heroCity}
              alt="Players overlooking downtown Canton at sunset"
              fill
              priority
              sizes="(max-width: 896px) 100vw, 896px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050607] via-[#050607]/82 to-[#050607]/38" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050607] via-transparent to-[#050607]/25" />
          </div>

          <div className="relative z-10 grid gap-6 md:grid-cols-[1fr_260px] p-5 md:p-8 min-h-[520px] items-end">
            <div>
              <span className="inline-flex mb-3 text-[11px] font-mono uppercase tracking-[0.22em] text-amber-300 font-extrabold">
                Canton Quest Weekend
              </span>
              <h1 className="text-4xl sm:text-6xl font-extrabold text-white leading-[0.9] max-w-xl">
                {event.title.replace('Canton Quest Weekend #1 — ', '')}
              </h1>
              <p className="text-base text-gray-200 leading-relaxed mt-4 max-w-xl">
                A real-world adventure across Canton. Pick a quest, visit the location, complete the mission, and earn XP.
              </p>

              <div className="grid gap-2 sm:grid-cols-3 mt-6">
                {[
                  ['1', 'Create your callsign'],
                  ['2', 'Choose a quest'],
                  ['3', 'Submit proof'],
                ].map(([step, label]) => (
                  <div key={step} className="bg-black/55 border border-amber-500/25 p-3">
                    <span className="text-amber-300 font-display font-extrabold text-xl">{step}</span>
                    <strong className="block text-white text-sm mt-1">{label}</strong>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                <a href="#quest-board" className="btn btn-primary text-sm px-5 py-3 font-bold">
                  Choose a Quest
                </a>
                <button onClick={requestLocation} className="btn btn-secondary text-sm px-5 py-3 font-bold">
                  Enable GPS
                </button>
              </div>
            </div>

            <div className="bg-black/70 border border-amber-500/40 p-5 shadow-xl shadow-black/35">
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-300 font-extrabold">
                {countdown.label}
              </span>
              <strong className="block text-4xl font-display font-extrabold text-white mt-2">
                {countdown.value}
              </strong>
              <p className="text-xs text-gray-300 font-mono mt-2">{countdown.subtext}</p>
              <div className="h-px bg-amber-500/30 my-4" />
              <span className="block text-[10px] font-mono uppercase tracking-widest text-gray-400">
                Event Window
              </span>
              <p className="text-sm text-amber-200 font-bold mt-1">{formatEventWindow(event)}</p>
            </div>
          </div>
        </section>

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

        {/* Live Clue Card */}
        {activeNpc && activeNpc.isActive && (
          <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-2xl mb-6 text-xs font-mono space-y-1 shadow">
            <div className="flex items-center justify-between text-emerald-300 font-bold">
              <span className="flex items-center gap-1.5">
                {activeNpc.avatarSymbol} Live clue nearby: {activeNpc.aliasName}
              </span>
              <span className="text-[10px] text-gray-400 uppercase">Optional hint</span>
            </div>
            <div className="text-gray-300">
              Area: <span className="text-white font-bold">{activeNpc.currentZone}</span>
            </div>
            <div className="text-emerald-400 text-[11px]">Clue: &quot;{activeNpc.clueHint}&quot;</div>
          </div>
        )}

        {/* Secret Code Bar */}
        <div className="p-4 bg-cyan-950/30 border border-cyan-500/40 rounded-2xl mb-6 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-white font-bold text-xs flex items-center gap-1.5">
              Have a secret code?
            </span>
            <span className="text-[10px] text-cyan-400">Enter it here for bonus XP</span>
          </div>

          <form onSubmit={handleRedeemPasscode} className="flex gap-2">
            <input
              type="text"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. FOUNDER2026 or COURIER77"
              className="input-field text-xs uppercase tracking-wider font-bold flex-1"
            />
            <button type="submit" className="btn btn-cyan text-xs py-2 px-4 whitespace-nowrap font-bold">
              REDEEM
            </button>
          </form>

          {passcodeResult && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold ${
                passcodeResult.success
                  ? 'bg-emerald-950/60 border border-emerald-500 text-emerald-300'
                  : 'bg-amber-950/60 border border-amber-500 text-amber-300'
              }`}
            >
              {passcodeResult.message}
            </div>
          )}
        </div>

        {/* Player Identity Bar */}
        <PlayerIdentityBar onPlayerChanged={() => refreshData()} />

        {/* Start Here Panel */}
        {currentPlayer && recommendedQuest && (
          <section className="grid gap-3 md:grid-cols-[1fr_auto] items-stretch mb-6">
            <div className="glass-panel p-4 border-amber-500/40 bg-amber-950/10">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                You are playing as
              </span>
              <div className="flex flex-wrap items-end justify-between gap-3 mt-1">
                <div>
                  <h2 className="text-2xl font-extrabold text-white">{currentPlayer.displayName}</h2>
                  <p className="text-xs text-gray-300 font-mono">
                    {progress?.totalPoints || 0} XP · {progress?.completedCount || 0} quests completed
                  </p>
                </div>
                <Link href="/quests" className="btn btn-secondary text-xs px-4 py-2 font-bold">
                  Browse All Quests
                </Link>
              </div>
            </div>

            <Link
              href={`/events/${event.slug}/quests/${recommendedQuest.id}`}
              className="glass-panel p-4 border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/15 transition-colors min-w-full md:min-w-[280px]"
            >
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                Recommended next quest
              </span>
              <h3 className="text-lg font-extrabold text-white mt-1">{cleanQuestTitle(recommendedQuest.title)}</h3>
              <p className="text-xs text-gray-300 mt-1 line-clamp-2">{recommendedQuest.description}</p>
              <div className="mt-3 btn btn-primary text-xs py-2 px-4 w-full font-bold">
                Start This Quest →
              </div>
            </Link>
          </section>
        )}

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
              <span className="text-[10px] font-mono text-gray-400 uppercase block">Finale Status</span>
              <span className="font-display font-extrabold text-xs text-purple-300 block truncate pt-1 uppercase">
                {progress.isQualifiedForFinale ? '🏆 QUALIFIED' : 'PENDING'}
              </span>
            </div>
          </div>
        )}

        {/* Main Event Navigation Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] mb-6 font-display font-bold text-xs sm:text-sm overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('quests')}
            className={`flex-1 min-w-[90px] py-3 text-center border-b-2 transition-all ${
              activeTab === 'quests'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Quests ({quests.length})
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`flex-1 min-w-[90px] py-3 text-center border-b-2 transition-all ${
              activeTab === 'map'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex-1 min-w-[90px] py-3 text-center border-b-2 transition-all ${
              activeTab === 'teams'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Team
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 min-w-[90px] py-3 text-center border-b-2 transition-all ${
              activeTab === 'leaderboard'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Scores
          </button>
          <button
            onClick={() => setActiveTab('collectibles')}
            className={`flex-1 min-w-[90px] py-3 text-center border-b-2 transition-all ${
              activeTab === 'collectibles'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Rewards ({collectibles.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 min-w-[90px] py-3 text-center border-b-2 transition-all ${
              activeTab === 'rules'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Safety
          </button>
        </div>

        {/* TAB 1: QUESTS LIST */}
        {activeTab === 'quests' && (
          <section id="quest-board" className="space-y-4 scroll-mt-24">
            {/* Sort & Filter Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-obsidian/70 p-3 rounded-2xl border border-gray-800">
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

        {/* TAB 5: PLAYER COLLECTIBLES */}
        {activeTab === 'collectibles' && (
          <section className="glass-panel p-6 space-y-4 font-mono animate-fade-in">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                🏅 Agent Digital Collectibles Vault ({collectibles.length})
              </h2>
              <span className="text-xs text-amber-400">Phase 3 Cipher Collection</span>
            </div>

            {collectibles.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                No collectibles discovered yet! Complete quest chains or redeem secret passcode drops.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {collectibles.map((pc) => (
                  <div
                    key={pc.id}
                    className="p-3 bg-obsidian border border-amber-500/30 rounded-xl flex items-center gap-3"
                  >
                    <span className="text-3xl">{pc.collectible?.badgeSymbol || '🏅'}</span>
                    <div>
                      <span className="text-white font-bold text-xs block">{pc.collectible?.name}</span>
                      <span className="text-gray-400 text-[11px] block">{pc.collectible?.description}</span>
                      <span className="text-amber-400 text-[10px] uppercase block pt-0.5">
                        Source: {pc.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 6: SAFETY & RULES */}
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
      {recommendedQuest && (
        <MobileStartBar
          href={`/events/${event.slug}/quests/${recommendedQuest.id}`}
          label="Start Quest"
          eyebrow="Recommended next"
        />
      )}
    </div>
  );
}
