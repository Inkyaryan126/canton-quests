'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import {
  QuestEvent,
  Quest,
  QuestSubmission,
  Team,
  EventActivityItem,
  EventReadiness,
  LocationInfo,
  SecretCode,
  Collectible,
  NPCCharacter,
  BusinessPartnerInfo,
  GeneratedQR,
  QuestTemplate,
} from '@/lib/types';
import {
  getEvents,
  getQuestsForEvent,
  getAllSubmissions,
  reviewSubmission,
  updateQuest,
  createQuest,
  duplicateQuest,
  updateEventStatus,
  triggerFlashQuest,
  getTeamLeaderboardForEvent,
  getActivityLog,
  getEventReadinessCheck,
  createEventWizard,
  duplicateEvent,
  getLocations,
  createLocation,
  updateLocation,
  generateQRCodeToken,
  getGeneratedQRs,
  getQuestTemplates,
  createSecretCode,
  awardCollectible,
  updateNPCCharacter,
} from '@/lib/game-engine';

export default function AdminPage() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminPassphrase, setAdminPassphrase] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // Domain Data State
  const [events, setEvents] = useState<QuestEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<QuestEvent | null>(null);
  const [readiness, setReadiness] = useState<EventReadiness | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [submissions, setSubmissions] = useState<QuestSubmission[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<EventActivityItem[]>([]);
  const [generatedQrs, setGeneratedQrs] = useState<GeneratedQR[]>([]);

  // Navigation & Active Tab State
  const [activeTab, setActiveTab] = useState<
    'overview' | 'readiness' | 'events' | 'quests' | 'locations' | 'qr' | 'submissions' | 'teams'
  >('overview');

  // Action Notification State
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Event Wizard State
  const [evTitle, setEvTitle] = useState('');
  const [evSlug, setEvSlug] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evStatus, setEvStatus] = useState<QuestEvent['status']>('draft');
  const [evStart, setEvStart] = useState('2026-09-04T18:00');
  const [evEnd, setEvEnd] = useState('2026-09-07T22:00');

  // Event Duplication State
  const [dupTitle, setDupTitle] = useState('Canton Quest Weekend #2');
  const [dupSlug, setDupSlug] = useState('canton-weekend-2');

  // Quest Studio Form State
  const [qTitle, setQTitle] = useState('');
  const [qSlug, setQSlug] = useState('');
  const [qDesc, setQDesc] = useState('');
  const [qInst, setQInst] = useState('');
  const [qPoints, setQPoints] = useState(150);
  const [qCategory, setQCategory] = useState<Quest['category']>('puzzle');
  const [qProofType, setQProofType] = useState<Quest['verificationType']>('passphrase');
  const [qTargetCode, setQTargetCode] = useState('');
  const [qLocationId, setQLocationId] = useState('');
  const [qPrereqId, setQPrereqId] = useState('');
  const [qClaimLimit, setQClaimLimit] = useState<number | undefined>(undefined);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Location Form State
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locLat, setLocLat] = useState(40.7989);
  const [locLon, setLocLon] = useState(-81.3748);
  const [locRadius, setLocRadius] = useState(60);

  // QR Studio State
  const [qrLabel, setQrLabel] = useState('Centennial Plaza Checkpoint QR');
  const [qrTargetQuestId, setQrTargetQuestId] = useState('');

  // Submission Review State
  const [feedbackInput, setFeedbackInput] = useState<Record<string, string>>({});
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('pending');

  // Preview Quest Modal
  const [previewQuest, setPreviewQuest] = useState<Quest | null>(null);

  const refreshData = useCallback(() => {
    if (!isAdminAuthenticated) {
      setEvents([]);
      setSelectedEvent(null);
      setQuests([]);
      setTeams([]);
      setReadiness(null);
      setGeneratedQrs([]);
      setLocations([]);
      setSubmissions([]);
      setActivityLog([]);
      return;
    }

    const allEvents = getEvents();
    setEvents(allEvents);
    const activeEvt = selectedEvent || allEvents[0] || null;
    setSelectedEvent(activeEvt);

    if (activeEvt) {
      setQuests(getQuestsForEvent(activeEvt.id));
      setTeams(getTeamLeaderboardForEvent(activeEvt.id));
      setReadiness(getEventReadinessCheck(activeEvt.id));
      setGeneratedQrs(getGeneratedQRs(activeEvt.id));
    }
    setLocations(getLocations());
    setSubmissions(getAllSubmissions());
    setActivityLog(getActivityLog());
  }, [isAdminAuthenticated, selectedEvent]);

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
      });
  }, []);

  useEffect(() => {
    if (isAdminAuthenticated) {
      refreshData();
    }
  }, [isAdminAuthenticated, refreshData]);

  const handleAdminLogin = async (e: React.FormEvent) => {
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

  // Event Wizard Handler
  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim() || !evSlug.trim()) return;

    const newEvt = createEventWizard({
      cityId: 'city-canton-oh',
      title: evTitle.trim(),
      slug: evSlug.trim().toLowerCase().replace(/\s+/g, '-'),
      description: evDesc.trim() || 'Canton Quests Weekend Event',
      status: evStatus,
      currentPhase: 'day_1',
      isPaused: false,
      startTime: evStart ? new Date(evStart).toISOString() : undefined,
      endTime: evEnd ? new Date(evEnd).toISOString() : undefined,
    });

    notify(`Event "${newEvt.title}" created successfully!`);
    setSelectedEvent(newEvt);
    setEvTitle('');
    setEvSlug('');
    refreshData();
  };

  // Event Duplication Handler
  const handleDuplicateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !dupTitle.trim() || !dupSlug.trim()) return;

    const dupRes = duplicateEvent(selectedEvent.id, dupTitle, dupSlug);
    notify(`Event duplicated! Created "${dupRes.newEvent.title}" with ${dupRes.duplicatedQuestsCount} quests.`);
    setSelectedEvent(dupRes.newEvent);
    refreshData();
  };

  // Template Prefill Handler
  const handleApplyTemplate = (tmplId: string) => {
    setSelectedTemplate(tmplId);
    const tmpl = getQuestTemplates().find((t) => t.id === tmplId);
    if (!tmpl) return;

    if (tmpl.preset.category) setQCategory(tmpl.preset.category);
    if (tmpl.preset.verificationType) setQProofType(tmpl.preset.verificationType);
    if (tmpl.preset.pointValue) setQPoints(tmpl.preset.pointValue);
    if (tmpl.preset.proofRequirement) setQInst(tmpl.preset.proofRequirement);
    if (tmpl.preset.targetCode) setQTargetCode(tmpl.preset.targetCode);
    notify(`Template "${tmpl.name}" pre-filled!`);
  };

  // Create Quest Handler
  const handleCreateQuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !qTitle.trim()) return;

    const slug = qSlug.trim() || qTitle.trim().toLowerCase().replace(/\s+/g, '-');
    const newQ = createQuest({
      eventId: selectedEvent.id,
      locationId: qLocationId || undefined,
      location: locations.find((l) => l.id === qLocationId),
      title: qTitle.trim(),
      slug,
      description: qDesc.trim() || qTitle.trim(),
      instructions: qInst.trim() || 'Follow instructions to complete this quest.',
      pointValue: qPoints,
      difficulty: qPoints > 300 ? 'hard' : qPoints > 100 ? 'medium' : 'easy',
      category: qCategory,
      verificationType: qProofType,
      targetCode: qTargetCode.trim() || undefined,
      proofRequirement: qInst.trim() || 'Submit required proof.',
      isFlash: qCategory === 'flash',
      status: 'active',
      sortOrder: quests.length + 1,
      radiusMeters: 60,
      prerequisiteQuestId: qPrereqId || undefined,
      claimLimit: qClaimLimit,
    });

    notify(`Quest "${newQ.title}" created in Event Factory!`);
    setQTitle('');
    setQSlug('');
    setQDesc('');
    setQInst('');
    setQTargetCode('');
    refreshData();
  };

  // Location Create Handler
  const handleCreateLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locName.trim()) return;

    const newLoc = createLocation({
      cityId: 'city-canton-oh',
      name: locName.trim(),
      address: locAddress.trim() || 'Downtown Canton, OH',
      latitude: locLat,
      longitude: locLon,
      isPartner: false,
      radiusMeters: locRadius,
    });

    notify(`Location "${newLoc.name}" added to Canton Map!`);
    setLocName('');
    setLocAddress('');
    refreshData();
  };

  // Generate QR Token Handler
  const handleGenerateQR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !qrTargetQuestId) return;

    const targetQuest = quests.find((q) => q.id === qrTargetQuestId);
    const newQr = generateQRCodeToken(
      selectedEvent.id,
      'quest',
      targetQuest?.id || qrTargetQuestId,
      qrLabel || targetQuest?.title || 'Quest QR'
    );

    notify(`Generated QR Token: ${newQr.token}`);
    setQrLabel('');
    refreshData();
  };

  // Duplicate Quest Handler
  const handleDuplicateQuest = (questId: string) => {
    const dup = duplicateQuest(questId);
    if (dup) {
      notify(`Duplicated quest "${dup.title}"!`);
      refreshData();
    }
  };

  // Review Handler
  const handleReview = (subId: string, status: 'verified' | 'rejected' | 'retry_requested') => {
    const fb = feedbackInput[subId] || '';
    reviewSubmission(subId, status, fb);
    notify(`Submission Status Updated to ${status.toUpperCase()}`);
    refreshData();
  };

  // Render Passphrase Login Lock Screen if unauthorized
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-obsidian text-white flex flex-col justify-center items-center p-4 font-mono">
        <div className="glass-panel p-8 max-w-md w-full border-amber-500/40 glow-amber text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-3xl mx-auto shadow-lg">
            🔐
          </div>
          <h1 className="text-xl font-bold text-white uppercase">Game Master Authentication</h1>
          <p className="text-xs text-gray-300">
            Enter authorized Game Master secret key to access Event Factory and Field Control.
          </p>

          <form onSubmit={handleAdminLogin} className="space-y-3 pt-2">
            <input
              type="password"
              value={adminPassphrase}
              onChange={(e) => setAdminPassphrase(e.target.value)}
              placeholder="Enter Game Master Passphrase"
              className="input-field text-center tracking-wider font-bold"
              required
            />
            {authError && <div className="text-red-400 text-xs font-bold">{authError}</div>}
            <button type="submit" className="btn btn-primary w-full py-2.5 text-xs font-bold">
              🔓 UNLOCK CONTROL ROOM
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredSubmissions = submissions.filter((s) => {
    if (submissionFilter === 'all') return true;
    return s.status === submissionFilter;
  });

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col font-mono text-xs">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Game Master Control Room Banner */}
        <div className="glass-panel p-5 md:p-6 border-amber-500/40 glow-amber relative space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="badge badge-medium bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono">
                👑 EVENT FACTORY & QUEST STUDIO
              </span>
              {selectedEvent && (
                <span className="text-xs text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-800/40 font-bold uppercase">
                  ● {selectedEvent.status}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin/live"
                className="bg-red-950/80 hover:bg-red-900 text-red-200 px-3 py-1.5 rounded-xl border border-red-700 font-bold flex items-center gap-1.5"
              >
                ⚡ Live Director Room
              </Link>
              {selectedEvent && (
                <Link
                  href={`/events/${selectedEvent.slug}`}
                  target="_blank"
                  className="bg-gray-800 hover:bg-gray-700 text-cyan-400 px-3 py-1.5 rounded-xl border border-gray-700 font-bold"
                >
                  👁️ View Player Page
                </Link>
              )}
            </div>
          </div>

          {actionMessage && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-500 text-emerald-300 font-bold rounded-xl animate-fade-in">
              ✅ {actionMessage}
            </div>
          )}

          {/* Active Event Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-bold">Selected Event:</span>
              <select
                value={selectedEvent?.id || ''}
                onChange={(e) => {
                  const ev = events.find((evt) => evt.id === e.target.value);
                  if (ev) setSelectedEvent(ev);
                }}
                className="bg-card text-amber-400 font-bold border border-gray-800 rounded-xl px-3 py-1.5"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({ev.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {readiness && (
              <div
                className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 border ${
                  readiness.isReady
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                    : 'bg-amber-950/60 border-amber-500 text-amber-300'
                }`}
              >
                <span>{readiness.isReady ? '✅ READY FOR PUBLISH' : '⚠️ READINESS ISSUES'}</span>
              </div>
            )}
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-[var(--border-subtle)] font-bold overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: '📊 Overview' },
            { id: 'readiness', label: '📋 Pre-Launch Check' },
            { id: 'events', label: '🏭 Event Wizard' },
            { id: 'quests', label: '🎨 Quest Studio' },
            { id: 'locations', label: '📍 Locations' },
            { id: 'qr', label: '📱 QR Studio' },
            { id: 'submissions', label: `📥 Proof Queue (${submissions.filter((s) => s.status === 'pending').length})` },
            { id: 'teams', label: '👥 Squad Roster' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-4 whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-amber-400 text-amber-400 font-extrabold'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && selectedEvent && (
          <section className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-card p-4 text-center border-amber-500/30">
                <span className="text-gray-400 block text-[10px] uppercase">Event Quests</span>
                <span className="text-amber-400 font-extrabold text-2xl">{quests.length}</span>
              </div>
              <div className="glass-card p-4 text-center">
                <span className="text-gray-400 block text-[10px] uppercase">Pending Reviews</span>
                <span className="text-emerald-400 font-extrabold text-2xl">
                  {submissions.filter((s) => s.status === 'pending').length}
                </span>
              </div>
              <div className="glass-card p-4 text-center">
                <span className="text-gray-400 block text-[10px] uppercase">Active Squads</span>
                <span className="text-cyan-400 font-extrabold text-2xl">{teams.length}</span>
              </div>
              <div className="glass-card p-4 text-center">
                <span className="text-gray-400 block text-[10px] uppercase">Generated QRs</span>
                <span className="text-purple-400 font-extrabold text-2xl">{generatedQrs.length}</span>
              </div>
            </div>

            {/* Quick Actions Shortcuts */}
            <div className="glass-panel p-5 space-y-3 border-gray-800">
              <h2 className="text-sm font-bold text-white uppercase">⚡ Quick Launch Shortcuts</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => triggerFlashQuest(quests[0]?.id || '', 30)}
                  className="btn btn-primary text-xs py-2 px-4 font-bold"
                >
                  ⚡ Trigger Flash Drop (30m)
                </button>
                <button
                  onClick={() => updateEventStatus(selectedEvent.id, selectedEvent.status === 'active' ? 'ended' : 'active')}
                  className="btn btn-secondary text-xs py-2 px-4 font-bold"
                >
                  🔄 Toggle Event Status ({selectedEvent.status.toUpperCase()})
                </button>
              </div>
            </div>
          </section>
        )}

        {/* TAB 2: EVENT READINESS CHECK & METRICS */}
        {activeTab === 'readiness' && readiness && (
          <section className="glass-panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                📋 Event Pre-Launch Readiness Check
              </h2>
              <span
                className={`px-3 py-1 rounded-full font-bold text-xs ${
                  readiness.isReady ? 'bg-emerald-950 border border-emerald-500 text-emerald-300' : 'bg-amber-950 border border-amber-500 text-amber-300'
                }`}
              >
                {readiness.isReady ? '✅ PASSED — READY FOR PUBLISH' : '⚠️ BLOCKERS DETECTED'}
              </span>
            </div>

            {/* Blockers & Warnings */}
            {readiness.blockers.length > 0 && (
              <div className="p-4 bg-red-950/50 border border-red-500 rounded-xl space-y-1 text-red-200">
                <span className="font-bold text-red-400 block">🛑 Launch Blockers:</span>
                <ul className="list-disc pl-5 space-y-1">
                  {readiness.blockers.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            {readiness.warnings.length > 0 && (
              <div className="p-4 bg-amber-950/50 border border-amber-500 rounded-xl space-y-1 text-amber-200">
                <span className="font-bold text-amber-400 block">⚠️ Optimization Warnings:</span>
                <ul className="list-disc pl-5 space-y-1">
                  {readiness.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Event Design Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-obsidian p-3 rounded-xl border border-gray-800">
                <span className="text-gray-400 block text-[10px] uppercase">Total Event XP</span>
                <span className="text-amber-400 font-extrabold text-lg">{readiness.metrics.totalXp} XP</span>
              </div>
              <div className="bg-obsidian p-3 rounded-xl border border-gray-800">
                <span className="text-gray-400 block text-[10px] uppercase">Secret Quests</span>
                <span className="text-cyan-400 font-extrabold text-lg">{readiness.metrics.secretCount}</span>
              </div>
              <div className="bg-obsidian p-3 rounded-xl border border-gray-800">
                <span className="text-gray-400 block text-[10px] uppercase">Quest Chains</span>
                <span className="text-purple-400 font-extrabold text-lg">{readiness.metrics.chainCount}</span>
              </div>
              <div className="bg-obsidian p-3 rounded-xl border border-gray-800">
                <span className="text-gray-400 block text-[10px] uppercase">Time-Locked XP</span>
                <span className="text-emerald-400 font-extrabold text-lg">{readiness.metrics.timeLockedXpPercentage}%</span>
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: EVENT WIZARD & DUPLICATION */}
        {activeTab === 'events' && (
          <section className="space-y-6">
            {/* Create Event Form */}
            <div className="glass-panel p-6 space-y-4">
              <h2 className="text-base font-bold text-white">🏭 Create New Canton Event (Event Factory)</h2>
              <form onSubmit={handleCreateEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 block mb-1">Event Title</label>
                  <input
                    type="text"
                    value={evTitle}
                    onChange={(e) => {
                      setEvTitle(e.target.value);
                      setEvSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                    }}
                    placeholder="e.g. Canton Quest Weekend #2 — The Art Cipher"
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">URL Slug</label>
                  <input
                    type="text"
                    value={evSlug}
                    onChange={(e) => setEvSlug(e.target.value)}
                    placeholder="canton-weekend-2"
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Event Start Time (Editable)</label>
                  <input
                    type="datetime-local"
                    value={evStart}
                    onChange={(e) => setEvStart(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Event End Time (Editable)</label>
                  <input
                    type="datetime-local"
                    value={evEnd}
                    onChange={(e) => setEvEnd(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-gray-400 block mb-1">Description</label>
                  <textarea
                    value={evDesc}
                    onChange={(e) => setEvDesc(e.target.value)}
                    placeholder="Explore Canton landmarks, crack ciphers, and top the squad leaderboard."
                    className="input-field h-20"
                  />
                </div>

                <div className="md:col-span-2 flex gap-2">
                  <button type="submit" className="btn btn-primary text-xs py-2.5 px-5 font-bold flex-1">
                    🚀 CREATE EVENT
                  </button>
                </div>
              </form>
            </div>

            {/* 1-Click Event Duplication Form */}
            {selectedEvent && (
              <div className="glass-panel p-6 space-y-4 border-cyan-500/40">
                <h2 className="text-base font-bold text-white">📋 Duplicate Existing Event Template</h2>
                <p className="text-xs text-gray-300">
                  Duplicates &quot;{selectedEvent.title}&quot; quests, locations, and chains as a clean template for a new weekend.
                </p>

                <form onSubmit={handleDuplicateEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 block mb-1">New Event Title</label>
                    <input
                      type="text"
                      value={dupTitle}
                      onChange={(e) => {
                        setDupTitle(e.target.value);
                        setDupSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                      }}
                      className="input-field"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 block mb-1">New URL Slug</label>
                    <input
                      type="text"
                      value={dupSlug}
                      onChange={(e) => setDupSlug(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <button type="submit" className="btn btn-cyan text-xs py-2.5 px-5 font-bold w-full">
                      📋 DUPLICATE EVENT AS TEMPLATE
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        {/* TAB 4: QUEST STUDIO */}
        {activeTab === 'quests' && selectedEvent && (
          <section className="space-y-6">
            {/* Create Quest Form */}
            <div className="glass-panel p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
                <h2 className="text-base font-bold text-white">🎨 Visual Quest Studio</h2>

                {/* Preset Templates */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Preset Template:</span>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleApplyTemplate(e.target.value)}
                    className="bg-card text-amber-400 font-bold border border-gray-800 rounded-lg px-2.5 py-1"
                  >
                    <option value="">-- Choose Preset --</option>
                    {getQuestTemplates().map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <form onSubmit={handleCreateQuest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 block mb-1">Quest Title</label>
                  <input
                    type="text"
                    value={qTitle}
                    onChange={(e) => {
                      setQTitle(e.target.value);
                      setQSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                    }}
                    placeholder="e.g. Centennial Plaza Beacon Check-In"
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">URL Slug</label>
                  <input
                    type="text"
                    value={qSlug}
                    onChange={(e) => setQSlug(e.target.value)}
                    placeholder="centennial-beacon"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Verification Type</label>
                  <select
                    value={qProofType}
                    onChange={(e) => setQProofType(e.target.value as any)}
                    className="input-field"
                  >
                    <option value="checkin">GPS Proximity Check-In</option>
                    <option value="passphrase">Passphrase Code</option>
                    <option value="qr">QR Code Scan</option>
                    <option value="photo">Photo Proof</option>
                    <option value="video">Video Proof</option>
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">XP Point Value</label>
                  <input
                    type="number"
                    value={qPoints}
                    onChange={(e) => setQPoints(Number(e.target.value))}
                    className="input-field font-bold text-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Target Passphrase / QR Token</label>
                  <input
                    type="text"
                    value={qTargetCode}
                    onChange={(e) => setQTargetCode(e.target.value)}
                    placeholder="e.g. 1897 or AURA-BREW-2026"
                    className="input-field font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Target Location</label>
                  <select
                    value={qLocationId}
                    onChange={(e) => setQLocationId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">-- No Location (Virtual) --</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Prerequisite Quest (Chain Step)</label>
                  <select
                    value={qPrereqId}
                    onChange={(e) => setQPrereqId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">-- No Prerequisite (Available Immediately) --</option>
                    {quests.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Claim Capacity Limit (Optional)</label>
                  <input
                    type="number"
                    value={qClaimLimit || ''}
                    onChange={(e) => setQClaimLimit(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g. 10 claims max"
                    className="input-field"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-gray-400 block mb-1">Player Instructions</label>
                  <textarea
                    value={qInst}
                    onChange={(e) => setQInst(e.target.value)}
                    placeholder="e.g. Stand within 60m of Centennial Plaza screen and tap check-in scanner."
                    className="input-field h-20"
                  />
                </div>

                <div className="md:col-span-2">
                  <button type="submit" className="btn btn-primary text-xs py-2.5 px-5 font-bold w-full">
                    🎨 PUBLISH QUEST TO EVENT FACTORY
                  </button>
                </div>
              </form>
            </div>

            {/* Published Quests Grid */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase">Published Event Quests ({quests.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quests.map((q) => (
                  <div key={q.id} className="p-4 bg-obsidian border border-gray-800 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{q.title}</span>
                      <span className="text-amber-400 font-bold">+{q.pointValue} XP</span>
                    </div>
                    <div className="text-gray-400 text-[11px]">{q.instructions}</div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => handleDuplicateQuest(q.id)}
                        className="text-[11px] text-cyan-400 hover:underline font-bold"
                      >
                        📋 Duplicate
                      </button>
                      <button
                        onClick={() => setPreviewQuest(q)}
                        className="text-[11px] text-amber-400 hover:underline font-bold"
                      >
                        👁️ Preview as Player
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* TAB 5: LOCATION MANAGER */}
        {activeTab === 'locations' && (
          <section className="space-y-6">
            <div className="glass-panel p-6 space-y-4">
              <h2 className="text-base font-bold text-white">📍 Canton Location Manager</h2>
              <form onSubmit={handleCreateLocation} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 block mb-1">Place Name</label>
                  <input
                    type="text"
                    value={locName}
                    onChange={(e) => setLocName(e.target.value)}
                    placeholder="e.g. Market Square Pavilion"
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Street Address</label>
                  <input
                    type="text"
                    value={locAddress}
                    onChange={(e) => setLocAddress(e.target.value)}
                    placeholder="330 Market Ave N, Canton, OH 44702"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={locLat}
                    onChange={(e) => setLocLat(Number(e.target.value))}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={locLon}
                    onChange={(e) => setLocLon(Number(e.target.value))}
                    className="input-field"
                  />
                </div>

                <div className="md:col-span-2">
                  <button type="submit" className="btn btn-primary text-xs py-2.5 px-5 font-bold w-full">
                    📍 SAVE LOCATION TO CANTON MAP
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* TAB 6: QR CODE STUDIO */}
        {activeTab === 'qr' && selectedEvent && (
          <section className="space-y-6">
            <div className="glass-panel p-6 space-y-4">
              <h2 className="text-base font-bold text-white">📱 QR Code Token Studio</h2>
              <form onSubmit={handleGenerateQR} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 block mb-1">Select Target Quest</label>
                  <select
                    value={qrTargetQuestId}
                    onChange={(e) => setQrTargetQuestId(e.target.value)}
                    className="input-field text-xs"
                    required
                  >
                    <option value="">-- Select Quest --</option>
                    {quests.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Internal Printable Label</label>
                  <input
                    type="text"
                    value={qrLabel}
                    onChange={(e) => setQrLabel(e.target.value)}
                    placeholder="e.g. Aura Coffee Counter Sticker"
                    className="input-field text-xs"
                  />
                </div>

                <div className="md:col-span-2">
                  <button type="submit" className="btn btn-cyan text-xs py-2.5 px-5 font-bold w-full">
                    📱 GENERATE QR TOKEN CODE
                  </button>
                </div>
              </form>
            </div>

            {/* Generated QR Tokens List */}
            <div className="glass-panel p-5 space-y-3">
              <h3 className="text-sm font-bold text-white uppercase">Generated QR Tokens ({generatedQrs.length})</h3>
              <div className="space-y-2">
                {generatedQrs.map((qr) => (
                  <div key={qr.id} className="p-3 bg-obsidian border border-gray-800 rounded-xl flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="font-bold text-cyan-400">{qr.label}</span>
                      <span className="text-gray-400 block text-[11px]">{qr.targetUrl}</span>
                    </div>
                    <span className="text-amber-400 font-bold">{qr.token}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* TAB 7: PROOF REVIEW CENTER & FLAGS */}
        {activeTab === 'submissions' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between bg-obsidian p-3 rounded-xl border border-gray-800">
              <span className="text-white font-bold">Filter Proofs:</span>
              <div className="flex gap-2">
                {['pending', 'verified', 'rejected', 'all'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setSubmissionFilter(st as any)}
                    className={`px-3 py-1 rounded-full uppercase text-[11px] font-bold border ${
                      submissionFilter === st ? 'bg-amber-500 text-obsidian border-amber-400' : 'bg-card text-gray-300 border-gray-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="glass-panel p-8 text-center text-gray-400">No submissions found matching filter.</div>
            ) : (
              <div className="space-y-3">
                {filteredSubmissions.map((sub) => (
                  <div key={sub.id} className="p-4 bg-obsidian border border-gray-800 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">Proof #{sub.id.slice(-6)}</span>
                      <span className={`px-2 py-0.5 rounded font-bold uppercase ${sub.status === 'verified' ? 'bg-emerald-950 text-emerald-300' : sub.status === 'rejected' ? 'bg-red-950 text-red-300' : 'bg-amber-950 text-amber-300'}`}>
                        {sub.status}
                      </span>
                    </div>

                    {/* Review Flags Badges */}
                    {sub.reviewFlags && sub.reviewFlags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {sub.reviewFlags.map((flag, idx) => (
                          <span key={idx} className="bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded text-[10px] font-bold">
                            ⚠️ {flag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-gray-300 text-xs">Proof Content: {sub.submittedContent || sub.proofUrl || 'GPS Check-In'}</div>

                    {sub.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => handleReview(sub.id, 'verified')} className="btn btn-primary text-xs py-1.5 px-3 font-bold">
                          ✅ Approve
                        </button>
                        <button onClick={() => handleReview(sub.id, 'rejected')} className="btn btn-secondary text-xs py-1.5 px-3 font-bold">
                          ❌ Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Preview Quest Modal */}
      {previewQuest && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-obsidian border border-amber-500/40 p-6 rounded-3xl space-y-4 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="badge badge-medium">👁️ PLAYER PREVIEW MODE</span>
              <button onClick={() => setPreviewQuest(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <h3 className="text-lg font-bold text-white">{previewQuest.title}</h3>
            <p className="text-gray-300">{previewQuest.description}</p>
            <div className="p-3 bg-card border border-gray-800 rounded-xl space-y-1">
              <span className="text-amber-400 font-bold block">Instructions:</span>
              <div className="text-gray-300">{previewQuest.instructions}</div>
            </div>
            <div className="text-amber-400 font-extrabold text-sm">Value: +{previewQuest.pointValue} XP</div>
            <button onClick={() => setPreviewQuest(null)} className="btn btn-secondary w-full py-2">Close Preview</button>
          </div>
        </div>
      )}
    </div>
  );
}
