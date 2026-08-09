'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { QuestEvent, Quest, QuestSubmission, ProofVerificationType, QuestCategory, QuestDifficulty } from '@/lib/types';
import {
  getEvents,
  updateEventStatus,
  createEvent,
  getQuestsForEvent,
  createQuest,
  updateQuest,
  getAllSubmissions,
  reviewSubmission,
} from '@/lib/game-engine';

export default function AdminControlPage() {
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [quests, setQuests] = useState<Quest[]>([]);
  const [submissions, setSubmissions] = useState<QuestSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<'submissions' | 'quests' | 'events'>('submissions');

  // New Quest Form State
  const [showNewQuestModal, setShowNewQuestModal] = useState(false);
  const [qTitle, setQTitle] = useState('');
  const [qDescription, setQDescription] = useState('');
  const [qInstructions, setQInstructions] = useState('');
  const [qPoints, setQPoints] = useState(100);
  const [qDifficulty, setQDifficulty] = useState<QuestDifficulty>('medium');
  const [qCategory, setQCategory] = useState<QuestCategory>('exploration');
  const [qVerificationType, setQVerificationType] = useState<ProofVerificationType>('checkin');
  const [qTargetCode, setQTargetCode] = useState('');

  // New Event Form State
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [eTitle, ETitle] = useState('');
  const [eSlug, ESlug] = useState('');
  const [eDesc, EDesc] = useState('');

  const refreshAdminData = useCallback(() => {
    const evts = getEvents();
    setEvents(evts);

    const active = evts.find((e) => e.status === 'active') || evts[0];
    const targetEvtId = selectedEventId || (active ? active.id : '');
    setSelectedEventId(targetEvtId);

    if (targetEvtId) {
      setQuests(getQuestsForEvent(targetEvtId));
    }
    setSubmissions(getAllSubmissions());
  }, [selectedEventId]);

  useEffect(() => {
    refreshAdminData();
  }, [refreshAdminData]);

  const handleStatusChange = (eventId: string, newStatus: QuestEvent['status']) => {
    updateEventStatus(eventId, newStatus);
    refreshAdminData();
  };

  const handleToggleQuestStatus = (quest: Quest) => {
    const nextStatus = quest.status === 'active' ? 'inactive' : 'active';
    updateQuest(quest.id, { status: nextStatus });
    refreshAdminData();
  };

  const handleReview = (subId: string, action: 'verified' | 'rejected') => {
    reviewSubmission(subId, action, action === 'verified' ? 'Approved by Game Master' : 'Rejected');
    refreshAdminData();
  };

  const handleCreateQuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !qTitle.trim()) return;

    createQuest({
      eventId: selectedEventId,
      title: qTitle.trim(),
      slug: qTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: qDescription.trim(),
      instructions: qInstructions.trim(),
      pointValue: Number(qPoints),
      difficulty: qDifficulty,
      category: qCategory,
      verificationType: qVerificationType,
      targetCode: qTargetCode.trim(),
      proofRequirement: qInstructions.trim(),
      isFlash: qCategory === 'flash',
      status: 'active',
      sortOrder: quests.length + 1,
    });

    setShowNewQuestModal(false);
    setQTitle('');
    setQDescription('');
    setQInstructions('');
    setQTargetCode('');
    refreshAdminData();
  };

  const handleCreateEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eTitle.trim() || !eSlug.trim()) return;

    createEvent({
      cityId: 'city-canton-oh',
      title: eTitle.trim(),
      slug: eSlug.trim(),
      description: eDesc.trim(),
      status: 'active',
      basicInstructions: 'Follow quest instructions and earn points.',
    });

    setShowNewEventModal(false);
    ETitle('');
    ESlug('');
    EDesc('');
    refreshAdminData();
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const pendingSubmissions = submissions.filter((s) => s.status === 'pending');

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="badge badge-medium bg-purple-500/20 text-purple-300 border-purple-500/40 font-mono">
                CONTROL ROOM
              </span>
              <span className="text-xs font-mono text-gray-400">Canton Operations</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white">🕹️ Game Master Admin Console</h1>
          </div>

          <div className="flex items-center gap-2">
            {selectedEvent && (
              <Link
                href={`/events/${selectedEvent.slug}`}
                className="btn btn-secondary text-xs py-2 px-3 font-mono"
              >
                👁️ View Live Event Hub
              </Link>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--border-subtle)] mb-6 font-display font-bold">
          <button
            onClick={() => setActiveTab('submissions')}
            className={`py-3 px-4 text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'submissions'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            📬 Submissions Review
            {pendingSubmissions.length > 0 && (
              <span className="bg-amber-500 text-obsidian text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingSubmissions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('quests')}
            className={`py-3 px-4 text-sm border-b-2 transition-all ${
              activeTab === 'quests'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            ⚡ Manage Quests ({quests.length})
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`py-3 px-4 text-sm border-b-2 transition-all ${
              activeTab === 'events'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🏛️ Events ({events.length})
          </button>
        </div>

        {/* TAB 1: SUBMISSIONS REVIEW */}
        {activeTab === 'submissions' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Player Proof Queue</h2>
              <span className="text-xs font-mono text-gray-400">
                Total Submissions: {submissions.length}
              </span>
            </div>

            {submissions.length === 0 ? (
              <div className="glass-panel p-8 text-center text-gray-400 font-mono text-sm">
                No submissions logged yet.
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className={`glass-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border ${
                      sub.status === 'pending'
                        ? 'border-amber-500/40 bg-amber-950/20'
                        : sub.status === 'verified'
                        ? 'border-emerald-500/30'
                        : 'border-gray-800 opacity-60'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`badge ${
                            sub.status === 'verified'
                              ? 'badge-easy'
                              : sub.status === 'pending'
                              ? 'badge-medium'
                              : 'badge-hard'
                          }`}
                        >
                          {sub.status.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono text-gray-400">
                          {new Date(sub.submittedAt).toLocaleTimeString()}
                        </span>
                        <span className="text-xs font-mono text-cyan-400">
                          [{sub.proofType}]
                        </span>
                      </div>

                      <div className="text-sm text-white font-mono">
                        Agent ID: <strong className="text-amber-400">{sub.playerId}</strong> | Quest ID: {sub.questId}
                      </div>

                      {sub.submittedContent && (
                        <p className="text-xs text-gray-300 font-mono bg-obsidian/80 p-2 rounded border border-gray-800">
                          Content: &quot;{sub.submittedContent}&quot;
                        </p>
                      )}

                      {sub.proofUrl && (
                        <a
                          href={sub.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-cyan-400 hover:underline block font-mono"
                        >
                          🔗 View Submitted Media Proof
                        </a>
                      )}
                    </div>

                    {sub.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReview(sub.id, 'verified')}
                          className="btn btn-primary text-xs py-2 px-3"
                        >
                          ✓ Approve (+Points)
                        </button>
                        <button
                          onClick={() => handleReview(sub.id, 'rejected')}
                          className="btn btn-secondary text-xs py-2 px-3 text-red-400 hover:border-red-500"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-mono text-gray-400">
                        Points Awarded: {sub.awardedPoints} XP
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: MANAGE QUESTS */}
        {activeTab === 'quests' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Event Quests</h2>
              <button
                onClick={() => setShowNewQuestModal(true)}
                className="btn btn-primary text-xs py-2 px-3"
              >
                + Create New Quest
              </button>
            </div>

            {quests.map((q) => (
              <div
                key={q.id}
                className="glass-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-gray-800"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge badge-${q.difficulty}`}>{q.difficulty}</span>
                    <span className="badge badge-medium">{q.category}</span>
                    <span className="text-xs font-mono text-amber-400 font-bold">
                      +{q.pointValue} XP
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        q.status === 'active'
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                          : 'bg-gray-800 text-gray-400 border-gray-700'
                      }`}
                    >
                      {q.status.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">{q.title}</h3>
                  <p className="text-xs text-gray-400 font-mono">{q.instructions}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleQuestStatus(q)}
                    className="btn btn-secondary text-xs py-1.5 px-3 min-h-[36px]"
                  >
                    {q.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* TAB 3: MANAGE EVENTS */}
        {activeTab === 'events' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Canton Events Catalog</h2>
              <button
                onClick={() => setShowNewEventModal(true)}
                className="btn btn-primary text-xs py-2 px-3"
              >
                + Create New Event
              </button>
            </div>

            {events.map((e) => (
              <div
                key={e.id}
                className="glass-panel p-5 border-amber-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge badge-medium">{e.status.toUpperCase()}</span>
                    <span className="text-xs font-mono text-gray-400">{e.slug}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{e.title}</h3>
                  <p className="text-xs text-gray-300 max-w-xl">{e.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  {e.status !== 'active' ? (
                    <button
                      onClick={() => handleStatusChange(e.id, 'active')}
                      className="btn btn-primary text-xs py-2 px-3"
                    >
                      ● Activate Event
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(e.id, 'ended')}
                      className="btn btn-secondary text-xs py-2 px-3 text-red-400"
                    >
                      End Event
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* CREATE QUEST MODAL */}
        {showNewQuestModal && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="glass-panel p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <h3 className="text-lg font-bold text-white">Create New Quest</h3>
                <button onClick={() => setShowNewQuestModal(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateQuestSubmit} className="space-y-3 text-xs font-mono">
                <div>
                  <label className="block text-gray-300 mb-1">Quest Title:</label>
                  <input
                    type="text"
                    value={qTitle}
                    onChange={(e) => setQTitle(e.target.value)}
                    placeholder="e.g. Market Ave Fountain Challenge"
                    className="input-field text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-1">Description:</label>
                  <textarea
                    value={qDescription}
                    onChange={(e) => setQDescription(e.target.value)}
                    placeholder="Quest narrative details..."
                    className="input-field text-xs min-h-[60px]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-1">Instructions:</label>
                  <input
                    type="text"
                    value={qInstructions}
                    onChange={(e) => setQInstructions(e.target.value)}
                    placeholder="Specific verification steps..."
                    className="input-field text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-300 mb-1">Point Value (XP):</label>
                    <input
                      type="number"
                      value={qPoints}
                      onChange={(e) => setQPoints(Number(e.target.value))}
                      className="input-field text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-1">Difficulty:</label>
                    <select
                      value={qDifficulty}
                      onChange={(e) => setQDifficulty(e.target.value as QuestDifficulty)}
                      className="input-field text-xs bg-obsidian"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="epic">Epic</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-300 mb-1">Verification Type:</label>
                    <select
                      value={qVerificationType}
                      onChange={(e) => setQVerificationType(e.target.value as ProofVerificationType)}
                      className="input-field text-xs bg-obsidian"
                    >
                      <option value="checkin">Check-In</option>
                      <option value="passphrase">Passphrase / Code</option>
                      <option value="qr">QR Code</option>
                      <option value="photo">Photo Submission</option>
                      <option value="video">Video Submission</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-1">Target Answer / Code:</label>
                    <input
                      type="text"
                      value={qTargetCode}
                      onChange={(e) => setQTargetCode(e.target.value)}
                      placeholder="e.g. 1927 or CODE123"
                      className="input-field text-xs"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewQuestModal(false)}
                    className="btn btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary text-xs">
                    Create Quest
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
