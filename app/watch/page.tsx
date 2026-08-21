'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import AudienceVoteCard from '@/components/spectator/AudienceVoteCard';
import HostBroadcastCard from '@/components/spectator/HostBroadcastCard';
import PublicGameFeed from '@/components/spectator/PublicGameFeed';
import DistrictActivityView, { DistrictInfo } from '@/components/spectator/DistrictActivityView';
import CommunityStatsBar from '@/components/spectator/CommunityStatsBar';
import EnterGameModal from '@/components/spectator/EnterGameModal';
import SectorMapWrapper from '@/components/SectorMapWrapper';
import {
  PublicAudienceEvent,
  PublicAudienceEventOption,
  HostBroadcast,
  PublicGameFeedItem,
  SpectatorSystemSettings,
} from '@/lib/types';
import { cqImages } from '@/lib/marketing-assets';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const VOTES_LOCAL_STORAGE_KEY = 'canton_spectator_voted_options';

export default function WatchPage() {
  // Data state
  const [events, setEvents] = useState<PublicAudienceEvent[]>([]);
  const [optionsMap, setOptionsMap] = useState<Record<string, PublicAudienceEventOption[]>>({});
  const [broadcasts, setBroadcasts] = useState<HostBroadcast[]>([]);
  const [feed, setFeed] = useState<PublicGameFeedItem[]>([]);
  const [settings, setSettings] = useState<SpectatorSystemSettings | null>(null);
  const [districts, setDistricts] = useState<DistrictInfo[]>([]);
  const [activeSpectatorCount, setActiveSpectatorCount] = useState<number>(0);
  const [parentEventStatus, setParentEventStatus] = useState<'upcoming' | 'active' | 'ended' | 'inactive'>('active');
  const [activeEventTitle, setActiveEventTitle] = useState<string>('Canton Quests: Volume 1 — The Founder\'s Cipher');

  // User session state
  const [votedOptions, setVotedOptions] = useState<Record<string, string>>({});
  const [isEnterGameModalOpen, setIsEnterGameModalOpen] = useState<boolean>(false);
  const [isMinorSession, setIsMinorSession] = useState<boolean>(false);
  const [convertedPlayerId, setConvertedPlayerId] = useState<string | null>(null);

  // Status & Network state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [isPollingActive, setIsPollingActive] = useState<boolean>(true);

  // Restore local vote history & register session on mount
  useEffect(() => {
    try {
      const savedVotes = localStorage.getItem(VOTES_LOCAL_STORAGE_KEY);
      if (savedVotes) {
        setVotedOptions(JSON.parse(savedVotes));
      }
      const localProfile = localStorage.getItem('canton_player_profile');
      if (localProfile) {
        const parsed = JSON.parse(localProfile);
        if (parsed.id) setConvertedPlayerId(parsed.id);
      }
    } catch {
      // LocalStorage fallback
    }

    // Register session on mount
    const registerSession = async () => {
      try {
        const res = await fetch('/api/game/spectator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'register_session' }),
        });
        const data = await res.json();
        if (data.success && data.session) {
          setIsMinorSession(!!data.session.isMinor);
          if (data.session.convertedToPlayerId) {
            setConvertedPlayerId(data.session.convertedToPlayerId);
          }
        }
      } catch {
        // Silently handle session reg error
      }
    };

    registerSession();
  }, []);

  // Fetch spectator data
  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, broadcastsRes, feedRes, settingsRes, districtsRes, statsRes, mainEventRes] = await Promise.all([
        fetch('/api/game/spectator?action=events'),
        fetch('/api/game/spectator?action=broadcasts'),
        fetch('/api/game/spectator?action=feed'),
        fetch('/api/game/spectator?action=settings'),
        fetch('/api/game/spectator?action=districts'),
        fetch('/api/game/spectator?action=stats'),
        fetch('/api/game/events').catch(() => null),
      ]);

      const eventsData = await eventsRes.json();
      const broadcastsData = await broadcastsRes.json();
      const feedData = await feedRes.json();
      const settingsData = await settingsRes.json();
      const districtsData = await districtsRes.json();
      const statsData = await statsRes.json();

      if (eventsData.success) {
        const activeEvents: PublicAudienceEvent[] = eventsData.events || [];
        setEvents(activeEvents);

        // Fetch options for each audience event
        for (const evt of activeEvents) {
          const optRes = await fetch(`/api/game/spectator?action=options&audienceEventId=${evt.id}`);
          const optData = await optRes.json();
          if (optData.success) {
            setOptionsMap((prev) => ({
              ...prev,
              [evt.id]: optData.options || [],
            }));
          }
        }
      }

      if (broadcastsData.success) {
        setBroadcasts(broadcastsData.broadcasts || []);
      }

      if (feedData.success) {
        setFeed(feedData.feed || []);
      }

      if (settingsData.success) {
        setSettings(settingsData.settings || null);
      }

      if (districtsData.success) {
        setDistricts(districtsData.districts || []);
      }

      if (statsData.success) {
        setActiveSpectatorCount(statsData.activeSpectators || 0);
      }

      if (mainEventRes) {
        const mainEventData = await mainEventRes.json().catch(() => null);
        if (mainEventData?.events && mainEventData.events.length > 0) {
          const eventItem = mainEventData.events[0];
          if (eventItem.title) setActiveEventTitle(eventItem.title);
          const status = eventItem.status;
          if (status === 'draft') setParentEventStatus('upcoming');
          else if (status === 'completed' || status === 'archived') setParentEventStatus('ended');
          else setParentEventStatus('active');
        } else if (mainEventData?.events && mainEventData.events.length === 0) {
          setParentEventStatus('inactive');
        }
      }

      setNetworkError(null);
    } catch (err: any) {
      setNetworkError('Network connectivity issue. Polling automatic recovery active...');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and 5s polling interval
  useEffect(() => {
    fetchData();

    if (!isPollingActive) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData, isPollingActive]);

  // Active audience event (priority: voting_active, then tallying_closed/effect_applied/resolved)
  const activeEvent =
    events.find((e) => e.status === 'voting_active') ||
    events.find((e) => ['tallying_closed', 'effect_applied', 'resolved'].includes(e.status)) ||
    null;

  const currentOptions = activeEvent ? optionsMap[activeEvent.id] || [] : [];
  const currentVotedOptionId = activeEvent ? votedOptions[activeEvent.id] || null : null;

  // Handle Spectator Vote Submission
  const handleVoteSubmission = async (optionId: string): Promise<{ success: boolean; error?: string; code?: string }> => {
    if (!activeEvent) return { success: false, error: 'No active event' };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.access_token) {
            headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
          }
        } catch {
          // ignore
        }
      } else {
        const localProfile = localStorage.getItem('canton_quests_current_player') || localStorage.getItem('canton_player_profile');
        if (localProfile) {
          const player = JSON.parse(localProfile) as { id?: string };
          if (player.id) headers['x-player-token'] = player.id;
        }
      }

      const res = await fetch('/api/game/spectator', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          audienceEventId: activeEvent.id,
          optionId,
          eventId: activeEvent.eventId || 'default-event',
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Record vote locally
        const updatedVotes = { ...votedOptions, [activeEvent.id]: optionId };
        setVotedOptions(updatedVotes);
        try {
          localStorage.setItem(VOTES_LOCAL_STORAGE_KEY, JSON.stringify(updatedVotes));
        } catch {
          // ignore
        }

        // Re-fetch data to reflect updated vote tallies
        fetchData();
        return { success: true };
      }

      return {
        success: false,
        error: data.error,
        code: data.code,
      };
    } catch (err: any) {
      return {
        success: false,
        error: 'Network failure submitting vote',
      };
    }
  };

  // Session Update from Age & Safety Gate Modal
  const handleSessionUpdate = async (params: {
    ageAcknowledged: boolean;
    safetyAcknowledged: boolean;
    isMinor?: boolean;
  }) => {
    const res = await fetch('/api/game/spectator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'register_session',
        ...params,
      }),
    });
    const data = await res.json();
    if (data.success && data.session) {
      setIsMinorSession(!!data.session.isMinor);
      if (data.session.convertedToPlayerId) {
        setConvertedPlayerId(data.session.convertedToPlayerId);
      }
    }
  };

  const isSystemDisabled = !!settings?.isSpectatorSystemDisabled;
  const totalVotesCast = currentOptions.reduce((sum, opt) => sum + (opt.voteCount || 0), 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col font-mono text-xs">
        <Header />
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6 flex flex-col items-center justify-center min-h-[65vh]">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-center space-y-1">
            <h2 className="text-sm font-extrabold text-white font-mono uppercase tracking-wider">
              📡 CONNECTING TO DOWNTOWN CANTON WATCH AIRWAVES...
            </h2>
            <p className="text-xs text-gray-400">Synchronizing live feed, broadcasts, and audience voting channels</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col font-mono text-xs pb-20">
      <Header />

      {/* Watch Mode Banner Header */}
      <div className="bg-[#121824] border-b border-gray-800 py-3 px-4 sticky top-[61px] z-30 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <div>
              <span className="font-extrabold text-sm text-white tracking-wider font-display uppercase block">
                CANTON QUESTS • SPECTATOR WATCH
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">
                Live Citywide Game Show Airwaves
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {networkError ? (
              <span className="px-2.5 py-1 bg-red-950/80 text-red-300 border border-red-500/50 rounded-lg text-[10px] font-mono">
                ⚠️ RECONNECTING...
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 rounded-lg text-[10px] font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                LIVE SYNC
              </span>
            )}

            {isMinorSession && (
              <span className="px-2.5 py-1 bg-purple-950/80 text-purple-300 border border-purple-500/50 rounded-lg text-[10px] font-mono">
                🛡️ MINOR PROTECTED
              </span>
            )}

            {convertedPlayerId ? (
              <span className="px-2.5 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 rounded-lg text-[10px] font-mono font-bold">
                ⚡ AGENT CONVERTED ({convertedPlayerId})
              </span>
            ) : (
              <button
                onClick={() => setIsEnterGameModalOpen(true)}
                className="btn btn-primary text-xs py-1.5 px-3 font-mono font-bold flex items-center gap-1 text-amber-400 bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20"
              >
                🎮 ENTER THE GAME →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Parent Event Status Banner Frame */}
        {parentEventStatus === 'inactive' && (
          <div className="relative overflow-hidden p-6 md:p-10 bg-stone-950 border border-amber-500/30 rounded-3xl space-y-4 text-center shadow-2xl">
            <Image
              src={cqImages.gmTransmissionBg}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 900px"
              className="object-cover opacity-20 pointer-events-none"
            />
            <div className="relative z-10 space-y-4">
              <div className="text-4xl">🌙</div>
              <span className="inline-block px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full text-xs font-mono text-amber-300 font-bold uppercase tracking-wider">
                AIRWAVES STANDING BY
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight font-display">
                THE CITY IS QUIET — FOR NOW.
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 max-w-lg mx-auto leading-relaxed font-body">
                Canton Quests airwaves activate during live weekend events and pop-up flash missions. Browse available missions, check the leaderboards, or review the rulebook to prepare for the next drop.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link href="/quests" className="cq-gold-button text-xs py-2.5 px-4 font-mono font-bold inline-flex items-center gap-1.5">
                  🗺️ EXPLORE MISSIONS →
                </Link>
                <Link href="/how-it-works" className="cq-dark-button text-xs py-2.5 px-4 font-mono">
                  📖 HOW IT WORKS
                </Link>
                <Link href="/leaderboard" className="cq-dark-button text-xs py-2.5 px-4 font-mono">
                  🏆 LEADERBOARD
                </Link>
              </div>
            </div>
          </div>
        )}

        {parentEventStatus === 'upcoming' && (
          <div className="relative overflow-hidden p-6 sm:p-8 bg-stone-950 border-2 border-amber-500/40 rounded-3xl space-y-3 shadow-2xl">
            <Image
              src={cqImages.gmTransmissionBg}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 900px"
              className="object-cover opacity-20 pointer-events-none"
            />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  LIVE SIGNAL OFFLINE • BROADCAST BEGINS SEPTEMBER 11
                </span>
                <span className="text-xs text-stone-400 font-mono">Kickoff: September 11, 2026</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-display uppercase tracking-tight">
                Canton Quests Airwaves Standing By
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-body max-w-2xl">
                The live citywide spectator broadcast and Game Master airwaves activate on September 11, 2026. Live field tickers, flash drop transmissions, and audience voting will stream in real time during event hours.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link href="/" className="cq-gold-button text-xs py-2.5 px-4 font-mono font-bold">
                  RETURN TO CITY HUB →
                </Link>
                <Link href="/how-it-works" className="cq-dark-button text-xs py-2.5 px-4 font-mono">
                  📖 HOW IT WORKS
                </Link>
              </div>
            </div>
          </div>
        )}

        {parentEventStatus === 'ended' && (
          <div className="p-5 bg-purple-950/40 border-2 border-purple-500/50 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="badge badge-medium bg-purple-500/20 text-purple-300 font-mono font-bold uppercase">
                🏆 EVENT CONCLUDED
              </span>
              <span className="text-xs text-gray-400 font-mono font-bold">FINAL RESULTS ARCHIVED</span>
            </div>
            <h2 className="text-lg font-bold text-white">{activeEventTitle} Has Ended</h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              Field operations for this volume are complete. Final spectator vote outcomes and public activity records are archived below.
            </p>
          </div>
        )}

        {/* System Freeze Banner */}
        {isSystemDisabled && (
          <div className="p-4 bg-red-950/90 border-2 border-red-500 rounded-2xl text-red-200 space-y-1 animate-pulse shadow-lg shadow-red-950/50">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span>⛔ GAME MASTER EMERGENCY SYSTEM FREEZE</span>
            </div>
            <p className="text-xs text-red-300 leading-relaxed">
              {settings?.disabledReason || 'Spectator voting and live commands have been temporarily paused by the Game Master.'}
            </p>
          </div>
        )}

        {/* Network Error Alert */}
        {networkError && (
          <div className="p-3.5 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 flex items-center justify-between gap-3 font-mono">
            <span>{networkError}</span>
            <button
              onClick={fetchData}
              className="btn btn-secondary text-[11px] py-1 px-3"
            >
              🔄 Retry Now
            </button>
          </div>
        )}

        {/* Returning Spectator Session Alert */}
        {convertedPlayerId && (
          <div className="p-3.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-300 flex items-center justify-between gap-3 font-mono">
            <span>⚡ Welcome back! Your spectator session is linked to Agent Profile ({convertedPlayerId}).</span>
            <Link href="/quests" className="btn btn-primary text-[11px] py-1 px-3 font-bold">
              🚀 PLAY NOW →
            </Link>
          </div>
        )}

        {/* Community Stats Bar */}
        <CommunityStatsBar
          totalVotes={totalVotesCast}
          activeSpectatorCount={activeSpectatorCount}
          activeDistrictCount={districts.length || 4}
          feedCount={feed.length}
        />

        {/* Host Broadcasts */}
        <HostBroadcastCard broadcasts={broadcasts} />

        {/* Active Audience Vote Card */}
        <AudienceVoteCard
          event={activeEvent}
          options={currentOptions}
          votedOptionId={currentVotedOptionId}
          onVoteSubmitted={handleVoteSubmission}
          isSystemDisabled={isSystemDisabled}
        />

        {/* Canton Citywide Live Sector Map & Telemetry HUD */}
        <SectorMapWrapper />

        {/* Canton Citywide District Activity View */}
        <DistrictActivityView districts={districts} />

        {/* Sanitized Public Field Feed */}
        <PublicGameFeed feed={feed} />
      </main>

      {/* Floating Sticky Conversion Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0b0f17]/95 border-t border-amber-500/40 p-3 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {convertedPlayerId ? (
            <>
              <div>
                <span className="font-extrabold text-white text-xs block">
                  AGENT PROFILE LINKED ({convertedPlayerId})
                </span>
                <span className="text-[10px] text-emerald-400 font-mono hidden sm:block">
                  Your spectator session is converted. Ready to complete field quests in Canton.
                </span>
              </div>

              <Link
                href="/quests"
                className="btn btn-primary text-xs py-2 px-4 font-mono font-bold flex items-center gap-2 hover:scale-[1.02] transition-transform whitespace-nowrap"
              >
                🎮 RETURN TO GAME →
              </Link>
            </>
          ) : (
            <>
              <div>
                <span className="font-extrabold text-white text-xs block">
                  READY TO JOIN DOWNTOWN CANTON FIELD OPS?
                </span>
                <span className="text-[10px] text-gray-400 font-mono hidden sm:block">
                  Convert your spectator session into an active agent profile in 1 tap.
                </span>
              </div>

              <button
                onClick={() => setIsEnterGameModalOpen(true)}
                className="btn btn-primary text-xs py-2 px-4 font-mono font-bold flex items-center gap-2 hover:scale-[1.02] transition-transform whitespace-nowrap"
              >
                🚀 ENTER THE GAME NOW →
              </button>
            </>
          )}
        </div>
      </div>

      {/* Age & Safety Onboarding Modal */}
      <EnterGameModal
        isOpen={isEnterGameModalOpen}
        onClose={() => setIsEnterGameModalOpen(false)}
        onSessionUpdate={handleSessionUpdate}
      />
    </div>
  );
}
