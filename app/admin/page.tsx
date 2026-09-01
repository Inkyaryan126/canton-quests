'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity, AlertTriangle, BarChart2, CheckCircle2, ChevronRight, Compass,
  FileCheck, Globe, KeyRound, Layers, MapPin, Monitor, QrCode, Radio, Shield,
  Smartphone, Tablet, TrendingUp, Users, Zap,
} from 'lucide-react';
import CinematicNav from '@/components/CinematicNav';
import { GAME_MASTER_DISPLAY_NAME, getGameMasterGreeting } from '@/lib/admin-persona';
import {
  QuestEvent,
  Quest,
  QuestSubmission,
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
  const [activityLog, setActivityLog] = useState<EventActivityItem[]>([]);
  const [generatedQrs, setGeneratedQrs] = useState<GeneratedQR[]>([]);

  // Navigation & Active Tab State
  const [activeTab, setActiveTab] = useState<
    'overview' | 'readiness' | 'events' | 'quests' | 'locations' | 'qr' | 'submissions' | 'visitors'
  >('overview');

  // Action Notification State
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Event Wizard State
  const [evTitle, setEvTitle] = useState('');
  const [evSlug, setEvSlug] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evStatus, setEvStatus] = useState<QuestEvent['status']>('draft');
  const [evStart, setEvStart] = useState('2026-09-11T18:00');
  const [evEnd, setEvEnd] = useState('2026-09-14T22:00');

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

  // Site Stats
  const [siteStats, setSiteStats] = useState({ totalPlayers: 0, activeSpectators: 0, pendingSubmissions: 0, verifiedSubmissions: 0, totalSubmissions: 0 });

  // Visitor Analytics
  type VisitorData = {
    totalVisits: number;
    uniqueVisitors: number;
    todayVisits: number;
    visitsByDay: { date: string; count: number }[];
    topCountries: { code: string; name: string; count: number }[];
    topCities: { city: string; country: string; count: number }[];
    topPages: { page: string; count: number }[];
    deviceBreakdown: { type: string; count: number }[];
    topReferrers: { source: string; count: number }[];
    recentVisits: { city: string | null; country: string; countryCode: string | null; page: string; device: string; visitedAt: string }[];
    error?: string;
  };
  const [visitorRange, setVisitorRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [visitorData, setVisitorData] = useState<VisitorData | null>(null);
  const [visitorLoading, setVisitorLoading] = useState(false);

  // First-party human traffic analytics (site_visit_events)
  type LiveAnalyticsData = {
    period: '1h' | '2h' | '6h' | '24h' | '7d';
    periods: readonly string[];
    generatedAt: string;
    rightNow: { uniqueVisitors: number; pageViews: number; sessions: number; authenticatedPlayers: number };
    today: { uniqueVisitors: number; pageViews: number; sessions: number; authenticatedPlayers: number; newVisitors: number; returningVisitors: number };
    traffic: {
      hourly: { hour: string; uniqueVisitors: number; pageViews: number }[];
      topPages: { value: string; count: number }[];
      topReferrers: { value: string; count: number }[];
      topCampaigns: { value: string; count: number }[];
    };
    error?: string;
  };
  const ANALYTICS_PERIOD_OPTIONS = ['1h', '2h', '6h', '24h', '7d'] as const;
  const [analyticsPeriod, setAnalyticsPeriod] = useState<(typeof ANALYTICS_PERIOD_OPTIONS)[number]>('2h');
  const [liveAnalytics, setLiveAnalytics] = useState<LiveAnalyticsData | null>(null);
  const [liveAnalyticsLoading, setLiveAnalyticsLoading] = useState(false);

  const refreshData = useCallback(() => {
    if (!isAdminAuthenticated) {
      setEvents([]);
      setSelectedEvent(null);
      setQuests([]);
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

  useEffect(() => {
    if (!isAdminAuthenticated) return;
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((d) => {
        if (d.totalPlayers !== undefined) setSiteStats(d);
      })
      .catch(() => {});
    const iv = setInterval(() => {
      fetch('/api/admin/stats').then((r) => r.json()).then((d) => { if (d.totalPlayers !== undefined) setSiteStats(d); }).catch(() => {});
    }, 15000);
    return () => clearInterval(iv);
  }, [isAdminAuthenticated]);

  useEffect(() => {
    if (!isAdminAuthenticated || activeTab !== 'visitors') return;
    setVisitorLoading(true);
    fetch(`/api/admin/visitors?range=${visitorRange}`)
      .then((r) => r.json())
      .then((d) => setVisitorData(d))
      .catch(() => setVisitorData(null))
      .finally(() => setVisitorLoading(false));
  }, [isAdminAuthenticated, activeTab, visitorRange]);

  useEffect(() => {
    if (!isAdminAuthenticated || activeTab !== 'visitors') return;
    const loadLiveAnalytics = () => {
      setLiveAnalyticsLoading(true);
      fetch(`/api/admin/analytics?period=${analyticsPeriod}`)
        .then((r) => r.json())
        .then((d) => setLiveAnalytics(d))
        .catch(() => setLiveAnalytics(null))
        .finally(() => setLiveAnalyticsLoading(false));
    };
    loadLiveAnalytics();
    const iv = setInterval(loadLiveAnalytics, 30000);
    return () => clearInterval(iv);
  }, [isAdminAuthenticated, activeTab, analyticsPeriod]);

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
      <div className="min-h-screen bg-[#080b10] text-white flex flex-col justify-center items-center p-6 font-mono">
        <div className="w-full max-w-sm space-y-6">
          {/* Logo lockup */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto shadow-xl shadow-amber-900/20">
              <Shield size={26} className="text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-amber-400/70 uppercase tracking-[0.3em] mb-1">Canton Quests</p>
              <h1 className="text-xl font-black text-white uppercase tracking-tight">Command Center</h1>
            </div>
          </div>

          {/* Auth card */}
          <div className="bg-stone-900/80 border border-stone-700/60 rounded-2xl p-6 space-y-4 shadow-2xl">
            <p className="text-xs text-stone-400 text-center">Enter your Game Master passphrase to continue.</p>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <input
                type="password"
                value={adminPassphrase}
                onChange={(e) => setAdminPassphrase(e.target.value)}
                placeholder="Game Master passphrase"
                className="input-field text-center tracking-widest font-bold text-sm"
                autoFocus
                required
              />
              {authError && (
                <div className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} className="shrink-0" />
                  {authError}
                </div>
              )}
              <button type="submit" className="btn btn-primary w-full py-3 text-xs font-bold tracking-widest uppercase">
                Unlock Command Center
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const filteredSubmissions = submissions.filter((s) => {
    if (submissionFilter === 'all') return true;
    return s.status === submissionFilter;
  });

  const pendingCount = submissions.filter((s) => s.status === 'pending').length;

  const TABS = [
    { id: 'overview',    label: 'Overview',      Icon: Activity },
    { id: 'visitors',    label: 'Visitors',       Icon: Globe },
    { id: 'readiness',   label: 'Pre-Launch',     Icon: CheckCircle2 },
    { id: 'events',      label: 'Event Wizard',   Icon: Layers },
    { id: 'quests',      label: 'Quest Studio',   Icon: Compass },
    { id: 'locations',   label: 'Locations',      Icon: MapPin },
    { id: 'qr',          label: 'QR Studio',      Icon: QrCode },
    { id: 'submissions', label: `Proof Queue${pendingCount > 0 ? ` · ${pendingCount}` : ''}`, Icon: FileCheck },
  ] as const;

  return (
    <div className="min-h-screen bg-[#080b10] text-stone-100 font-mono">
      <CinematicNav eventHref="/events" />

      <main className="max-w-7xl mx-auto px-4 md:px-8 pb-20" style={{ paddingTop: '5.6rem' }}>

        {/* ── MASTHEAD ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-7 mb-8 border-b border-stone-800">
          <div>
            <p className="text-[10px] text-amber-400/60 uppercase tracking-[0.3em] mb-1.5">Canton Quests — Command Center</p>
            <h1 className="font-display font-black text-3xl md:text-4xl text-white uppercase tracking-tight">
              {GAME_MASTER_DISPLAY_NAME}
            </h1>
            <p className="text-sm text-stone-400 mt-1.5 max-w-lg">{getGameMasterGreeting()}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedEvent && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider ${
                selectedEvent.status === 'active'
                  ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
                  : selectedEvent.status === 'draft'
                  ? 'bg-amber-950/60 border-amber-700/50 text-amber-300'
                  : 'bg-stone-800/60 border-stone-700 text-stone-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${selectedEvent.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`} />
                {selectedEvent.status.toUpperCase()}
              </span>
            )}
            <select
              value={selectedEvent?.id || ''}
              onChange={(e) => { const ev = events.find((evt) => evt.id === e.target.value); if (ev) setSelectedEvent(ev); }}
              className="bg-stone-900 text-amber-400 font-bold border border-stone-700 rounded-lg px-3 py-1.5 text-xs"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
            {selectedEvent && (
              <Link href={`/events/${selectedEvent.slug}`} target="_blank"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg text-[11px] text-cyan-400 font-bold transition-colors">
                View Live Page <ChevronRight size={12} />
              </Link>
            )}
          </div>
        </div>

        {/* ── SITE STATS ROW ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: 'Registered Agents', value: siteStats.totalPlayers, Icon: Users, color: 'text-cyan-400', border: 'border-cyan-900/60', glow: 'bg-cyan-950/20' },
            { label: 'Live Spectators', value: siteStats.activeSpectators, Icon: Radio, color: 'text-emerald-400', border: 'border-emerald-900/60', glow: 'bg-emerald-950/20' },
            { label: 'Event Quests', value: quests.length, Icon: Compass, color: 'text-amber-400', border: 'border-amber-900/60', glow: 'bg-amber-950/20' },
            { label: 'Pending Proofs', value: pendingCount, Icon: FileCheck, color: pendingCount > 0 ? 'text-red-400' : 'text-stone-500', border: pendingCount > 0 ? 'border-red-900/60' : 'border-stone-800', glow: pendingCount > 0 ? 'bg-red-950/20' : 'bg-stone-900/40' },
            { label: 'Map Locations', value: locations.length, Icon: MapPin, color: 'text-purple-400', border: 'border-purple-900/60', glow: 'bg-purple-950/20' },
            { label: 'QR Tokens', value: generatedQrs.length, Icon: QrCode, color: 'text-sky-400', border: 'border-sky-900/60', glow: 'bg-sky-950/20' },
          ].map(({ label, value, Icon, color, border, glow }) => (
            <div key={label} className={`${glow} border ${border} rounded-xl p-4 space-y-2`}>
              <div className="flex items-center justify-between">
                <Icon size={15} className={`${color} opacity-70`} />
              </div>
              <p className={`font-black text-3xl ${color}`}>{value}</p>
              <p className="text-[10px] text-stone-500 uppercase tracking-wider leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* ── ACTION NOTIFICATION ──────────────────────────────────────────── */}
        {actionMessage && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 font-bold rounded-xl text-xs">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            {actionMessage}
          </div>
        )}

        {/* ── QUICK ACCESS CARDS ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/admin/live"
            className="group flex items-start gap-4 p-5 bg-stone-900/60 hover:bg-stone-900 border border-red-900/50 hover:border-red-700/60 rounded-2xl transition-all">
            <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/50 flex items-center justify-center shrink-0">
              <Radio size={18} className="text-red-400" />
            </div>
            <div>
              <p className="font-bold text-white text-sm group-hover:text-red-300 transition-colors">Live Event Control</p>
              <p className="text-stone-500 text-xs mt-0.5 leading-relaxed">Audience votes, host broadcasts, freezes &amp; field effects</p>
            </div>
          </Link>

          <Link href="/admin/drawing"
            className="group flex items-start gap-4 p-5 bg-stone-900/60 hover:bg-stone-900 border border-amber-900/50 hover:border-amber-700/60 rounded-2xl transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800/50 flex items-center justify-center shrink-0">
              <Zap size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">Prize Drawing</p>
              <p className="text-stone-500 text-xs mt-0.5 leading-relaxed">Lock ledgers, execute transparent draws, publish winners</p>
            </div>
          </Link>

          <Link href="/admin/qr-campaigns"
            className="group flex items-start gap-4 p-5 bg-stone-900/60 hover:bg-stone-900 border border-cyan-900/50 hover:border-cyan-700/60 rounded-2xl transition-all">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center shrink-0">
              <QrCode size={18} className="text-cyan-400" />
            </div>
            <div>
              <p className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">QR Campaigns</p>
              <p className="text-stone-500 text-xs mt-0.5 leading-relaxed">Generate flyer &amp; distributor attribution for field promotion</p>
            </div>
          </Link>
        </div>

        {/* ── TABBED WORKSPACE ─────────────────────────────────────────────── */}
        <div className="border border-stone-800 rounded-2xl overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-stone-800 bg-stone-950 overflow-x-auto scrollbar-none">
            {TABS.map(({ id, label, Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center gap-2 py-3.5 px-5 whitespace-nowrap border-b-2 text-xs font-bold transition-all ${
                    isActive
                      ? 'border-amber-400 text-amber-300 bg-stone-900/50'
                      : 'border-transparent text-stone-500 hover:text-stone-300 hover:bg-stone-900/30'
                  }`}
                >
                  <Icon size={13} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="p-6 md:p-8 bg-stone-900/30 space-y-8">

            {/* ── VISITORS ── */}
            {activeTab === 'visitors' && (
              <div className="space-y-8">

                {/* ── Live Traffic (site_visit_events — first-party human analytics) ── */}
                <div className="space-y-6 pb-8 border-b border-stone-800">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-[10px] text-stone-500 uppercase tracking-widest mb-1">First-Party Analytics</p>
                      <h2 className="text-lg font-black text-white uppercase tracking-tight">Live Traffic</h2>
                    </div>
                    <div className="flex gap-1.5 bg-stone-950 border border-stone-800 rounded-xl p-1">
                      {ANALYTICS_PERIOD_OPTIONS.map((p) => (
                        <button
                          key={p}
                          onClick={() => setAnalyticsPeriod(p)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                            analyticsPeriod === p ? 'bg-amber-500 text-black' : 'text-stone-400 hover:text-white'
                          }`}
                        >
                          {p.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {liveAnalyticsLoading && !liveAnalytics && (
                    <div className="flex items-center justify-center py-16">
                      <div className="flex items-center gap-3 text-stone-400">
                        <Activity size={18} className="animate-spin" />
                        <span className="text-sm font-mono">Loading live traffic...</span>
                      </div>
                    </div>
                  )}

                  {!liveAnalyticsLoading && liveAnalytics?.error === 'table_missing' && (
                    <div className="p-6 bg-amber-950/40 border border-amber-700/50 rounded-2xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-300 mb-1">site_visit_events table not yet created</p>
                          <p className="text-sm text-stone-400">Run the migration <code className="text-emerald-300">supabase/migrations/20260901000000_site_visit_events_analytics.sql</code> against your Supabase project.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!liveAnalyticsLoading && liveAnalytics?.error === 'no_db' && (
                    <div className="p-6 bg-stone-900 border border-stone-700 rounded-2xl text-center">
                      <Radio size={32} className="text-stone-600 mx-auto mb-2" />
                      <p className="text-stone-400 text-sm">Supabase is not configured. Live traffic requires a live database.</p>
                    </div>
                  )}

                  {liveAnalytics && !liveAnalytics.error && (
                    <div className="space-y-6">
                      {/* RIGHT NOW */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Zap size={13} className="text-amber-400" />
                          <p className="text-[11px] text-stone-400 uppercase tracking-widest font-bold">
                            Right Now &middot; last {analyticsPeriod.toUpperCase()}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: 'Unique Visitors', value: liveAnalytics.rightNow.uniqueVisitors, Icon: Users, color: 'text-cyan-400' },
                            { label: 'Page Views', value: liveAnalytics.rightNow.pageViews, Icon: TrendingUp, color: 'text-amber-400' },
                            { label: 'Sessions', value: liveAnalytics.rightNow.sessions, Icon: Radio, color: 'text-emerald-400' },
                            { label: 'Authenticated Players', value: liveAnalytics.rightNow.authenticatedPlayers, Icon: Shield, color: 'text-purple-400' },
                          ].map(({ label, value, Icon, color }) => (
                            <div key={label} className="p-4 bg-stone-950/60 border border-stone-800 rounded-2xl">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] text-stone-500 uppercase tracking-widest">{label}</p>
                                <Icon size={14} className={color} />
                              </div>
                              <p className={`font-black text-2xl ${color}`}>{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* TODAY */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Compass size={13} className="text-amber-400" />
                          <p className="text-[11px] text-stone-400 uppercase tracking-widest font-bold">Today</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                          {[
                            { label: 'Unique Visitors', value: liveAnalytics.today.uniqueVisitors, color: 'text-cyan-400' },
                            { label: 'Page Views', value: liveAnalytics.today.pageViews, color: 'text-amber-400' },
                            { label: 'Sessions', value: liveAnalytics.today.sessions, color: 'text-emerald-400' },
                            { label: 'Authenticated', value: liveAnalytics.today.authenticatedPlayers, color: 'text-purple-400' },
                            { label: 'New Visitors', value: liveAnalytics.today.newVisitors, color: 'text-lime-400' },
                            { label: 'Returning', value: liveAnalytics.today.returningVisitors, color: 'text-orange-400' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="p-4 bg-stone-950/60 border border-stone-800 rounded-2xl">
                              <p className="text-[10px] text-stone-500 uppercase tracking-widest mb-2">{label}</p>
                              <p className={`font-black text-xl ${color}`}>{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* TRAFFIC */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="p-5 bg-stone-950/60 border border-stone-800 rounded-2xl lg:col-span-2">
                          <div className="flex items-center gap-2 mb-4">
                            <BarChart2 size={14} className="text-amber-400" />
                            <p className="text-[11px] text-stone-400 uppercase tracking-widest font-bold">Hourly Traffic &middot; Last 24H</p>
                          </div>
                          {liveAnalytics.traffic.hourly.length === 0 ? (
                            <p className="text-sm text-stone-500">No human traffic recorded in the last 24 hours.</p>
                          ) : (
                            (() => {
                              const max = Math.max(...liveAnalytics.traffic.hourly.map((h) => h.uniqueVisitors), 1);
                              return (
                                <div className="flex items-end gap-1 h-28 overflow-x-auto pb-2">
                                  {liveAnalytics.traffic.hourly.map(({ hour, uniqueVisitors }) => {
                                    const heightPct = Math.max((uniqueVisitors / max) * 100, uniqueVisitors > 0 ? 4 : 0);
                                    const label = new Date(hour).toLocaleTimeString(undefined, { hour: 'numeric' });
                                    return (
                                      <div key={hour} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 22 }}>
                                        <div
                                          className="w-3.5 rounded-t bg-amber-500/70"
                                          style={{ height: `${heightPct}%`, minHeight: uniqueVisitors > 0 ? 2 : 0 }}
                                          title={`${label}: ${uniqueVisitors} visitor(s)`}
                                        />
                                        <span className="text-[8px] text-stone-600 rotate-0">{label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()
                          )}
                        </div>

                        <div className="p-5 bg-stone-950/60 border border-stone-800 rounded-2xl">
                          <p className="text-[11px] text-stone-400 uppercase tracking-widest font-bold mb-3">Top Pages</p>
                          {liveAnalytics.traffic.topPages.length === 0 ? (
                            <p className="text-sm text-stone-500">No page views yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {liveAnalytics.traffic.topPages.map(({ value, count }) => (
                                <div key={value} className="flex items-center justify-between text-xs">
                                  <span className="text-stone-300 font-mono truncate mr-3">{value}</span>
                                  <span className="text-amber-400 font-bold shrink-0">{count}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="p-5 bg-stone-950/60 border border-stone-800 rounded-2xl">
                          <p className="text-[11px] text-stone-400 uppercase tracking-widest font-bold mb-3">Top Referrers</p>
                          {liveAnalytics.traffic.topReferrers.length === 0 ? (
                            <p className="text-sm text-stone-500">No referrer data yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {liveAnalytics.traffic.topReferrers.map(({ value, count }) => (
                                <div key={value} className="flex items-center justify-between text-xs">
                                  <span className="text-stone-300 font-mono truncate mr-3">{value}</span>
                                  <span className="text-cyan-400 font-bold shrink-0">{count}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {liveAnalytics.traffic.topCampaigns.length > 0 && (
                          <div className="p-5 bg-stone-950/60 border border-stone-800 rounded-2xl lg:col-span-2">
                            <p className="text-[11px] text-stone-400 uppercase tracking-widest font-bold mb-3">Top Campaigns / QR Sources</p>
                            <div className="space-y-2">
                              {liveAnalytics.traffic.topCampaigns.map(({ value, count }) => (
                                <div key={value} className="flex items-center justify-between text-xs">
                                  <span className="text-stone-300 font-mono truncate mr-3">{value}</span>
                                  <span className="text-emerald-400 font-bold shrink-0">{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <p className="text-[10px] text-stone-600 font-mono">
                        Updated {new Date(liveAnalytics.generatedAt).toLocaleTimeString()} &middot; auto-refreshes every 30s &middot; unique visitors = distinct cq_vid, bots excluded
                      </p>
                    </div>
                  )}
                </div>

                {/* Range selector */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase tracking-widest mb-1">Site Analytics</p>
                    <h2 className="text-lg font-black text-white uppercase tracking-tight">Visitor Intelligence</h2>
                  </div>
                  <div className="flex gap-1.5 bg-stone-950 border border-stone-800 rounded-xl p-1">
                    {(['7d', '30d', 'all'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setVisitorRange(r)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                          visitorRange === r
                            ? 'bg-amber-500 text-black'
                            : 'text-stone-400 hover:text-white'
                        }`}
                      >
                        {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'All Time'}
                      </button>
                    ))}
                  </div>
                </div>

                {visitorLoading && (
                  <div className="flex items-center justify-center py-20">
                    <div className="flex items-center gap-3 text-stone-400">
                      <Activity size={18} className="animate-spin" />
                      <span className="text-sm font-mono">Loading visitor data...</span>
                    </div>
                  </div>
                )}

                {!visitorLoading && visitorData?.error === 'table_missing' && (
                  <div className="p-6 bg-amber-950/40 border border-amber-700/50 rounded-2xl">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-300 mb-1">Database table not yet created</p>
                        <p className="text-sm text-stone-400 mb-3">Run the SQL migration to enable visitor tracking. Go to your Supabase dashboard → SQL Editor and run:</p>
                        <code className="block bg-stone-950 border border-stone-800 rounded-xl p-4 text-xs text-emerald-300 font-mono whitespace-pre leading-relaxed overflow-x-auto">
{`supabase/migrations/20260822_site_visits.sql`}
                        </code>
                        <p className="text-xs text-stone-500 mt-2">File is already in your repo at the path above. Paste its contents into the Supabase SQL Editor and click Run.</p>
                      </div>
                    </div>
                  </div>
                )}

                {!visitorLoading && visitorData?.error === 'no_db' && (
                  <div className="p-6 bg-stone-900 border border-stone-700 rounded-2xl text-center">
                    <Globe size={32} className="text-stone-600 mx-auto mb-2" />
                    <p className="text-stone-400 text-sm">Supabase is not configured. Visitor tracking requires a live database.</p>
                  </div>
                )}

                {!visitorLoading && visitorData && !visitorData.error && (
                  <div className="space-y-8">

                    {/* ── Top stat row ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Total Visits', value: visitorData.totalVisits, Icon: TrendingUp, color: 'text-amber-400' },
                        { label: 'Unique Visitors', value: visitorData.uniqueVisitors, Icon: Users, color: 'text-cyan-400' },
                        { label: 'Today\'s Visits', value: visitorData.todayVisits, Icon: Activity, color: 'text-emerald-400' },
                        {
                          label: 'Top Country',
                          value: visitorData.topCountries[0]?.name || '—',
                          Icon: Globe,
                          color: 'text-purple-400',
                          small: true,
                        },
                      ].map(({ label, value, Icon, color, small }) => (
                        <div key={label} className="p-5 bg-stone-950/60 border border-stone-800 rounded-2xl">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] text-stone-500 uppercase tracking-widest">{label}</p>
                            <Icon size={15} className={color} />
                          </div>
                          <p className={`font-black ${small ? 'text-base leading-tight' : 'text-3xl'} ${color}`}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* ── Visits over time bar chart ── */}
                    <div className="p-6 bg-stone-950/60 border border-stone-800 rounded-2xl">
                      <div className="flex items-center gap-2 mb-5">
                        <BarChart2 size={15} className="text-amber-400" />
                        <p className="text-[11px] text-stone-400 uppercase tracking-widest font-bold">Visits Over Time</p>
                      </div>
                      {(() => {
                        const max = Math.max(...visitorData.visitsByDay.map((d) => d.count), 1);
                        return (
                          <div className="flex items-end gap-1 h-32 overflow-x-auto pb-2">
                            {visitorData.visitsByDay.map(({ date, count }) => {
                              const heightPct = Math.max((count / max) * 100, count > 0 ? 4 : 0);
                              const label = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              return (
                                <div key={date} className="flex flex-col items-center gap-1 flex-1 min-w-[28px] group">
                                  <span className="text-[9px] text-stone-600 group-hover:text-amber-400 transition-colors">{count > 0 ? count : ''}</span>
                                  <div className="w-full relative" style={{ height: '80px' }}>
                                    <div
                                      className="absolute bottom-0 w-full rounded-t bg-amber-500/70 group-hover:bg-amber-400 transition-all"
                                      style={{ height: `${heightPct}%` }}
                                    />
                                  </div>
                                  <span className="text-[8px] text-stone-600 rotate-45 origin-left mt-1 whitespace-nowrap">{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                      {/* ── Top Countries ── */}
                      <div className="p-6 bg-stone-950/60 border border-stone-800 rounded-2xl">
                        <div className="flex items-center gap-2 mb-5">
                          <Globe size={15} className="text-purple-400" />
                          <p className="text-[11px] text-stone-400 uppercase tracking-widest font-bold">Top Countries</p>
                        </div>
                        {visitorData.topCountries.length === 0 ? (
                          <p className="text-stone-600 text-sm">No data yet</p>
                        ) : (
                          <div className="space-y-2.5">
                            {visitorData.topCountries.map(({ code, name, count }) => {
                              const maxCount = visitorData.topCountries[0]?.count || 1;
                              return (
                                <div key={code}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-stone-300 font-mono">{name}</span>
                                    <span className="text-xs text-stone-500 font-mono">{count}</span>
                                  </div>
                                  <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-purple-500 rounded-full"
                                      style={{ width: `${(count / maxCount) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* ── Top Pages ── */}
                      <div className="p-6 bg-stone-950/60 border border-stone-800 rounded-2xl">
                        <div className="flex items-center gap-2 mb-5">
                          <Activity size={15} className="text-cyan-400" />
                          <p className="text-[11px] text-stone-400 uppercase tracking-widest font-bold">Top Pages</p>
                        </div>
                        {visitorData.topPages.length === 0 ? (
                          <p className="text-stone-600 text-sm">No data yet</p>
                        ) : (
                          <div className="space-y-2.5">
                            {visitorData.topPages.map(({ page, count }) => {
                              const maxCount = visitorData.topPages[0]?.count || 1;
                              return (
                                <div key={page}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-stone-300 font-mono truncate max-w-[70%]">{page}</span>
                                    <span className="text-xs text-stone-500 font-mono">{count}</span>
                                  </div>
                                  <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-cyan-500 rounded-full"
                                      style={{ width: `${(count / maxCount) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* ── Device Breakdown ── */}
                      <div className="p-6 bg-stone-950/60 border border-stone-800 rounded-2xl">
                        <div className="flex items-center gap-2 mb-5">
                          <Monitor size={15} className="text-emerald-400" />
                          <p className="text-[11px] text-stone-400 uppercase tracking-widest font-bold">Devices</p>
                        </div>
                        <div className="flex items-center gap-6">
                          {visitorData.deviceBreakdown.map(({ type, count }) => {
                            const total = visitorData.deviceBreakdown.reduce((s, d) => s + d.count, 0) || 1;
                            const pct = Math.round((count / total) * 100);
                            const Icon = type === 'mobile' ? Smartphone : type === 'tablet' ? Tablet : Monitor;
                            const color = type === 'mobile' ? 'text-emerald-400' : type === 'tablet' ? 'text-sky-400' : 'text-amber-400';
                            return (
                              <div key={type} className="flex flex-col items-center gap-1.5">
                                <Icon size={24} className={color} />
                                <span className={`font-black text-xl ${color}`}>{pct}%</span>
                                <span className="text-[10px] text-stone-500 uppercase tracking-wider">{type}</span>
                                <span className="text-[10px] text-stone-600">{count} visits</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── Top Referrers ── */}
                      <div className="p-6 bg-stone-950/60 border border-stone-800 rounded-2xl">
                        <div className="flex items-center gap-2 mb-5">
                          <ChevronRight size={15} className="text-amber-400" />
                          <p className="text-[11px] text-stone-400 uppercase tracking-widest font-bold">Traffic Sources</p>
                        </div>
                        {visitorData.topReferrers.length === 0 ? (
                          <p className="text-stone-600 text-sm">No data yet</p>
                        ) : (
                          <div className="space-y-2.5">
                            {visitorData.topReferrers.map(({ source, count }) => {
                              const maxCount = visitorData.topReferrers[0]?.count || 1;
                              return (
                                <div key={source}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-stone-300 font-mono truncate max-w-[70%]">{source}</span>
                                    <span className="text-xs text-stone-500 font-mono">{count}</span>
                                  </div>
                                  <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-amber-500 rounded-full"
                                      style={{ width: `${(count / maxCount) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* ── Top Cities ── */}
                    {visitorData.topCities.length > 0 && (
                      <div className="p-6 bg-stone-950/60 border border-stone-800 rounded-2xl">
                        <div className="flex items-center gap-2 mb-5">
                          <MapPin size={15} className="text-rose-400" />
                          <p className="text-[11px] text-stone-400 uppercase tracking-widest font-bold">Top Cities</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                          {visitorData.topCities.map(({ city, country, count }) => (
                            <div key={`${city}-${country}`} className="p-3 bg-stone-900 border border-stone-800 rounded-xl">
                              <p className="text-xs text-white font-bold truncate">{city}</p>
                              <p className="text-[10px] text-stone-500">{country}</p>
                              <p className="text-sm font-black text-rose-400 mt-1">{count}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Recent Visits ── */}
                    <div className="p-6 bg-stone-950/60 border border-stone-800 rounded-2xl">
                      <div className="flex items-center gap-2 mb-5">
                        <Radio size={15} className="text-emerald-400 animate-pulse" />
                        <p className="text-[11px] text-stone-400 uppercase tracking-widest font-bold">Recent Visits</p>
                      </div>
                      {visitorData.recentVisits.length === 0 ? (
                        <p className="text-stone-600 text-sm">No visits recorded yet. The tracker is live — come back after some traffic hits the site.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-stone-800">
                                {['Page', 'City', 'Country', 'Device', 'Time'].map((h) => (
                                  <th key={h} className="pb-2 pr-4 text-left text-[10px] text-stone-500 uppercase tracking-wider font-bold">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {visitorData.recentVisits.map((v, i) => (
                                <tr key={i} className="border-b border-stone-900 hover:bg-stone-900/40 transition-colors">
                                  <td className="py-2 pr-4 font-mono text-amber-300 truncate max-w-[120px]">{v.page}</td>
                                  <td className="py-2 pr-4 text-stone-300">{v.city || '—'}</td>
                                  <td className="py-2 pr-4 text-stone-400">{v.country}</td>
                                  <td className="py-2 pr-4">
                                    {v.device === 'mobile'
                                      ? <Smartphone size={12} className="text-emerald-400" />
                                      : v.device === 'tablet'
                                      ? <Tablet size={12} className="text-sky-400" />
                                      : <Monitor size={12} className="text-amber-400" />}
                                  </td>
                                  <td className="py-2 text-stone-500">
                                    {new Date(v.visitedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </div>
                )}

              </div>
            )}

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && selectedEvent && (
              <div className="space-y-8">
                <div>
                  <p className="text-[10px] text-stone-500 uppercase tracking-widest mb-4">Quick Actions</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => triggerFlashQuest(quests[0]?.id || '', 30)}
                      className="btn btn-primary text-xs py-2.5 px-5 font-bold inline-flex items-center gap-2"
                    >
                      <Zap size={13} /> Trigger Flash Drop (30 min)
                    </button>
                    <button
                      onClick={() => updateEventStatus(selectedEvent.id, selectedEvent.status === 'active' ? 'ended' : 'active')}
                      className="btn btn-secondary text-xs py-2.5 px-5 font-bold"
                    >
                      Toggle Event — Currently: {selectedEvent.status.toUpperCase()}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-stone-500 uppercase tracking-widest mb-4">Event Snapshot</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Quests', value: quests.length, color: 'text-amber-400' },
                      { label: 'Verified Proofs', value: siteStats.verifiedSubmissions, color: 'text-emerald-400' },
                      { label: 'Pending Review', value: pendingCount, color: pendingCount > 0 ? 'text-red-400' : 'text-stone-500' },
                      { label: 'Total Submissions', value: siteStats.totalSubmissions, color: 'text-sky-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="p-4 bg-stone-950/60 border border-stone-800 rounded-xl">
                        <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-2">{label}</p>
                        <p className={`font-black text-2xl ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── PRE-LAUNCH ── */}
            {activeTab === 'readiness' && readiness && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">Event Pre-Launch Readiness Check</h2>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold ${
                    readiness.isReady
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                      : 'bg-amber-950/60 border-amber-700 text-amber-300'
                  }`}>
                    {readiness.isReady ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                    {readiness.isReady ? 'PASSED — READY TO PUBLISH' : 'BLOCKERS DETECTED'}
                  </span>
                </div>

                {readiness.blockers.length > 0 && (
                  <div className="p-5 bg-red-950/30 border border-red-800/60 rounded-xl space-y-2">
                    <p className="flex items-center gap-2 font-bold text-red-400 text-xs uppercase tracking-wider">
                      <AlertTriangle size={13} /> Launch Blockers
                    </p>
                    <ul className="space-y-1 pl-5 list-disc text-red-200 text-xs">
                      {readiness.blockers.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                )}

                {readiness.warnings.length > 0 && (
                  <div className="p-5 bg-amber-950/30 border border-amber-800/60 rounded-xl space-y-2">
                    <p className="flex items-center gap-2 font-bold text-amber-400 text-xs uppercase tracking-wider">
                      <AlertTriangle size={13} /> Optimization Warnings
                    </p>
                    <ul className="space-y-1 pl-5 list-disc text-amber-200 text-xs">
                      {readiness.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Event XP', value: `${readiness.metrics.totalXp} XP`, color: 'text-amber-400' },
                    { label: 'Secret Quests', value: readiness.metrics.secretCount, color: 'text-cyan-400' },
                    { label: 'Quest Chains', value: readiness.metrics.chainCount, color: 'text-purple-400' },
                    { label: 'Time-Locked XP', value: `${readiness.metrics.timeLockedXpPercentage}%`, color: 'text-emerald-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="p-4 bg-stone-950/60 border border-stone-800 rounded-xl">
                      <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-2">{label}</p>
                      <p className={`font-black text-xl ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── EVENT WIZARD ── */}
            {activeTab === 'events' && (
              <div className="space-y-8">
                <div className="space-y-5">
                  <div className="border-b border-stone-800 pb-4">
                    <h2 className="text-sm font-bold text-white">Create New Event</h2>
                    <p className="text-xs text-stone-500 mt-1">Builds a fresh Canton Quests weekend event from scratch.</p>
                  </div>
                  <form onSubmit={handleCreateEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Event Title</label>
                      <input type="text" value={evTitle} onChange={(e) => { setEvTitle(e.target.value); setEvSlug(e.target.value.toLowerCase().replace(/\s+/g, '-')); }} placeholder="Canton Quest Weekend #2 — The Art Cipher" className="input-field" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">URL Slug</label>
                      <input type="text" value={evSlug} onChange={(e) => setEvSlug(e.target.value)} placeholder="canton-weekend-2" className="input-field" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Start Time</label>
                      <input type="datetime-local" value={evStart} onChange={(e) => setEvStart(e.target.value)} className="input-field" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">End Time</label>
                      <input type="datetime-local" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} className="input-field" required />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Description</label>
                      <textarea value={evDesc} onChange={(e) => setEvDesc(e.target.value)} placeholder="Explore Canton landmarks, crack ciphers, and top the squad leaderboard." className="input-field h-20" />
                    </div>
                    <div className="md:col-span-2">
                      <button type="submit" className="btn btn-primary text-xs py-3 px-6 font-bold w-full uppercase tracking-wider">Create Event</button>
                    </div>
                  </form>
                </div>

                {selectedEvent && (
                  <div className="space-y-5 pt-4 border-t border-stone-800">
                    <div>
                      <h2 className="text-sm font-bold text-white">Duplicate Existing Event</h2>
                      <p className="text-xs text-stone-500 mt-1">Copies &quot;{selectedEvent.title}&quot; — quests, locations, and chains — as a template for a new weekend.</p>
                    </div>
                    <form onSubmit={handleDuplicateEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">New Event Title</label>
                        <input type="text" value={dupTitle} onChange={(e) => { setDupTitle(e.target.value); setDupSlug(e.target.value.toLowerCase().replace(/\s+/g, '-')); }} className="input-field" required />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">New URL Slug</label>
                        <input type="text" value={dupSlug} onChange={(e) => setDupSlug(e.target.value)} className="input-field" required />
                      </div>
                      <div className="md:col-span-2">
                        <button type="submit" className="btn btn-cyan text-xs py-3 px-6 font-bold w-full uppercase tracking-wider">Duplicate Event as Template</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ── QUEST STUDIO ── */}
            {activeTab === 'quests' && selectedEvent && (
              <div className="space-y-8">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-4">
                    <div>
                      <h2 className="text-sm font-bold text-white">Create New Quest</h2>
                      <p className="text-xs text-stone-500 mt-1">For: {selectedEvent.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Preset Template</label>
                      <select value={selectedTemplate} onChange={(e) => handleApplyTemplate(e.target.value)} className="bg-stone-900 text-amber-400 font-bold border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs">
                        <option value="">— Choose Preset —</option>
                        {getQuestTemplates().map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <form onSubmit={handleCreateQuest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Quest Title</label>
                      <input type="text" value={qTitle} onChange={(e) => { setQTitle(e.target.value); setQSlug(e.target.value.toLowerCase().replace(/\s+/g, '-')); }} placeholder="Centennial Plaza Beacon Check-In" className="input-field" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">URL Slug</label>
                      <input type="text" value={qSlug} onChange={(e) => setQSlug(e.target.value)} placeholder="centennial-beacon" className="input-field" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Verification Type</label>
                      <select value={qProofType} onChange={(e) => setQProofType(e.target.value as any)} className="input-field">
                        <option value="checkin">GPS Proximity Check-In</option>
                        <option value="passphrase">Passphrase Code</option>
                        <option value="qr">QR Code Scan</option>
                        <option value="photo">Photo Proof</option>
                        <option value="video">Video Proof</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">XP Point Value</label>
                      <input type="number" value={qPoints} onChange={(e) => setQPoints(Number(e.target.value))} className="input-field font-bold text-amber-400" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Target Passphrase / QR Token</label>
                      <input type="text" value={qTargetCode} onChange={(e) => setQTargetCode(e.target.value)} placeholder="Private answer or QR passcode" className="input-field font-mono uppercase" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Target Location</label>
                      <select value={qLocationId} onChange={(e) => setQLocationId(e.target.value)} className="input-field">
                        <option value="">— No Location (Virtual) —</option>
                        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Prerequisite Quest</label>
                      <select value={qPrereqId} onChange={(e) => setQPrereqId(e.target.value)} className="input-field">
                        <option value="">— Available Immediately —</option>
                        {quests.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Claim Capacity Limit</label>
                      <input type="number" value={qClaimLimit || ''} onChange={(e) => setQClaimLimit(e.target.value ? Number(e.target.value) : undefined)} placeholder="Unlimited" className="input-field" />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Player Instructions</label>
                      <textarea value={qInst} onChange={(e) => setQInst(e.target.value)} placeholder="Stand within 60m of Centennial Plaza and tap the check-in scanner." className="input-field h-20" />
                    </div>
                    <div className="md:col-span-2">
                      <button type="submit" className="btn btn-primary text-xs py-3 px-6 font-bold w-full uppercase tracking-wider">Publish Quest to Event</button>
                    </div>
                  </form>
                </div>

                <div className="space-y-4 pt-4 border-t border-stone-800">
                  <p className="text-[10px] text-stone-500 uppercase tracking-widest">Published Quests — {quests.length} total</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {quests.map((q) => (
                      <div key={q.id} className="p-4 bg-stone-950/60 border border-stone-800 rounded-xl space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-white text-sm leading-snug">{q.title}</span>
                          <span className="text-amber-400 font-bold shrink-0">+{q.pointValue} XP</span>
                        </div>
                        <p className="text-stone-500 text-xs leading-relaxed line-clamp-2">{q.instructions}</p>
                        <div className="flex items-center gap-3 pt-1 border-t border-stone-800">
                          <button onClick={() => handleDuplicateQuest(q.id)} className="text-xs text-cyan-400 hover:text-cyan-300 font-bold transition-colors">Duplicate</button>
                          <button onClick={() => setPreviewQuest(q)} className="text-xs text-amber-400 hover:text-amber-300 font-bold transition-colors">Preview as Player</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── LOCATIONS ── */}
            {activeTab === 'locations' && (
              <div className="space-y-5">
                <div className="border-b border-stone-800 pb-4">
                  <h2 className="text-sm font-bold text-white">Canton Location Manager</h2>
                  <p className="text-xs text-stone-500 mt-1">Add real-world GPS-anchored points to the Canton city map. {locations.length} locations registered.</p>
                </div>
                <form onSubmit={handleCreateLocation} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Place Name</label>
                    <input type="text" value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Market Square Pavilion" className="input-field" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Street Address</label>
                    <input type="text" value={locAddress} onChange={(e) => setLocAddress(e.target.value)} placeholder="330 Market Ave N, Canton, OH 44702" className="input-field" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Latitude</label>
                    <input type="number" step="any" value={locLat} onChange={(e) => setLocLat(Number(e.target.value))} className="input-field" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Longitude</label>
                    <input type="number" step="any" value={locLon} onChange={(e) => setLocLon(Number(e.target.value))} className="input-field" />
                  </div>
                  <div className="md:col-span-2">
                    <button type="submit" className="btn btn-primary text-xs py-3 px-6 font-bold w-full uppercase tracking-wider">Save Location to Canton Map</button>
                  </div>
                </form>
              </div>
            )}

            {/* ── QR STUDIO ── */}
            {activeTab === 'qr' && selectedEvent && (
              <div className="space-y-8">
                <div className="space-y-5">
                  <div className="border-b border-stone-800 pb-4">
                    <h2 className="text-sm font-bold text-white">QR Code Token Studio</h2>
                    <p className="text-xs text-stone-500 mt-1">Generate unique scannable tokens tied to specific quests.</p>
                  </div>
                  <form onSubmit={handleGenerateQR} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Target Quest</label>
                      <select value={qrTargetQuestId} onChange={(e) => setQrTargetQuestId(e.target.value)} className="input-field" required>
                        <option value="">— Select Quest —</option>
                        {quests.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-stone-400 uppercase tracking-wider font-bold">Internal Label</label>
                      <input type="text" value={qrLabel} onChange={(e) => setQrLabel(e.target.value)} placeholder="Aura Coffee Counter Sticker" className="input-field" />
                    </div>
                    <div className="md:col-span-2">
                      <button type="submit" className="btn btn-cyan text-xs py-3 px-6 font-bold w-full uppercase tracking-wider">Generate QR Token</button>
                    </div>
                  </form>
                </div>

                <div className="space-y-3 pt-4 border-t border-stone-800">
                  <p className="text-[10px] text-stone-500 uppercase tracking-widest">Generated Tokens — {generatedQrs.length}</p>
                  <div className="space-y-2">
                    {generatedQrs.map((qr) => (
                      <div key={qr.id} className="flex items-center justify-between p-3.5 bg-stone-950/60 border border-stone-800 rounded-xl gap-4">
                        <div>
                          <p className="font-bold text-cyan-400 text-xs">{qr.label}</p>
                          <p className="text-stone-500 text-[11px] mt-0.5">{qr.targetUrl}</p>
                        </div>
                        <span className="font-mono text-amber-400 font-bold text-xs shrink-0">{qr.token}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── PROOF QUEUE ── */}
            {activeTab === 'submissions' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-4">
                  <div>
                    <h2 className="text-sm font-bold text-white">Proof Review Queue</h2>
                    <p className="text-xs text-stone-500 mt-1">{pendingCount > 0 ? `${pendingCount} submissions awaiting review` : 'No pending submissions'}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {(['pending', 'verified', 'rejected', 'all'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setSubmissionFilter(st)}
                        className={`px-3 py-1.5 rounded-lg uppercase text-[11px] font-bold border transition-colors ${
                          submissionFilter === st
                            ? 'bg-amber-500 text-stone-950 border-amber-400'
                            : 'bg-stone-900 text-stone-400 border-stone-700 hover:border-stone-600'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredSubmissions.length === 0 ? (
                  <div className="py-16 text-center text-stone-600 text-sm">No submissions match this filter.</div>
                ) : (
                  <div className="space-y-3">
                    {filteredSubmissions.map((sub) => (
                      <div key={sub.id} className="p-5 bg-stone-950/60 border border-stone-800 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs">Proof #{sub.id.slice(-6).toUpperCase()}</span>
                          <span className={`px-2.5 py-0.5 rounded-md font-bold uppercase text-[10px] border ${
                            sub.status === 'verified' ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                            : sub.status === 'rejected' ? 'bg-red-950 border-red-800 text-red-300'
                            : 'bg-amber-950 border-amber-800 text-amber-300'
                          }`}>{sub.status}</span>
                        </div>

                        {sub.reviewFlags && sub.reviewFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {sub.reviewFlags.map((flag, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 bg-red-950/60 text-red-300 border border-red-800/50 px-2 py-0.5 rounded text-[10px] font-bold">
                                <AlertTriangle size={10} /> {flag}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="text-stone-400 text-xs">Proof: {sub.submittedContent || sub.proofUrl || 'GPS Check-In'}</p>

                        {sub.status === 'pending' && (
                          <div className="flex gap-2 pt-1 border-t border-stone-800">
                            <button onClick={() => handleReview(sub.id, 'verified')} className="btn btn-primary text-xs py-2 px-4 font-bold flex-1">Approve</button>
                            <button onClick={() => handleReview(sub.id, 'rejected')} className="btn btn-secondary text-xs py-2 px-4 font-bold flex-1">Reject</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>{/* end tab content */}
        </div>{/* end tabbed workspace */}

      </main>

      {/* ── QUEST PREVIEW MODAL ────────────────────────────────────────────── */}
      {previewQuest && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="max-w-md w-full bg-stone-900 border border-amber-500/30 p-6 rounded-2xl space-y-4 text-xs font-mono shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <span className="flex items-center gap-2 text-amber-400 font-bold uppercase text-[10px] tracking-wider">
                <KeyRound size={12} /> Player Preview Mode
              </span>
              <button onClick={() => setPreviewQuest(null)} className="text-stone-500 hover:text-white transition-colors">✕</button>
            </div>
            <h3 className="text-base font-bold text-white">{previewQuest.title}</h3>
            <p className="text-stone-400 leading-relaxed">{previewQuest.description}</p>
            <div className="p-4 bg-stone-950 border border-stone-800 rounded-xl space-y-2">
              <p className="text-amber-400 font-bold text-[11px] uppercase tracking-wider">Instructions</p>
              <p className="text-stone-300 leading-relaxed">{previewQuest.instructions}</p>
            </div>
            <p className="text-amber-400 font-extrabold">+{previewQuest.pointValue} XP</p>
            <button onClick={() => setPreviewQuest(null)} className="btn btn-secondary w-full py-2.5 text-xs font-bold">Close Preview</button>
          </div>
        </div>
      )}
    </div>
  );
}
