'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import {
  QuestEvent,
  Quest,
  QuestSubmission,
  EventPhaseType,
  LiveAnnouncement,
  SecretCode,
  NPCCharacter,
  CrowdObjective,
  BonusWindow,
  LeaderboardEntry,
  TeamLeaderboardEntry,
  EventActivityItem,
  Player,
} from '@/lib/types';
import {
  getEvents,
  getQuestsForEvent,
  getAllSubmissions,
  getLeaderboardForEvent,
  getTeamLeaderboardForEvent,
  setEventPhase,
  toggleEventPause,
  createAnnouncement,
  getAnnouncements,
  createSecretCode,
  triggerFlashQuest,
  updateNPCCharacter,
  getNPCCharacters,
  getCrowdObjectives,
  createBonusWindow,
  adjustPlayerScoreManual,
  reconcilePlayerScores,
  grantFinaleQualification,
  getAllPlayers,
  getActivityLog,
} from '@/lib/game-engine';

export default function LiveDirectorDashboard() {
  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<TeamLeaderboardEntry[]>([]);
  const [announcements, setAnnouncements] = useState<LiveAnnouncement[]>([]);
  const [npcs, setNpcs] = useState<NPCCharacter[]>([]);
  const [crowdObjectives, setCrowdObjectives] = useState<CrowdObjective[]>([]);
  const [activityLog, setActivityLog] = useState<EventActivityItem[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [adminPassphrase, setAdminPassphrase] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // Action Modals & Form State
  const [activeModal, setActiveModal] = useState<'announce' | 'flash' | 'code' | 'bonus' | 'npc' | 'score' | 'wildcard' | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Announcement Form
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annUrgency, setAnnUrgency] = useState<LiveAnnouncement['urgency']>('info');

  // Flash Form
  const [selectedQuestId, setSelectedQuestId] = useState('');
  const [flashDurationMinutes, setFlashDurationMinutes] = useState(30);

  // Secret Code Form
  const [codeStr, setCodeStr] = useState('');
  const [codeDesc, setCodeDesc] = useState('');
  const [codePoints, setCodePoints] = useState(150);

  // Bonus Window Form
  const [bonusTitle, setBonusTitle] = useState('Double XP Bonus Sprint');
  const [bonusMultiplier, setBonusMultiplier] = useState(2.0);
  const [bonusCategory, setBonusCategory] = useState<Quest['category'] | 'all'>('all');
  const [bonusDuration, setBonusDuration] = useState(45);

  // NPC Form
  const [npcZone, setNpcZone] = useState('Downtown Arts Corridor');
  const [npcClue, setNpcClue] = useState('Spotted near 4th St Mural carrying secret cards.');

  // Score Adjustment Form
  const [adjPlayerId, setAdjPlayerId] = useState('');
  const [adjPoints, setAdjPoints] = useState(100);
  const [adjReason, setAdjReason] = useState('Field Challenge Bonus');

  const refreshData = useCallback(() => {
    if (!isAdminAuthenticated) {
      setEvent(null);
      setQuests([]);
      setLeaderboard([]);
      setTeamLeaderboard([]);
      setAnnouncements([]);
      setNpcs([]);
      setCrowdObjectives([]);
      setPlayers([]);
      setActivityLog([]);
      return;
    }

    const allEvents = getEvents();
    const activeEvt = allEvents[0] || null;
    setEvent(activeEvt);

    if (activeEvt) {
      setQuests(getQuestsForEvent(activeEvt.id));
      setLeaderboard(getLeaderboardForEvent(activeEvt.id));
      setTeamLeaderboard(getTeamLeaderboardForEvent(activeEvt.id));
      setAnnouncements(getAnnouncements(activeEvt.id));
      setNpcs(getNPCCharacters(activeEvt.id));
      setCrowdObjectives(getCrowdObjectives(activeEvt.id));
    }
    setPlayers(getAllPlayers());
    setActivityLog(getActivityLog());
  }, [isAdminAuthenticated]);

  useEffect(() => {
    fetch('/api/admin/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.isAdmin) {
          setIsAdminAuthenticated(true);
        } else {
          setIsAdminAuthenticated(false);
        }
      })
      .catch(() => {
        setIsAdminAuthenticated(false);
      })
      .finally(() => setIsCheckingAuth(false));
  }, []);

  useEffect(() => {
    if (!isAdminAuthenticated) return;
    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [isAdminAuthenticated, refreshData]);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase: adminPassphrase }),
      });
      const data = await res.json();
      if (res.ok && data.isAdmin) {
        setIsAdminAuthenticated(true);
        setAuthError('');
      } else {
        setAuthError(data.error || 'Invalid Game Master passphrase! Access denied.');
      }
    } catch (err: any) {
      setAuthError('Authentication failed: ' + err.message);
    }
  };

  const notify = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  const sendAdminLiveAction = async (payload: Record<string, any>) => {
    try {
      const res = await fetch('/api/admin/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const handlePhaseChange = async (phase: EventPhaseType) => {
    if (!event) return;
    const res = await sendAdminLiveAction({ action: 'set_phase', eventId: event.id, phase });
    if (res.success) {
      notify(`Phase updated to ${phase.toUpperCase()}`);
    } else {
      notify(`Failed: ${res.error}`);
    }
    refreshData();
  };

  const handleTogglePause = async () => {
    if (!event) return;
    const nextPaused = !event.isPaused;
    const res = await sendAdminLiveAction({
      action: 'toggle_pause',
      eventId: event.id,
      isPaused: nextPaused,
      reason: nextPaused ? 'Field safety check in progress' : undefined,
    });
    if (res.success) {
      notify(nextPaused ? '🛑 EVENT PAUSED' : '▶️ EVENT RESUMED');
    } else {
      notify(`Failed: ${res.error}`);
    }
    refreshData();
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !annTitle.trim() || !annMessage.trim()) return;
    const res = await sendAdminLiveAction({
      action: 'create_announcement',
      eventId: event.id,
      title: annTitle,
      message: annMessage,
      urgency: annUrgency,
    });
    if (res.success) {
      notify('📢 Announcement Broadcasted Live!');
      setAnnTitle('');
      setAnnMessage('');
      setActiveModal(null);
    } else {
      notify(`Failed: ${res.error}`);
    }
    refreshData();
  };

  const handleTriggerFlash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuestId) return;
    const res = await sendAdminLiveAction({
      action: 'trigger_flash',
      questId: selectedQuestId,
      durationMinutes: flashDurationMinutes,
    });
    if (res.success) {
      notify(`⚡ Flash Drop Triggered (${flashDurationMinutes}m)!`);
      setActiveModal(null);
    } else {
      notify(`Failed: ${res.error}`);
    }
    refreshData();
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !codeStr.trim()) return;
    const res = await sendAdminLiveAction({
      action: 'create_secret_code',
      eventId: event.id,
      code: codeStr,
      description: codeDesc || 'Secret Passcode Drop',
      bonusPoints: codePoints,
    });
    if (res.success) {
      notify(`🔑 Secret Passcode "${codeStr.toUpperCase()}" Live!`);
      setCodeStr('');
      setCodeDesc('');
      setActiveModal(null);
    } else {
      notify(`Failed: ${res.error}`);
    }
    refreshData();
  };

  const handleCreateBonusWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    const res = await sendAdminLiveAction({
      action: 'create_bonus_window',
      eventId: event.id,
      title: bonusTitle,
      multiplier: bonusMultiplier,
      targetCategory: bonusCategory === 'all' ? undefined : bonusCategory,
      durationMinutes: bonusDuration,
    });
    if (res.success) {
      notify(`🔥 ${bonusMultiplier}x Bonus Window Activated (${bonusDuration}m)!`);
      setActiveModal(null);
    } else {
      notify(`Failed: ${res.error}`);
    }
    refreshData();
  };

  const handleUpdateNpc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!npcs[0]) return;
    const res = await sendAdminLiveAction({
      action: 'update_npc',
      npcId: npcs[0].id,
      currentZone: npcZone,
      clueHint: npcClue,
      isActive: true,
    });
    if (res.success) {
      notify(`🕵️ NPC Location Updated: ${npcZone}`);
      setActiveModal(null);
    } else {
      notify(`Failed: ${res.error}`);
    }
    refreshData();
  };

  const handleScoreAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !adjPlayerId) return;
    const res = await sendAdminLiveAction({
      action: 'adjust_score',
      eventId: event.id,
      playerId: adjPlayerId,
      points: adjPoints,
      reason: adjReason,
      adminName: 'Game Director',
    });
    if (res.success) {
      notify(`Score Adjusted: ${adjPoints > 0 ? '+' : ''}${adjPoints} XP`);
      setActiveModal(null);
    } else {
      notify(`Failed: ${res.error}`);
    }
    refreshData();
  };

  const handleGrantWildcard = async (playerId: string) => {
    if (!event) return;
    const res = await sendAdminLiveAction({
      action: 'grant_wildcard',
      eventId: event.id,
      playerId,
      reason: 'Game Master Wildcard Pass',
    });
    if (res.success) {
      notify('👑 Wildcard Finale Qualification Granted!');
    } else {
      notify(`Failed: ${res.error}`);
    }
    refreshData();
  };

  const handleReconcile = async () => {
    if (!event) return;
    const res = await sendAdminLiveAction({ action: 'reconcile_scores', eventId: event.id });
    if (res.success) {
      notify(`Score Ledger Reconciled (${res.reconciled?.reconciledCount || 0} players updated)`);
    } else {
      notify(`Failed: ${res.error}`);
    }
    refreshData();
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[var(--bg-obsidian)] text-white flex items-center justify-center font-mono">
        Verifying Game Master Authorization...
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col font-mono">
        <Header />
        <main className="flex-1 max-w-md w-full mx-auto p-6 flex flex-col justify-center items-center">
          <div className="glass-panel p-6 border-red-500/50 glow-red w-full space-y-4 text-center">
            <div className="text-3xl">🔒</div>
            <h1 className="text-lg font-bold text-red-400 font-display">LIVE DIRECTOR ACCESS CONTROL</h1>
            <p className="text-xs text-gray-300">
              The Live Director Field Control Room (/admin/live) requires server-verified administrative authorization.
            </p>

            {authError && (
              <div className="p-3 bg-red-950/80 border border-red-500/50 rounded text-red-300 text-xs">
                {authError}
              </div>
            )}

            <form onSubmit={handleAdminAuth} className="space-y-3 pt-2">
              <input
                type="password"
                placeholder="Enter Game Master Secret..."
                value={adminPassphrase}
                onChange={(e) => setAdminPassphrase(e.target.value)}
                className="w-full px-3 py-2 bg-black/60 border border-gray-700 rounded text-white font-mono text-xs focus:border-amber-400 outline-none"
              />
              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-r from-amber-500 to-red-600 text-black font-bold rounded uppercase tracking-wider hover:opacity-90 transition-opacity"
              >
                Authenticate Game Master
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[var(--bg-obsidian)] text-white flex items-center justify-center">
        Loading Live Control Room...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col font-mono text-xs">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* LIVE DIRECTOR CONTROL ROOM HEADER */}
        <div className="glass-panel p-5 border-amber-500/50 glow-amber relative overflow-hidden space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
              <span className="font-extrabold text-lg text-white font-display uppercase tracking-wider">
                ⚡ LIVE GAME DIRECTOR FIELD DASHBOARD
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePause}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  event.isPaused
                    ? 'bg-emerald-500 text-obsidian shadow'
                    : 'bg-red-600/90 text-white hover:bg-red-600'
                }`}
              >
                {event.isPaused ? '▶️ RESUME EVENT' : '🛑 EMERGENCY PAUSE'}
              </button>
              <button
                onClick={handleReconcile}
                className="bg-gray-800 text-cyan-400 hover:text-white px-3 py-1.5 rounded-xl border border-gray-700 font-bold"
                title="Recalculate total XP from score ledger"
              >
                🔄 Reconcile Scores
              </button>
            </div>
          </div>

          {actionMessage && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-500 text-emerald-300 font-bold rounded-xl animate-fade-in">
              ✅ {actionMessage}
            </div>
          )}

          {event.isPaused && (
            <div className="p-3 bg-red-950/80 border-2 border-red-500 text-red-200 font-bold rounded-xl animate-pulse">
              ⚠️ EVENT IS CURRENTLY PAUSED: {event.pauseReason || 'Field safety check'}
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
            <div className="bg-obsidian/80 p-3 rounded-xl border border-gray-800 text-center">
              <span className="text-[10px] text-gray-400 block uppercase">Active Phase</span>
              <span className="text-amber-400 font-extrabold text-sm uppercase">
                {event.currentPhase}
              </span>
            </div>

            <div className="bg-obsidian/80 p-3 rounded-xl border border-gray-800 text-center">
              <span className="text-[10px] text-gray-400 block uppercase">Active Leader</span>
              <span className="text-emerald-400 font-extrabold text-sm truncate block">
                {leaderboard[0]?.displayName || 'None'} ({leaderboard[0]?.totalPoints || 0} XP)
              </span>
            </div>

            <div className="bg-obsidian/80 p-3 rounded-xl border border-gray-800 text-center">
              <span className="text-[10px] text-gray-400 block uppercase">Top Squad</span>
              <span className="text-cyan-400 font-extrabold text-sm truncate block">
                {teamLeaderboard[0]?.teamName || 'None'}
              </span>
            </div>

            <div className="bg-obsidian/80 p-3 rounded-xl border border-gray-800 text-center">
              <span className="text-[10px] text-gray-400 block uppercase">Field Agents</span>
              <span className="text-white font-extrabold text-sm">{players.length} Registered</span>
            </div>

            <div className="bg-obsidian/80 p-3 rounded-xl border border-gray-800 text-center">
              <span className="text-[10px] text-gray-400 block uppercase">City Crowd Objective</span>
              <span className="text-purple-400 font-extrabold text-sm">
                {crowdObjectives[0]?.currentCount || 0} / {crowdObjectives[0]?.targetCount || 20}
              </span>
            </div>
          </div>
        </div>

        {/* 1-CLICK ACTION CONTROLS GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => setActiveModal('announce')}
            className="p-4 bg-obsidian hover:bg-amber-950/30 border border-amber-500/40 hover:border-amber-400 rounded-2xl text-left space-y-1 transition-all active:scale-95 shadow"
          >
            <span className="text-2xl block">📢</span>
            <span className="text-white font-bold text-sm block">Broadcast Alert</span>
            <span className="text-[10px] text-gray-400 block">Send live ticker message to players</span>
          </button>

          <button
            onClick={() => setActiveModal('flash')}
            className="p-4 bg-obsidian hover:bg-red-950/30 border border-red-500/40 hover:border-red-400 rounded-2xl text-left space-y-1 transition-all active:scale-95 shadow"
          >
            <span className="text-2xl block">⚡</span>
            <span className="text-white font-bold text-sm block">Flash Drop</span>
            <span className="text-[10px] text-gray-400 block">Trigger timed pop-up quest</span>
          </button>

          <button
            onClick={() => setActiveModal('code')}
            className="p-4 bg-obsidian hover:bg-cyan-950/30 border border-cyan-500/40 hover:border-cyan-400 rounded-2xl text-left space-y-1 transition-all active:scale-95 shadow"
          >
            <span className="text-2xl block">🔑</span>
            <span className="text-white font-bold text-sm block">Secret Passcode</span>
            <span className="text-[10px] text-gray-400 block">Drop password for XP & collectible</span>
          </button>

          <button
            onClick={() => setActiveModal('bonus')}
            className="p-4 bg-obsidian hover:bg-purple-950/30 border border-purple-500/40 hover:border-purple-400 rounded-2xl text-left space-y-1 transition-all active:scale-95 shadow"
          >
            <span className="text-2xl block">🔥</span>
            <span className="text-white font-bold text-sm block">Bonus Window</span>
            <span className="text-[10px] text-gray-400 block">Activate 2x/3x XP category multiplier</span>
          </button>

          <button
            onClick={() => setActiveModal('npc')}
            className="p-4 bg-obsidian hover:bg-emerald-950/30 border border-emerald-500/40 hover:border-emerald-400 rounded-2xl text-left space-y-1 transition-all active:scale-95 shadow"
          >
            <span className="text-2xl block">🕵️</span>
            <span className="text-white font-bold text-sm block">Update Roaming NPC</span>
            <span className="text-[10px] text-gray-400 block">Update location clue for &quot;The Courier&quot;</span>
          </button>

          <button
            onClick={() => setActiveModal('score')}
            className="p-4 bg-obsidian hover:bg-amber-950/30 border border-amber-500/40 hover:border-amber-400 rounded-2xl text-left space-y-1 transition-all active:scale-95 shadow"
          >
            <span className="text-2xl block">➕</span>
            <span className="text-white font-bold text-sm block">Adjust Score</span>
            <span className="text-[10px] text-gray-400 block">Add/subtract XP with audit reason</span>
          </button>

          <button
            onClick={() => handlePhaseChange(event.currentPhase === 'finale' ? 'day_1' : 'finale')}
            className="p-4 bg-obsidian hover:bg-yellow-950/30 border border-yellow-500/40 hover:border-yellow-400 rounded-2xl text-left space-y-1 transition-all active:scale-95 shadow"
          >
            <span className="text-2xl block">🏆</span>
            <span className="text-white font-bold text-sm block">
              {event.currentPhase === 'finale' ? 'Exit Finale Mode' : 'Trigger Finale Mode'}
            </span>
            <span className="text-[10px] text-gray-400 block">Restrict city to qualified finale quests</span>
          </button>

          <button
            onClick={() => setActiveModal('wildcard')}
            className="p-4 bg-obsidian hover:bg-pink-950/30 border border-pink-500/40 hover:border-pink-400 rounded-2xl text-left space-y-1 transition-all active:scale-95 shadow"
          >
            <span className="text-2xl block">👑</span>
            <span className="text-white font-bold text-sm block">Grant Wildcard</span>
            <span className="text-[10px] text-gray-400 block">Qualify agent for Finale</span>
          </button>
        </div>

        {/* PHASE SELECTOR BAR */}
        <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3 border-gray-800">
          <span className="text-white font-bold">CHANGE EVENT PHASE:</span>
          <div className="flex flex-wrap gap-2">
            {[
              'pre_game',
              'opening',
              'day_1',
              'night_round',
              'day_2',
              'final_hours',
              'finale',
              'ended',
            ].map((ph) => (
              <button
                key={ph}
                onClick={() => handlePhaseChange(ph as EventPhaseType)}
                className={`px-3 py-1.5 rounded-xl uppercase font-bold text-[11px] border transition-all ${
                  event.currentPhase === ph
                    ? 'bg-amber-500 text-obsidian border-amber-400 shadow font-extrabold'
                    : 'bg-card text-gray-300 border-gray-800 hover:border-gray-600'
                }`}
              >
                {ph.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* LIVE STREAM & FEED PANELS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Announcements List */}
          <div className="glass-panel p-5 space-y-3">
            <h2 className="text-sm font-bold text-white uppercase flex items-center justify-between">
              <span>📢 Live Ticker Announcements ({announcements.length})</span>
              <button onClick={() => setActiveModal('announce')} className="text-amber-400 hover:underline">
                + New
              </button>
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {announcements.length === 0 ? (
                <div className="text-gray-500">No active announcements.</div>
              ) : (
                announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 bg-obsidian border border-gray-800 rounded-xl space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between text-amber-400 font-bold">
                      <span>{a.title}</span>
                      <span className="text-[10px] text-gray-400 uppercase">{a.urgency}</span>
                    </div>
                    <div className="text-gray-300">{a.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Live Activity Log Stream */}
          <div className="glass-panel p-5 space-y-3">
            <h2 className="text-sm font-bold text-white uppercase">
              📡 Real-Time Field Activity Stream
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activityLog.length === 0 ? (
                <div className="text-gray-500">No recent activity logged.</div>
              ) : (
                activityLog.map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 bg-obsidian border border-gray-800 rounded-xl flex items-start justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-cyan-400">{act.title}</span>
                      {act.details && <div className="text-gray-300 text-[11px]">{act.details}</div>}
                    </div>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ACTION MODALS */}
      {/* 1. ANNOUNCE MODAL */}
      {activeModal === 'announce' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-obsidian border border-amber-500/40 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white">📢 Broadcast Live Announcement</h3>
            <form onSubmit={handleCreateAnnouncement} className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-1">Headline / Title</label>
                <input
                  type="text"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="e.g. FLASH DROP ACTIVE — MARKET SQUARE"
                  className="input-field text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Message Body</label>
                <textarea
                  value={annMessage}
                  onChange={(e) => setAnnMessage(e.target.value)}
                  placeholder="e.g. First 5 teams to Centennial Plaza earn bonus +200 XP!"
                  className="input-field text-xs h-20"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Urgency Level</label>
                <select
                  value={annUrgency}
                  onChange={(e) => setAnnUrgency(e.target.value as any)}
                  className="input-field text-xs"
                >
                  <option value="info">Info (Standard Blue)</option>
                  <option value="warning">Warning (Amber)</option>
                  <option value="flash">Flash (Red Pulse)</option>
                  <option value="urgent">Urgent Broadcast (High Priority)</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn btn-primary text-xs py-2 px-4 flex-1 font-bold">
                  🚀 BROADCAST LIVE
                </button>
                <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary text-xs py-2 px-4">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. FLASH MODAL */}
      {activeModal === 'flash' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-obsidian border border-red-500/40 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white">⚡ Trigger Pop-Up Flash Quest Drop</h3>
            <form onSubmit={handleTriggerFlash} className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-1">Select Quest</label>
                <select
                  value={selectedQuestId}
                  onChange={(e) => setSelectedQuestId(e.target.value)}
                  className="input-field text-xs"
                  required
                >
                  <option value="">-- Choose Quest --</option>
                  {quests.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} (+{q.pointValue} XP)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Duration (Minutes)</label>
                <select
                  value={flashDurationMinutes}
                  onChange={(e) => setFlashDurationMinutes(Number(e.target.value))}
                  className="input-field text-xs"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn btn-primary text-xs py-2 px-4 flex-1 font-bold">
                  ⚡ LAUNCH FLASH DROP
                </button>
                <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary text-xs py-2 px-4">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. SECRET CODE MODAL */}
      {activeModal === 'code' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-obsidian border border-cyan-500/40 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white">🔑 Create Secret Passcode Drop</h3>
            <form onSubmit={handleCreateCode} className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-1">Passcode</label>
                <input
                  type="text"
                  value={codeStr}
                  onChange={(e) => setCodeStr(e.target.value.toUpperCase())}
                  placeholder="e.g. CANTON77"
                  className="input-field uppercase tracking-wider font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Bonus XP Points</label>
                <input
                  type="number"
                  value={codePoints}
                  onChange={(e) => setCodePoints(Number(e.target.value))}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Description / Hint</label>
                <input
                  type="text"
                  value={codeDesc}
                  onChange={(e) => setCodeDesc(e.target.value)}
                  placeholder="e.g. Given by NPC Courier near Arts District"
                  className="input-field text-xs"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn btn-cyan text-xs py-2 px-4 flex-1 font-bold">
                  🔑 ACTIVATE PASSCODE
                </button>
                <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary text-xs py-2 px-4">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. BONUS WINDOW MODAL */}
      {activeModal === 'bonus' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-obsidian border border-purple-500/40 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white">🔥 Activate Category Bonus Window</h3>
            <form onSubmit={handleCreateBonusWindow} className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-1">Multiplier</label>
                <select
                  value={bonusMultiplier}
                  onChange={(e) => setBonusMultiplier(Number(e.target.value))}
                  className="input-field text-xs"
                >
                  <option value={1.5}>1.5x XP</option>
                  <option value={2.0}>2.0x Double XP</option>
                  <option value={3.0}>3.0x Triple XP</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Target Category</label>
                <select
                  value={bonusCategory}
                  onChange={(e) => setBonusCategory(e.target.value as any)}
                  className="input-field text-xs"
                >
                  <option value="all">All Quests</option>
                  <option value="puzzle">Puzzle Quests</option>
                  <option value="creative">Creative / Photo Quests</option>
                  <option value="exploration">Exploration Quests</option>
                  <option value="business_partner">Local Partner Quests</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Duration (Minutes)</label>
                <select
                  value={bonusDuration}
                  onChange={(e) => setBonusDuration(Number(e.target.value))}
                  className="input-field text-xs"
                >
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn btn-primary text-xs py-2 px-4 flex-1 font-bold">
                  🔥 LAUNCH BONUS WINDOW
                </button>
                <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary text-xs py-2 px-4">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. NPC MODAL */}
      {activeModal === 'npc' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-obsidian border border-emerald-500/40 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white">🕵️ Update Roaming NPC (&quot;The Courier&quot;)</h3>
            <form onSubmit={handleUpdateNpc} className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-1">Current Canton Zone</label>
                <input
                  type="text"
                  value={npcZone}
                  onChange={(e) => setNpcZone(e.target.value)}
                  placeholder="e.g. Market Square Pavilion"
                  className="input-field text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Public Clue Hint for Players</label>
                <input
                  type="text"
                  value={npcClue}
                  onChange={(e) => setNpcClue(e.target.value)}
                  placeholder="e.g. Spotted near the coffee patio carrying secret codes"
                  className="input-field text-xs"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn btn-primary text-xs py-2 px-4 flex-1 font-bold">
                  🕵️ UPDATE NPC LOCATION
                </button>
                <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary text-xs py-2 px-4">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. SCORE ADJUSTMENT MODAL */}
      {activeModal === 'score' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-obsidian border border-amber-500/40 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white">➕ Manual Score Adjustment</h3>
            <form onSubmit={handleScoreAdjust} className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-1">Select Player Agent</label>
                <select
                  value={adjPlayerId}
                  onChange={(e) => setAdjPlayerId(e.target.value)}
                  className="input-field text-xs"
                  required
                >
                  <option value="">-- Choose Agent --</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} (Current: {p.totalXp} XP)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 block mb-1">XP Adjustment (+ or -)</label>
                <input
                  type="number"
                  value={adjPoints}
                  onChange={(e) => setAdjPoints(Number(e.target.value))}
                  className="input-field text-xs font-bold text-amber-400"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Audit Reason</label>
                <input
                  type="text"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g. Field Challenge Bonus or Rule Penalty"
                  className="input-field text-xs"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn btn-primary text-xs py-2 px-4 flex-1 font-bold">
                  💾 RECORD LEDGER ADJUSTMENT
                </button>
                <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary text-xs py-2 px-4">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. WILDCARD MODAL */}
      {activeModal === 'wildcard' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-obsidian border border-pink-500/40 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white">👑 Grant Wildcard Finale Pass</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {players.map((p) => (
                <div key={p.id} className="p-3 bg-obsidian border border-gray-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white">{p.displayName}</span>
                    <span className="text-gray-400 block text-[10px]">{p.totalXp} XP</span>
                  </div>
                  <button
                    onClick={() => handleGrantWildcard(p.id)}
                    className="btn btn-cyan text-xs py-1 px-3 font-bold"
                  >
                    👑 Grant Pass
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setActiveModal(null)} className="btn btn-secondary text-xs py-2 px-4 w-full">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
