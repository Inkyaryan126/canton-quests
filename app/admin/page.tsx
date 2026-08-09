'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import {
  QuestEvent,
  Quest,
  QuestSubmission,
  Team,
  TeamMember,
  EventActivityItem,
} from '@/lib/types';
import {
  getEvents,
  getQuestsForEvent,
  getAllSubmissions,
  reviewSubmission,
  updateQuest,
  updateEventStatus,
  triggerFlashQuest,
  getTeamLeaderboardForEvent,
  getActivityLog,
} from '@/lib/game-engine';

export default function AdminPage() {
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<QuestEvent | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [submissions, setSubmissions] = useState<QuestSubmission[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<EventActivityItem[]>([]);

  const [activeTab, setActiveTab] = useState<'overview' | 'flash' | 'quests' | 'submissions' | 'teams'>('overview');
  const [feedbackInput, setFeedbackInput] = useState<Record<string, string>>({});
  const [flashDuration, setFlashDuration] = useState<number>(30);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refreshData = useCallback(() => {
    const allEvents = getEvents();
    setEvents(allEvents);
    const activeEvt = allEvents[0] || null;
    setSelectedEvent(activeEvt);

    if (activeEvt) {
      setQuests(getQuestsForEvent(activeEvt.id));
      setTeams(getTeamLeaderboardForEvent(activeEvt.id));
    }
    setSubmissions(getAllSubmissions());
    setActivityLog(getActivityLog());
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const showNotification = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleReview = (subId: string, status: 'verified' | 'rejected') => {
    const fb = feedbackInput[subId] || '';
    reviewSubmission(subId, status, fb);
    showNotification(`Submission ${status === 'verified' ? 'Approved' : 'Rejected'}!`);
    refreshData();
  };

  const handleTriggerFlash = (questId: string) => {
    triggerFlashQuest(questId, flashDuration);
    showNotification(`⚡ Flash Quest Activated for ${flashDuration} minutes!`);
    refreshData();
  };

  const handleToggleQuestStatus = (quest: Quest) => {
    const nextStatus = quest.status === 'active' ? 'inactive' : 'active';
    updateQuest(quest.id, { status: nextStatus });
    showNotification(`Quest "${quest.title}" status changed to ${nextStatus.toUpperCase()}`);
    refreshData();
  };

  const handleUpdateEventStatus = (status: QuestEvent['status']) => {
    if (!selectedEvent) return;
    updateEventStatus(selectedEvent.id, status);
    showNotification(`Event status updated to ${status.toUpperCase()}`);
    refreshData();
  };

  const pendingSubmissions = submissions.filter((s) => s.status === 'pending');
  const verifiedSubmissions = submissions.filter((s) => s.status === 'verified');

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6">
        {/* Game Master Control Room Banner */}
        <div className="glass-panel p-5 md:p-6 mb-6 border-amber-500/40 glow-amber relative">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <span className="badge badge-medium bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono">
              👑 GAME MASTER CONTROL ROOM
            </span>
            {selectedEvent && (
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-800/40">
                ● STATUS: {selectedEvent.status.toUpperCase()}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
            Canton Quests Field Command
          </h1>
          <p className="text-xs sm:text-sm text-gray-300">
            Control live event mechanics, trigger pop-up flash drops, review submissions, and manage teams.
          </p>
        </div>

        {actionMessage && (
          <div className="p-3.5 bg-emerald-950/50 border border-emerald-500 text-emerald-300 text-xs font-mono rounded-xl mb-6 animate-fade-in font-bold">
            ✅ {actionMessage}
          </div>
        )}

        {/* Quick Command Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="glass-card p-3 text-center border-purple-500/30">
            <span className="text-[10px] font-mono text-gray-400 uppercase block">Pending Reviews</span>
            <span className="font-display font-extrabold text-2xl text-purple-400">
              {pendingSubmissions.length}
            </span>
          </div>

          <div className="glass-card p-3 text-center border-red-500/30">
            <span className="text-[10px] font-mono text-gray-400 uppercase block">Active Flash Quests</span>
            <span className="font-display font-extrabold text-2xl text-red-400">
              {quests.filter((q) => q.isFlash && q.status === 'active').length}
            </span>
          </div>

          <div className="glass-card p-3 text-center border-cyan-500/30">
            <span className="text-[10px] font-mono text-gray-400 uppercase block">Registered Squads</span>
            <span className="font-display font-extrabold text-2xl text-cyan-400">
              {teams.length}
            </span>
          </div>

          <div className="glass-card p-3 text-center border-emerald-500/30">
            <span className="text-[10px] font-mono text-gray-400 uppercase block">Total Verified Proofs</span>
            <span className="font-display font-extrabold text-2xl text-emerald-400">
              {verifiedSubmissions.length}
            </span>
          </div>
        </div>

        {/* Control Room Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] mb-6 font-display font-bold text-xs sm:text-sm overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 text-center border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            📊 Event Controls & Activity
          </button>
          <button
            onClick={() => setActiveTab('flash')}
            className={`flex-1 py-3 text-center border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'flash'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            ⚡ Flash Quest Controls
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            className={`flex-1 py-3 text-center border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'submissions'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            📋 Submissions ({pendingSubmissions.length})
          </button>
          <button
            onClick={() => setActiveTab('quests')}
            className={`flex-1 py-3 text-center border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'quests'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🎯 Quest Manager ({quests.length})
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex-1 py-3 text-center border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'teams'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            👥 Teams ({teams.length})
          </button>
        </div>

        {/* TAB 1: EVENT CONTROLS & LIVE ACTIVITY */}
        {activeTab === 'overview' && selectedEvent && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-panel p-5 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                ⚙️ Event Status Controls
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-mono text-gray-400">Current Status:</span>
                {(['draft', 'upcoming', 'active', 'ended'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleUpdateEventStatus(st)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-mono uppercase font-bold border transition-all ${
                      selectedEvent.status === st
                        ? 'bg-amber-500 text-obsidian border-amber-400 shadow'
                        : 'bg-card text-gray-300 border-gray-800 hover:border-gray-600'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Activity Stream */}
            <div className="glass-panel p-5 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                📡 Live Canton Event Activity Stream
              </h2>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {activityLog.length === 0 ? (
                  <div className="text-xs text-gray-400 font-mono">No activity logged yet.</div>
                ) : (
                  activityLog.map((act) => (
                    <div
                      key={act.id}
                      className="p-3 bg-obsidian/80 border border-gray-800 rounded-xl text-xs font-mono flex items-start justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-400">{act.title}</span>
                          <span className="text-[10px] text-gray-400">by {act.actorName}</span>
                        </div>
                        {act.details && <div className="text-gray-300 text-[11px] pt-0.5">{act.details}</div>}
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FLASH QUEST CONTROLS */}
        {activeTab === 'flash' && (
          <div className="glass-panel p-6 space-y-5 animate-fade-in border-red-500/30">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                ⚡ Flash Quest Pop-Up Trigger
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Instantly activate temporary flash missions across Canton with configurable expiration timers!
              </p>
            </div>

            <div className="flex items-center gap-3 p-3 bg-obsidian/80 rounded-xl border border-gray-800">
              <label className="text-xs font-mono text-gray-300">Set Flash Duration:</label>
              {[15, 30, 45, 60, 120].map((dur) => (
                <button
                  key={dur}
                  onClick={() => setFlashDuration(dur)}
                  className={`text-xs px-3 py-1 rounded-lg font-mono font-bold border ${
                    flashDuration === dur
                      ? 'bg-red-600 text-white border-red-500'
                      : 'bg-card text-gray-400 border-gray-800'
                  }`}
                >
                  {dur}m
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-mono uppercase text-gray-400">Available Quests to Trigger as Flash Drop:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quests.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 bg-obsidian border border-gray-800 rounded-xl flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-white text-sm">{q.title}</span>
                        <span className="text-amber-400 font-mono text-xs">+{q.pointValue} XP</span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">{q.description}</p>
                    </div>

                    <button
                      onClick={() => handleTriggerFlash(q.id)}
                      className="btn btn-primary text-xs py-2 w-full font-bold flex items-center justify-center gap-1"
                    >
                      ⚡ TRIGGER {flashDuration}M FLASH DROP
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SUBMISSIONS REVIEW */}
        {activeTab === 'submissions' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold text-white">Media Submissions Queue</h2>
            {submissions.length === 0 ? (
              <div className="glass-panel p-8 text-center text-gray-400 font-mono text-sm">
                No submissions recorded yet.
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map((sub) => {
                  const questObj = quests.find((q) => q.id === sub.questId);
                  return (
                    <div
                      key={sub.id}
                      className={`glass-panel p-5 space-y-3 ${
                        sub.status === 'pending'
                          ? 'border-purple-500/40 bg-purple-950/10'
                          : sub.status === 'verified'
                          ? 'border-emerald-500/30'
                          : 'border-red-500/30'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-mono text-amber-400 font-bold block">
                            {questObj?.title || sub.questId}
                          </span>
                          <span className="text-[11px] font-mono text-gray-400">
                            Agent: {sub.playerId} • Submitted: {new Date(sub.submittedAt).toLocaleString()}
                          </span>
                        </div>

                        <span
                          className={`text-xs font-mono font-bold px-3 py-1 rounded-full uppercase ${
                            sub.status === 'verified'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : sub.status === 'pending'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : 'bg-red-500/20 text-red-400 border border-red-500/40'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </div>

                      {sub.proofUrl && (
                        <div className="p-2 bg-obsidian rounded-xl border border-gray-800 text-xs font-mono">
                          <span className="text-gray-400 block mb-1">Proof URL:</span>
                          <a
                            href={sub.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline break-all"
                          >
                            {sub.proofUrl}
                          </a>
                        </div>
                      )}

                      {sub.submittedContent && (
                        <div className="p-2 bg-obsidian rounded-xl border border-gray-800 text-xs font-mono text-gray-300">
                          {sub.submittedContent}
                        </div>
                      )}

                      {sub.status === 'pending' && (
                        <div className="space-y-2 pt-2 border-t border-gray-800">
                          <input
                            type="text"
                            placeholder="Optional Game Master feedback..."
                            value={feedbackInput[sub.id] || ''}
                            onChange={(e) =>
                              setFeedbackInput({ ...feedbackInput, [sub.id]: e.target.value })
                            }
                            className="input-field text-xs font-mono"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReview(sub.id, 'verified')}
                              className="btn btn-primary text-xs py-2 px-4 font-bold flex-1"
                            >
                              ✓ APPROVE & AWARD POINTS
                            </button>
                            <button
                              onClick={() => handleReview(sub.id, 'rejected')}
                              className="btn btn-secondary text-xs py-2 px-4 text-red-400 hover:border-red-600 flex-1"
                            >
                              ✕ REJECT
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: QUEST MANAGER */}
        {activeTab === 'quests' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold text-white">Quest Manager ({quests.length})</h2>
            <div className="space-y-3">
              {quests.map((q) => (
                <div
                  key={q.id}
                  className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3 border-gray-800"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white text-base">{q.title}</span>
                      <span className={`badge badge-${q.difficulty}`}>{q.difficulty}</span>
                      <span className="text-amber-400 font-mono text-xs">+{q.pointValue} XP</span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono">
                      Location: {q.location?.name || 'Canton'} • Type: {q.verificationType} • Radius: {q.radiusMeters || 100}m
                    </p>
                  </div>

                  <button
                    onClick={() => handleToggleQuestStatus(q)}
                    className={`text-xs px-4 py-2 rounded-xl font-mono font-bold border ${
                      q.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-gray-800 text-gray-400 border-gray-700'
                    }`}
                  >
                    {q.status === 'active' ? '● ACTIVE' : '○ INACTIVE'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: TEAMS MANAGER */}
        {activeTab === 'teams' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold text-white">Registered Squads ({teams.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {teams.map((team) => (
                <div key={team.teamId} className="glass-panel p-4 space-y-2 border-cyan-500/30">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-base">{team.teamName}</h3>
                    <span className="text-xs font-mono text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                      Code: {team.joinCode}
                    </span>
                  </div>
                  <div className="text-xs text-gray-300 font-mono space-y-1">
                    <div>Captain: {team.captainName}</div>
                    <div>Members: {team.memberCount} Agent(s)</div>
                    <div className="text-cyan-400 font-bold pt-1">Total Squad Points: {team.totalPoints} XP</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
