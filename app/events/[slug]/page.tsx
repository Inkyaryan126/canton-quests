'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import PlayerIdentityBar from '@/components/PlayerIdentityBar';
import QuestCard from '@/components/QuestCard';
import Leaderboard from '@/components/Leaderboard';
import CantonMapWrapper from '@/components/CantonMapWrapper';
import GameFeedbackModal from '@/components/GameFeedbackModal';
import MobileStartBar from '@/components/MobileStartBar';
import CinematicFooter from '@/components/CinematicFooter';
import FounderCipherShell from '@/components/FounderCipherShell';
import {
  QuestEvent,
  PublicQuestView,
  Player,
  LeaderboardEntry,
  PlayerEventProgress,
  PlayerCollectible,
  NPCCharacter,
  EventParticipation,
  StartingPath,
} from '@/lib/types';
import { calculateDistanceMeters, formatDistance } from '@/lib/geo';
import { cleanQuestTitle, cqImages, formatEventWindow } from '@/lib/marketing-assets';
import {
  CANONICAL_LAUNCH_DATE_ISO,
  getOperationLifecycleStage,
  isKnownCantonLaunchSlug,
  isPreLaunchEvent,
} from '@/lib/launch-status';
import { showGameMoment } from '@/lib/game-effects';
import ThreePathSelector from '@/components/ThreePathSelector';

interface FeedbackState {
  type: 'quest_completed';
  title: string;
  message: string;
  pointsAwarded?: number;
  unlockedQuestTitle?: string;
}

type DashboardTab = 'quests' | 'map' | 'leaderboard' | 'collectibles' | 'rules';
const VALID_TABS: DashboardTab[] = ['quests', 'map', 'leaderboard', 'collectibles', 'rules'];

function getClientPlayer(): Player {
  const stored = window.localStorage.getItem('canton_quests_current_player');
  if (stored) return JSON.parse(stored) as Player;
  const player: Player = {
    id: `plr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    displayName: 'Canton Explorer',
    avatarUrl: '⚡',
    role: 'player',
    totalXp: 0,
    level: 1,
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem('canton_quests_current_player', JSON.stringify(player));
  return player;
}

function getEventCountdown(event: QuestEvent) {
  const now = Date.now();
  const start = event.startTime ? new Date(event.startTime).getTime() : null;
  const end = event.endTime ? new Date(event.endTime).getTime() : null;
  const target = start && now < start ? start : end;

  if (!target) {
    return {
      label: 'Quest time',
      value: 'Announcing soon',
      subtext: 'Full schedule will appear here.',
    };
  }

  const remainingMs = target - now;
  if (remainingMs <= 0) {
    return {
      label: 'Quest status',
      value: 'Quest complete',
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

function EventHubPageContent({ params }: { params: { slug: string } }) {
  const eventSlug = params.slug;
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab: DashboardTab = VALID_TABS.includes(requestedTab as DashboardTab) ? (requestedTab as DashboardTab) : 'quests';

  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [isPreLaunch, setIsPreLaunch] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [quests, setQuests] = useState<PublicQuestView[]>([]);
  const [currentPlayer, setCurrentPlayerState] = useState<Player | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [progress, setProgress] = useState<PlayerEventProgress | null>(null);

  // Phase 3 Live States
  const [collectibles, setCollectibles] = useState<PlayerCollectible[]>([]);
  const [npcs, setNpcs] = useState<NPCCharacter[]>([]);

  // Secret Passcode Input State
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeResult, setPasscodeResult] = useState<{ success: boolean; message: string } | null>(null);

  // Navigation & View Filters — initialized from ?tab= so a deep link like
  // /events/canton-weekend-1/quests (which redirects here with ?tab=quests)
  // lands on the right tab instead of always defaulting to Missions.
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'nearest' | 'points'>('default');

  // User Geolocation State
  const [userLat, setUserLat] = useState<number | undefined>(undefined);
  const [userLon, setUserLon] = useState<number | undefined>(undefined);

  // Feedback Modal State
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Operation Entry State — the permanent, authenticated player (never the
  // localStorage display-cache fallback) and their Operation participation
  // (event_players) record, per the Command Center reorganization.
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticatedPlayer, setAuthenticatedPlayer] = useState<Player | null>(null);
  const [participation, setParticipation] = useState<EventParticipation | null>(null);
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data: { isAuthenticated?: boolean; player?: Player }) => {
        setAuthenticatedPlayer(data.isAuthenticated && data.player ? data.player : null);
      })
      .catch(() => setAuthenticatedPlayer(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const enterOperation = useCallback(
    async (path?: StartingPath) => {
      setEntering(true);
      setEnterError(null);
      try {
        const res = await fetch(`/api/game/operations/${eventSlug}/enter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(path ? { path } : {}),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setEnterError(data.error || 'Unable to enter this Mission.');
          return;
        }
        setParticipation(data.participation);
      } catch {
        setEnterError('Unable to enter this Mission. Check your connection and try again.');
      } finally {
        setEntering(false);
      }
    },
    [eventSlug]
  );

  // Once the player's real authenticated identity is confirmed, silently
  // find-or-create their participation record for this Operation —
  // idempotent (never a duplicate event_players row), so a returning
  // participant never has to click through this again.
  useEffect(() => {
    if (authChecked && authenticatedPlayer && !participation && !entering) {
      enterOperation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, authenticatedPlayer]);

  const refreshData = useCallback(() => {
    const player = getClientPlayer();
    setCurrentPlayerState(player);

    fetch(`/api/game/events/${eventSlug}?playerId=${encodeURIComponent(player.id)}`)
      .then((res) => {
        if (!res.ok && res.status === 404) {
          if (isKnownCantonLaunchSlug(eventSlug)) {
            setIsPreLaunch(true);
          }
          return null;
        }
        return res.json();
      })
      .then((data: {
        event?: QuestEvent;
        quests?: PublicQuestView[];
        leaderboard?: LeaderboardEntry[];
        progress?: PlayerEventProgress;
        isPreLaunch?: boolean;
      } | null) => {
        setIsLoading(false);
        if (!data) return;
        if (data.isPreLaunch || isKnownCantonLaunchSlug(eventSlug)) {
          setIsPreLaunch(true);
        }
        if (data.event) {
          const loadedQuests = data.quests || [];
          setEvent(data.event);
          setQuests(loadedQuests);
          setLeaderboard(data.leaderboard || []);
          setProgress(data.progress || null);
          setCollectibles([]);
          setNpcs([]);

          // Check for active live Flash Quest Drop
          const activeFlash = loadedQuests.find((q) => q.isFlash && q.status === 'active');
          if (activeFlash && typeof window !== 'undefined') {
            const sessionKey = `cq_flash_seen_${activeFlash.id}`;
            if (!sessionStorage.getItem(sessionKey)) {
              sessionStorage.setItem(sessionKey, 'true');
              showGameMoment({
                type: 'flash-drop',
                questId: activeFlash.id,
                questTitle: activeFlash.title,
                pointValue: activeFlash.pointValue,
                district: activeFlash.location?.name || activeFlash.startingPath,
                questUrl: `/events/${eventSlug}/quests/${activeFlash.id}`,
              });
            }
          }
        }
      })
      .catch(() => {
        setIsLoading(false);
        if (isKnownCantonLaunchSlug(eventSlug)) {
          setIsPreLaunch(true);
        }
      });
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
  const handleRedeemPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !currentPlayer || !passcodeInput.trim()) return;

    const response = await fetch('/api/game/secret-code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: passcodeInput,
        playerId: currentPlayer.id,
        eventId: event.id,
      }),
    });
    const res = (await response.json()) as {
      success: boolean;
      message: string;
      pointsAwarded: number;
      collectibleAwarded?: { name: string };
    };
    setPasscodeResult(res);
    if (res.success) {
      setFeedback({
        type: 'quest_completed',
        title: '🔑 SECRET PASSCODE CRACKED!',
        message: res.message,
        pointsAwarded: res.pointsAwarded,
        unlockedQuestTitle: res.collectibleAwarded ? `Unlocked Collectible: ${res.collectibleAwarded.name}` : undefined,
      });
      setPasscodeInput('');
    }
    refreshData();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex flex-col justify-center items-center p-4 font-mono">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-400 border-t-transparent mb-4" />
        <p className="text-xs text-amber-300 tracking-wider uppercase">Loading Mission Grid...</p>
      </div>
    );
  }

  const isCipher = isKnownCantonLaunchSlug(eventSlug);
  const stage = getOperationLifecycleStage(event, eventSlug);
  const countdownValue = getEventCountdown(event || ({ startTime: CANONICAL_LAUNCH_DATE_ISO } as QuestEvent));

  if (!event || isPreLaunch || isPreLaunchEvent(event, eventSlug)) {
    // A real, known Operation (e.g. the Fair QR Hunt) that simply hasn't
    // started yet gets its own honest, event-aware "not started" screen —
    // never the hardcoded Sept 11 Main Operation copy below, which would
    // be factually wrong for any other Operation's launch date.
    if (event && !isCipher) {
      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
          <Header eventSlug={eventSlug} />
          <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:py-16 flex flex-col justify-center">
            <div className="relative overflow-hidden rounded-3xl border border-cyan-500/40 bg-stone-900/90 shadow-2xl p-6 sm:p-12 text-center">
              <Image
                src={cqImages.questBoardBg}
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 900px"
                className="object-cover opacity-20 pointer-events-none"
              />
              <div className="relative z-10 space-y-4 max-w-xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-mono font-bold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>MISSION UPCOMING</span>
                </div>

                <h1 className="font-display font-black text-2xl sm:text-4xl text-white uppercase tracking-tight">
                  {event.title}
                </h1>

                <p className="text-sm sm:text-base text-stone-300 leading-relaxed font-body">
                  This Mission opens {formatEventWindow(event)}. Check back then to enter it.
                </p>

                <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/"
                    className="cq-gold-button w-full sm:w-auto text-xs py-3 px-6 font-mono font-bold inline-flex items-center justify-center gap-2"
                  >
                    RETURN TO COMMAND CENTER →
                  </Link>
                  <Link
                    href="/leaderboard"
                    className="cq-dark-button w-full sm:w-auto text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2"
                  >
                    🏆 VIEW RANKINGS
                  </Link>
                </div>
              </div>
            </div>
          </main>
          <CinematicFooter />
        </div>
      );
    }

    if (isCipher) {
      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
          <Header eventSlug={eventSlug} />
          <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-12">
            <FounderCipherShell
              event={event}
              authenticatedPlayer={authenticatedPlayer}
              stage="upcoming"
              countdown={countdownValue}
            />
          </main>
          <CinematicFooter />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
        <Header eventSlug={eventSlug} />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-16 flex flex-col justify-center items-center text-center">
          <div className="p-8 rounded-3xl border border-stone-800 bg-stone-900/80 shadow-2xl w-full space-y-4">
            <div className="text-4xl">🔍</div>
            <h1 className="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-tight">
              EVENT NOT FOUND
            </h1>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              The requested event could not be found. Check the URL or return to the city hub to discover active Canton missions.
            </p>
            <div className="pt-2">
              <Link href="/" className="cq-gold-button w-full text-xs py-3 px-5 font-mono font-bold inline-flex items-center justify-center gap-2">
                RETURN TO CITY HUB →
              </Link>
            </div>
          </div>
        </main>
        <CinematicFooter />
      </div>
    );
  }

  // From here on, the Operation is live (active/finale/ended): event is
  // guaranteed non-null (the pre-launch/not-found branches above all
  // returned already). Gate content below is identical whether this is the
  // Founder's Cipher or the Fair QR Hunt — only the outer chrome (whether
  // it's wrapped in the persistent FounderCipherShell) differs by Operation.

  // GATE 1 — not a permanent, authenticated player yet. Preserve this
  // Operation as the intended return destination through Access Command
  // Center / Create Player Identity, exactly as the approved auth-return
  // architecture requires.
  if (authChecked && !authenticatedPlayer) {
    // Preserve the requested tab (from a canonical /events/{slug}/quests,
    // /map, etc. redirect) through login/register so a deep link doesn't
    // silently fall back to the default Missions tab after auth.
    const nextParam = encodeURIComponent(
      activeTab !== 'quests' ? `/events/${eventSlug}?tab=${activeTab}` : `/events/${eventSlug}`
    );
    const gateCard = (
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-stone-900/90 shadow-2xl p-8 sm:p-10 w-full space-y-4">
        <Image
          src={cqImages.questBoardBg}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 600px"
          className="object-cover opacity-15 pointer-events-none"
        />
        <div className="relative z-10 space-y-4">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Mission Access Required</span>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
            {event.title}
          </h1>
          <p className="text-sm text-stone-300 leading-relaxed font-body">
            {event.description || 'One permanent Canton Quests Player Identity gets you into every Mission.'}
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={`/register?next=${nextParam}`}
              className="cq-gold-button w-full sm:w-auto text-xs py-3 px-6 font-mono font-bold inline-flex items-center justify-center gap-2"
            >
              CREATE PLAYER IDENTITY
            </Link>
            <Link
              href={`/login?next=${nextParam}`}
              className="cq-dark-button w-full sm:w-auto text-xs py-3 px-6 font-mono font-bold inline-flex items-center justify-center gap-2"
            >
              ACCESS COMMAND CENTER
            </Link>
          </div>
        </div>
      </div>
    );

    if (isCipher) {
      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
          <Header eventSlug={eventSlug} />
          <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-12">
            <FounderCipherShell event={event} authenticatedPlayer={authenticatedPlayer} stage={stage} countdown={countdownValue}>
              <div className="max-w-lg mx-auto flex flex-col justify-center items-center text-center py-4">{gateCard}</div>
            </FounderCipherShell>
          </main>
          <CinematicFooter />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
        <Header eventSlug={eventSlug} />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-16 flex flex-col justify-center items-center text-center">
          {gateCard}
        </main>
        <CinematicFooter />
      </div>
    );
  }

  // GATE 2 — authenticated, but their Operation participation record hasn't
  // resolved yet (idempotent find-or-create in flight). Transient/sub-second
  // in practice, so it's intentionally left as a bare loading state rather
  // than wrapped in the full presentation shell for either Operation.
  if (authChecked && authenticatedPlayer && !participation) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex flex-col justify-center items-center p-4 font-mono">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-400 border-t-transparent mb-4" />
        <p className="text-xs text-amber-300 tracking-wider uppercase">Entering Mission...</p>
        {enterError && (
          <div className="mt-4 text-center space-y-3">
            <p className="text-xs text-red-400">{enterError}</p>
            <button type="button" onClick={() => enterOperation()} className="cq-gold-button text-xs py-2 px-5">
              RETRY
            </button>
          </div>
        )}
      </div>
    );
  }

  // GATE 3 — this Operation uses Family/Challenge/Secret and this player
  // hasn't chosen one for it yet. A returning participant with a path
  // already on their event_players record skips straight past this.
  if (event.requiresPath && participation && !participation.path) {
    const pathSelector = (
      <ThreePathSelector
        eventSlug={eventSlug}
        confirmOnly
        confirmPending={entering}
        confirmError={enterError}
        onConfirm={(path) => enterOperation(path)}
      />
    );

    if (isCipher) {
      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
          <Header eventSlug={eventSlug} />
          <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-12">
            <FounderCipherShell event={event} authenticatedPlayer={authenticatedPlayer} stage={stage} countdown={countdownValue}>
              {pathSelector}
            </FounderCipherShell>
          </main>
          <CinematicFooter />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
        <Header eventSlug={eventSlug} />
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-12">{pathSelector}</main>
        <CinematicFooter />
      </div>
    );
  }

  const activeFlashQuests = quests.filter((q) => q.isFlash && q.status === 'active');
  const activeNpc = npcs[0];
  const playerChosenPath = participation?.path || undefined;
  const pathQuests = quests.filter(
    (q) => q.startingPath === playerChosenPath && q.status === 'active' && !progress?.completedQuestIds.includes(q.id)
  );
  const uncompletedActive = quests.filter(
    (q) => q.status === 'active' && !progress?.completedQuestIds.includes(q.id)
  );

  const recommendedQuest =
    activeFlashQuests[0] ||
    pathQuests.sort((a, b) => b.pointValue - a.pointValue)[0] ||
    uncompletedActive.sort((a, b) => b.pointValue - a.pointValue)[0] ||
    quests[0];

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

  const dashboardCore = (
    <>
      {/* Quest Hero */}
      <section className="overflow-hidden border border-amber-500/30 bg-[#050607] shadow-2xl shadow-black/40 mb-6">
        <div className="grid gap-px bg-amber-500/25 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.78fr)]">
          <div className="bg-[#050607] p-5 md:p-8 flex flex-col justify-center min-h-[360px]">
            <span className="inline-flex mb-3 text-[11px] font-mono uppercase tracking-[0.22em] text-amber-300 font-extrabold">
              Current Canton Quest
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold text-white leading-[0.9] max-w-xl">
              {event.title.replace('Canton Quests: Volume 1 - ', '')}
            </h1>
            <p className="text-base text-gray-200 leading-relaxed mt-4 max-w-xl">
              A real-world adventure across Canton. Choose a mission, visit the location, submit proof, and earn XP.
            </p>

            <div className="grid gap-2 sm:grid-cols-3 mt-6">
              {[
                ['1', 'Create your callsign'],
                ['2', 'Choose a mission'],
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
                Choose a Mission
              </a>
              <button onClick={requestLocation} className="btn btn-secondary text-sm px-5 py-3 font-bold">
                Enable GPS
              </button>
            </div>
          </div>

          <aside className="grid bg-[#050607]">
            <figure className="bg-black aspect-[16/10] md:aspect-auto md:min-h-[360px] overflow-hidden">
              <Image
                src={cqImages.heroCity}
                alt="Players overlooking downtown Canton at sunset"
                priority
                sizes="(max-width: 768px) 100vw, 380px"
                className="h-full w-full object-cover"
              />
            </figure>
            <div className="bg-black/80 border-t border-amber-500/30 p-5">
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-300 font-extrabold">
                {countdownValue.label}
              </span>
              <strong className="block text-4xl font-display font-extrabold text-white mt-2">
                {countdownValue.value}
              </strong>
              <p className="text-xs text-gray-300 font-mono mt-2">{countdownValue.subtext}</p>
              <div className="h-px bg-amber-500/30 my-4" />
              <span className="block text-[10px] font-mono uppercase tracking-widest text-gray-400">
                Quest Dates
              </span>
              <p className="text-sm text-amber-200 font-bold mt-1">{formatEventWindow(event)}</p>
            </div>
          </aside>
        </div>
      </section>

      {/* Live Pop-Up Mission Alert Banner */}
      {activeFlashQuests.length > 0 && (
        <div className="p-4 bg-red-950/40 border-2 border-red-500/60 rounded-2xl mb-6 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚡</span>
            <div>
              <span className="text-[10px] font-mono uppercase text-red-400 font-bold tracking-widest block">
                LIVE POP-UP MISSION ACTIVE
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
            Go to Mission →
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
            placeholder="Enter your event passcode"
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
                  {progress?.totalPoints || 0} XP · {progress?.completedCount || 0} missions completed
                </p>
              </div>
              <a href="#quest-board" className="btn btn-secondary text-xs px-4 py-2 font-bold">
                Browse All Missions
              </a>
            </div>
          </div>

          <Link
            href={`/events/${event.slug}/quests/${recommendedQuest.id}`}
            className="glass-panel p-4 border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/15 transition-colors min-w-full md:min-w-[280px]"
          >
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
              Recommended next mission
            </span>
            <h3 className="text-lg font-extrabold text-white mt-1">{cleanQuestTitle(recommendedQuest.title)}</h3>
            <p className="text-xs text-gray-300 mt-1 line-clamp-2">{recommendedQuest.description}</p>
            <div className="mt-3 btn btn-primary text-xs py-2 px-4 w-full font-bold">
              Start This Mission →
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
            <span className="text-[10px] font-mono text-gray-400 uppercase block">Missions Solved</span>
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

      {/* Main Quest Navigation Tabs */}
      <div className="flex border-b border-[var(--border-subtle)] mb-6 font-display font-bold text-xs sm:text-sm overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('quests')}
          className={`flex-1 min-w-[90px] py-3 text-center border-b-2 transition-all ${
            activeTab === 'quests'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Missions ({quests.length})
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

          {/* Missions Grid */}
          {filteredQuests.length === 0 ? (
            <div className="glass-panel p-8 text-center text-gray-400 font-mono text-sm">
              No missions match the selected category filter.
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

      {/* TAB 3: LEADERBOARD */}
      {activeTab === 'leaderboard' && currentPlayer && (
        <section className="animate-fade-in">
          <Leaderboard
            entries={leaderboard}
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
              No collectibles discovered yet. Complete mission chains or redeem secret passcode drops.
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
              ⚠️ SAFETY FIRST DIRECTIVE: No mission or XP value is worth injury or property damage. Stay on public sidewalks and observe traffic signals.
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
    </>
  );

  const mobileStartBar = recommendedQuest && (
    <MobileStartBar
      href={`/events/${event.slug}/quests/${recommendedQuest.id}`}
      label="Start Quest"
      eyebrow="Recommended next"
    />
  );

  if (isCipher) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
        <Header eventSlug={eventSlug} />
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-12">
          <FounderCipherShell event={event} authenticatedPlayer={authenticatedPlayer} stage={stage} countdown={countdownValue}>
            <div className="max-w-4xl mx-auto">{dashboardCore}</div>
          </FounderCipherShell>
        </main>
        <CinematicFooter />
        <GameFeedbackModal feedback={feedback} onClose={() => setFeedback(null)} />
        {mobileStartBar}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col">
      <Header eventSlug={eventSlug} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6">{dashboardCore}</main>

      <GameFeedbackModal feedback={feedback} onClose={() => setFeedback(null)} />
      {mobileStartBar}
    </div>
  );
}

export default function EventHubPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={null}>
      <EventHubPageContent params={params} />
    </Suspense>
  );
}
