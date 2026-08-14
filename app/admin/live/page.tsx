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
  AudienceEvent,
  AudienceEventOption,
  SpectatorSystemSettings,
  LiveEventTimelineEntry,
  AudienceVoteSimulationResult,
  EventReadinessReport,
  LaunchGatesEvaluationResult,
  PreEventChecklistState,
  QRReadinessAuditReport,
  WalkUpRehearsalResult,
  FullEventRehearsalResult,
  QuestAuditItem,
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
  computeEventReadinessReport,
  evaluateEventLaunchGates,
  getOperatorChecklist,
  updateOperatorChecklistItem,
  auditEventQRQuests,
  auditEventQuestsAndLocations,
  runWalkUpPlayerRehearsal,
  runFullEventRehearsal,
  executeEventClosure,
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

  // Phase 5.3 Live Spectator & Operations State
  const [activeAudienceEvent, setActiveAudienceEvent] = useState<AudienceEvent | null>(null);
  const [activeAudienceOptions, setActiveAudienceOptions] = useState<AudienceEventOption[]>([]);
  const [upcomingAudienceEvents, setUpcomingAudienceEvents] = useState<AudienceEvent[]>([]);
  const [resolvedAudienceEvents, setResolvedAudienceEvents] = useState<AudienceEvent[]>([]);
  const [spectatorSettings, setSpectatorSettings] = useState<SpectatorSystemSettings | null>(null);
  const [timelineLogs, setTimelineLogs] = useState<LiveEventTimelineEntry[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'audience' | 'phases' | 'effects'>('all');
  const [simulationResult, setSimulationResult] = useState<AudienceVoteSimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Phase 5.4 Event Readiness, Launch Gates, Audit & Rehearsal State
  const [readinessReport, setReadinessReport] = useState<EventReadinessReport | null>(null);
  const [launchGatesResult, setLaunchGatesResult] = useState<LaunchGatesEvaluationResult | null>(null);
  const [operatorChecklist, setOperatorChecklist] = useState<PreEventChecklistState | null>(null);
  const [qrAuditReport, setQrAuditReport] = useState<QRReadinessAuditReport | null>(null);
  const [questAuditReport, setQuestAuditReport] = useState<{ items: QuestAuditItem[]; summary: any } | null>(null);
  const [walkUpRehearsalResult, setWalkUpRehearsalResult] = useState<WalkUpRehearsalResult | null>(null);
  const [fullRehearsalResult, setFullRehearsalResult] = useState<FullEventRehearsalResult | null>(null);
  const [isRunningWalkUp, setIsRunningWalkUp] = useState<boolean>(false);
  const [isRunningFullRehearsal, setIsRunningFullRehearsal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'readiness' | 'checklist' | 'qr_audit' | 'audience' | 'rehearsal' | 'director' | 'emergency'>('readiness');
  const [closureReasonInput, setClosureReasonInput] = useState<string>('Live Event Concluded Gracefully');

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [adminPassphrase, setAdminPassphrase] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // Action Modals & Form State
  const [activeModal, setActiveModal] = useState<
    | 'announce'
    | 'flash'
    | 'code'
    | 'bonus'
    | 'npc'
    | 'score'
    | 'wildcard'
    | 'create_audience_vote'
    | 'override_vote'
    | 'cancel_vote'
    | null
  >(null);
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

  // Audience Event creation form state
  const [votePreset, setVotePreset] = useState<string>('custom');
  const [voteTitle, setVoteTitle] = useState<string>('');
  const [voteDescription, setVoteDescription] = useState<string>('');
  const [voteDuration, setVoteDuration] = useState<number>(5);
  const [voteOptions, setVoteOptions] = useState<
    Array<{ label: string; description: string; effectType: string; payloadStr: string }>
  >([
    {
      label: 'Option Alpha (2.0x Multiplier)',
      description: 'Awards Double XP for all quests',
      effectType: 'bonus_window',
      payloadStr: '{"multiplier": 2.0, "category": "all", "durationMinutes": 30}',
    },
    {
      label: 'Option Beta (Flash Drop)',
      description: 'Triggers timed pop-up quest downtown',
      effectType: 'flash_quest',
      payloadStr: '{"questId": "quest-001", "durationMinutes": 20}',
    },
  ]);
  const [launchImmediately, setLaunchImmediately] = useState<boolean>(true);

  // Override & Cancel form state
  const [overrideTargetEventId, setOverrideTargetEventId] = useState<string>('');
  const [overrideSelectedOptionId, setOverrideSelectedOptionId] = useState<string>('');
  const [overrideReasonInput, setOverrideReasonInput] = useState<string>('Game Director Balance Override');
  const [cancelTargetEventId, setCancelTargetEventId] = useState<string>('');
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('Inclement weather / safety update');

  const fetchAudienceDashboard = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/admin/live?eventId=${eventId}`);
      const data = await res.json();
      if (data.success) {
        setActiveAudienceEvent(data.activeEvent || null);
        setActiveAudienceOptions(data.activeOptions || []);
        setUpcomingAudienceEvents(data.upcomingEvents || []);
        setResolvedAudienceEvents(data.resolvedEvents || []);
        setSpectatorSettings(data.settings || null);
        setTimelineLogs(data.timeline || []);

        if (data.readiness) setReadinessReport(data.readiness);
        if (data.launchGates) setLaunchGatesResult(data.launchGates);
        if (data.checklist) setOperatorChecklist(data.checklist);
        if (data.qrAudit) setQrAuditReport(data.qrAudit);
        if (data.questAudit) setQuestAuditReport(data.questAudit);
      }
    } catch {
      // Non-fatal fallback
    }
  }, []);

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
      fetchAudienceDashboard(activeEvt.id);
    }
    setPlayers(getAllPlayers());
    setActivityLog(getActivityLog());
  }, [isAdminAuthenticated, fetchAudienceDashboard]);

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

  // Phase 5.3 Audience & Live Operations Handlers
  const handleVotePresetChange = (preset: string) => {
    setVotePreset(preset);
    if (preset === 'double_xp_arts') {
      setVoteTitle('🎨 ARTS DISTRICT DOUBLE XP SPRINT');
      setVoteDescription('Should agents in the Downtown Arts Corridor earn Double XP for the next 30 minutes?');
      setVoteOptions([
        {
          label: '⚡ YES — Unleash 2.0x XP Surge',
          description: 'Double XP for all Arts & Culture quests for 30 minutes',
          effectType: 'bonus_window',
          payloadStr: '{"title": "Arts District Double XP", "multiplier": 2.0, "category": "arts", "durationMinutes": 30}',
        },
        {
          label: '🛡️ NO — Keep Standard Multipliers',
          description: 'Preserve standard game pacing without multiplier surge',
          effectType: 'theatrical_broadcast',
          payloadStr: '{"title": "Standard Pacing Retained", "message": "Watchers voted to maintain standard game pace."}',
        },
      ]);
    } else if (preset === 'flash_drop') {
      setVoteTitle('⚡ CENTENNIAL PLAZA FLASH DROP');
      setVoteDescription('Which special pop-up drop should be activated downtown?');
      setVoteOptions([
        {
          label: 'Centennial Plaza Flash Drop (+200 XP)',
          description: 'Timed 20-minute pop-up objective at Centennial Plaza',
          effectType: 'flash_quest',
          payloadStr: '{"questId": "quest-001", "durationMinutes": 20}',
        },
        {
          label: '4th Street Mural Hunt (+200 XP)',
          description: 'Timed 20-minute pop-up objective near the 4th Street Murals',
          effectType: 'flash_quest',
          payloadStr: '{"questId": "quest-002", "durationMinutes": 20}',
        },
      ]);
    } else if (preset === 'secret_passcode') {
      setVoteTitle('🔑 PUBLIC AIRWAVES SECRET PASSCODE DROP');
      setVoteDescription('Select the secret reward code to release to all active players!');
      setVoteOptions([
        {
          label: 'CANTON_HERO_2026 (+150 XP)',
          description: 'Awards 150 bonus XP to agents who input code',
          effectType: 'secret_code',
          payloadStr: '{"code": "CANTON_HERO_2026", "points": 150, "description": "Community Code Drop"}',
        },
        {
          label: 'DOWNTOWN_VIP_2026 (+150 XP)',
          description: 'Awards 150 bonus XP to agents who input code',
          effectType: 'secret_code',
          payloadStr: '{"code": "DOWNTOWN_VIP_2026", "points": 150, "description": "Community Code Drop"}',
        },
      ]);
    } else {
      setVoteTitle('');
      setVoteDescription('');
      setVoteOptions([
        {
          label: 'Option Alpha (2.0x Multiplier)',
          description: 'Awards Double XP for all quests',
          effectType: 'bonus_window',
          payloadStr: '{"multiplier": 2.0, "category": "all", "durationMinutes": 30}',
        },
        {
          label: 'Option Beta (Flash Drop)',
          description: 'Triggers timed pop-up quest downtown',
          effectType: 'flash_quest',
          payloadStr: '{"questId": "quest-001", "durationMinutes": 20}',
        },
      ]);
    }
  };

  const handleCreateAudienceVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !voteTitle.trim()) return;

    const parsedOptions = voteOptions.map((opt, idx) => {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(opt.payloadStr);
      } catch {
        parsedPayload = { label: opt.label, type: opt.effectType };
      }
      return {
        label: opt.label,
        description: opt.description,
        effectPayload: parsedPayload,
        sortOrder: idx + 1,
      };
    });

    const res = await sendAdminLiveAction({
      action: 'create_audience_event',
      eventId: event.id,
      title: voteTitle,
      description: voteDescription,
      eventType: 'audience_vote',
      eligibilityMode: 'all',
      maxVotesPerSession: 1,
      options: parsedOptions,
      launchNow: launchImmediately,
      durationMinutes: voteDuration,
    });

    if (res.success) {
      notify(launchImmediately ? '🚀 Audience Vote Launched Live!' : '📅 Audience Vote Scheduled!');
      setActiveModal(null);
      refreshData();
    } else {
      notify(`Failed: ${res.error}`);
    }
  };

  const handleActivateAudienceEvent = async (audienceEventId: string) => {
    const res = await sendAdminLiveAction({
      action: 'activate_audience_event',
      audienceEventId,
      durationMinutes: 5,
    });
    if (res.success) {
      notify('🚀 Audience Vote Activated Live!');
      refreshData();
    } else {
      notify(`Failed: ${res.error}`);
    }
  };

  const handleCloseAudienceVoting = async (audienceEventId: string) => {
    const res = await sendAdminLiveAction({
      action: 'close_audience_voting',
      audienceEventId,
    });
    if (res.success) {
      notify('🔒 Voting Closed! Tallying final results...');
      refreshData();
    } else {
      notify(`Failed: ${res.error}`);
    }
  };

  const handleResolveAudienceEvent = async (audienceEventId: string, overrideOptionId?: string, overrideReason?: string) => {
    const res = await sendAdminLiveAction({
      action: 'resolve_audience_event',
      audienceEventId,
      overrideOptionId,
      overrideReason,
    });
    if (res.success) {
      notify(overrideOptionId ? '⚡ Manual Override Applied & Effect Executed!' : '🏆 Decision Resolved & Effect Executed!');
      setActiveModal(null);
      refreshData();
    } else {
      notify(`Failed: ${res.error}`);
    }
  };

  const handleCancelAudienceEvent = async (audienceEventId: string, cancellationReason: string) => {
    const res = await sendAdminLiveAction({
      action: 'cancel_audience_event',
      audienceEventId,
      cancellationReason,
    });
    if (res.success) {
      notify('⛔ Decision Cancelled without effect execution.');
      setActiveModal(null);
      refreshData();
    } else {
      notify(`Failed: ${res.error}`);
    }
  };

  const handleToggleSpectatorFreeze = async (isDisabled: boolean) => {
    if (!event) return;
    const reason = isDisabled ? 'Game Master Live Freeze' : undefined;
    const res = await sendAdminLiveAction({
      action: 'toggle_spectator_freeze',
      eventId: event.id,
      isDisabled,
      reason,
    });
    if (res.success) {
      notify(isDisabled ? '⏸️ Spectator System Frozen' : '▶️ Spectator System Live');
      refreshData();
    } else {
      notify(`Failed: ${res.error}`);
    }
  };

  const handleRunRehearsalSimulation = async () => {
    if (!event) return;
    setIsSimulating(true);
    try {
      const res = await sendAdminLiveAction({
        action: 'run_rehearsal_simulation',
        eventId: event.id,
        params: { votesCount: 36 },
      });
      if (res.success) {
        setSimulationResult(res.simulation);
        notify('🟡 Rehearsal Simulation Complete (Production scoring untouched)');
        refreshData();
      } else {
        notify(`Simulation failed: ${res.error}`);
      }
    } catch (err: any) {
      notify(`Simulation error: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleUpdateChecklist = async (itemId: string, isChecked: boolean) => {
    if (!event) return;
    const res = await sendAdminLiveAction({
      action: 'update_checklist_item',
      eventId: event.id,
      itemId,
      isChecked,
    });
    if (res.success && res.checklist) {
      setOperatorChecklist(res.checklist);
      notify(isChecked ? '✅ Checklist item confirmed' : 'Checklist item updated');
    }
  };

  const handleRunWalkUpRehearsal = async () => {
    if (!event) return;
    setIsRunningWalkUp(true);
    try {
      const res = await sendAdminLiveAction({
        action: 'run_walkup_rehearsal',
        eventId: event.id,
      });
      if (res.success && res.rehearsal) {
        setWalkUpRehearsalResult(res.rehearsal);
        notify('🧪 Walk-Up Player Rehearsal Passed (10/10 Steps)!');
        refreshData();
      } else {
        notify(`Rehearsal failed: ${res.error}`);
      }
    } catch (err: any) {
      notify(`Rehearsal error: ${err.message}`);
    } finally {
      setIsRunningWalkUp(false);
    }
  };

  const handleRunFullRehearsal = async () => {
    if (!event) return;
    setIsRunningFullRehearsal(true);
    try {
      const res = await sendAdminLiveAction({
        action: 'run_full_rehearsal',
        eventId: event.id,
      });
      if (res.success && res.rehearsal) {
        setFullRehearsalResult(res.rehearsal);
        notify('🏆 Full Event 8-Phase Rehearsal Passed!');
        refreshData();
      } else {
        notify(`Full Rehearsal failed: ${res.error}`);
      }
    } catch (err: any) {
      notify(`Full Rehearsal error: ${err.message}`);
    } finally {
      setIsRunningFullRehearsal(false);
    }
  };

  const handleEvaluateLaunchGates = async () => {
    if (!event) return;
    try {
      const res = await sendAdminLiveAction({
        action: 'evaluate_launch_gates',
        eventId: event.id,
      });
      if (res.success) {
        setLaunchGatesResult(res);
        notify(res.isLaunchPermitted ? '✅ Launch Gates Cleared! System Ready.' : '⚠️ Launch Blockers Detected.');
        refreshData();
      }
    } catch (err: any) {
      notify(`Gate evaluation error: ${err.message}`);
    }
  };

  const handleEndEventClosure = async () => {
    if (!event) return;
    try {
      const res = await sendAdminLiveAction({
        action: 'execute_event_closure',
        eventId: event.id,
        reason: closureReasonInput,
      });
      if (res.success) {
        notify('🏁 Event Concluded Gracefully! New submissions locked.');
        setActiveModal(null);
        refreshData();
      } else {
        notify(`Failed: ${res.error}`);
      }
    } catch (err: any) {
      notify(`Closure error: ${err.message}`);
    }
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

        {/* COMPUTED LAUNCH ASSESSMENT BANNER */}
        {readinessReport && (
          <div
            className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 shadow-lg ${
              readinessReport.overallStatus === 'READY_FOR_LIVE_EVENT'
                ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-300'
                : readinessReport.overallStatus === 'READY_WITH_WARNINGS'
                ? 'bg-amber-950/60 border-amber-500/80 text-amber-300'
                : 'bg-red-950/80 border-red-500 text-red-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {readinessReport.overallStatus === 'READY_FOR_LIVE_EVENT'
                  ? '🟢'
                  : readinessReport.overallStatus === 'READY_WITH_WARNINGS'
                  ? '🟡'
                  : '🔴'}
              </span>
              <div>
                <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-widest">
                  COMPUTED LAUNCH ASSESSMENT
                </span>
                <span className="font-extrabold text-base font-display uppercase tracking-wider block">
                  LAUNCH_ASSESSMENT: {readinessReport.overallStatus.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-gray-300">
                  {readinessReport.summary.readyCount}/{readinessReport.summary.totalChecks} Checks Passed
                  {readinessReport.blockers.length > 0 && ` • ${readinessReport.blockers.length} Critical Blockers`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleEvaluateLaunchGates}
                className="px-3 py-2 bg-black/60 hover:bg-black border border-white/20 hover:border-white/40 rounded-xl text-white font-bold text-xs transition-all active:scale-95 min-h-[44px]"
              >
                ⚡ Re-Evaluate Gates
              </button>
              <button
                onClick={handleRunWalkUpRehearsal}
                disabled={isRunningWalkUp}
                className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
              >
                {isRunningWalkUp ? 'Running...' : '🧪 Walk-Up Rehearsal'}
              </button>
              <button
                onClick={handleRunFullRehearsal}
                disabled={isRunningFullRehearsal}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
              >
                {isRunningFullRehearsal ? 'Running...' : '🏆 Full Rehearsal'}
              </button>
            </div>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-2">
          {[
            { id: 'readiness', label: '🚦 Launch Readiness & Gates' },
            { id: 'checklist', label: '📋 Operator Checklist' },
            { id: 'qr_audit', label: '🔍 QR & Quest Audit' },
            { id: 'audience', label: '🗳️ Audience Operations' },
            { id: 'rehearsal', label: '🧪 Rehearsal Sandbox' },
            { id: 'director', label: '🎛️ Game Director' },
            { id: 'emergency', label: '⚠️ Emergency & Closure' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 rounded-xl font-bold text-xs transition-all min-h-[44px] flex items-center ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-obsidian shadow font-extrabold'
                  : 'bg-card text-gray-300 border border-gray-800 hover:border-gray-600 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. TAB: READINESS & LAUNCH GATES */}
        {activeTab === 'readiness' && (
          <div className="space-y-6">
            {/* HARD SERVER-SIDE LAUNCH GATES */}
            {launchGatesResult && (
              <div className="glass-panel p-5 border-cyan-500/40 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🛡️</span>
                    <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                      HARD SERVER-SIDE LAUNCH GATES ({launchGatesResult.passedCount}/{launchGatesResult.gates.length} PASSED)
                    </h3>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-md font-extrabold text-[11px] ${
                      launchGatesResult.isLaunchPermitted
                        ? 'bg-emerald-500 text-obsidian'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {launchGatesResult.isLaunchPermitted ? 'LAUNCH PERMITTED' : 'LAUNCH BLOCKED'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {launchGatesResult.gates.map((gate) => (
                    <div
                      key={gate.code}
                      className={`p-3 rounded-xl border flex items-start justify-between gap-2 ${
                        gate.isPassed
                          ? 'bg-obsidian/80 border-emerald-500/40'
                          : gate.severity === 'CRITICAL'
                          ? 'bg-red-950/40 border-red-500/80'
                          : 'bg-amber-950/40 border-amber-500/60'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span>{gate.isPassed ? '✅' : gate.severity === 'CRITICAL' ? '❌' : '⚠️'}</span>
                          <span className="font-bold text-white text-xs">{gate.name}</span>
                          <span className="text-[9px] text-gray-500 font-mono">({gate.code})</span>
                        </div>
                        {gate.failureReason && (
                          <p className="text-[11px] text-red-300 pl-6">{gate.failureReason}</p>
                        )}
                      </div>
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                          gate.isPassed
                            ? 'bg-emerald-950 text-emerald-400'
                            : gate.severity === 'CRITICAL'
                            ? 'bg-red-900 text-red-200'
                            : 'bg-amber-900 text-amber-200'
                        }`}
                      >
                        {gate.isPassed ? 'PASSED' : gate.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 12 SUBSYSTEM READINESS GRID */}
            {readinessReport && (
              <div className="glass-panel p-5 border-amber-500/40 space-y-4">
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider border-b border-gray-800 pb-3">
                  📊 12 OPERATIONAL SUBSYSTEM HEALTH MATRICES
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(readinessReport.categories).map(([key, cat]) => (
                    <div
                      key={key}
                      className="p-3.5 bg-obsidian border border-gray-800 rounded-2xl space-y-2 hover:border-gray-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white uppercase text-xs">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            cat.status === 'READY'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                              : cat.status === 'WARNING'
                              ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                              : 'bg-red-950 text-red-400 border border-red-500/40'
                          }`}
                        >
                          {cat.status}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {cat.checks.map((chk) => (
                          <div key={chk.id} className="text-[11px] text-gray-400 flex items-start gap-1.5">
                            <span>{chk.status === 'READY' ? '•' : chk.status === 'WARNING' ? '⚠️' : '❌'}</span>
                            <span>{chk.label}: {chk.details}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. TAB: OPERATOR CHECKLIST */}
        {activeTab === 'checklist' && operatorChecklist && (
          <div className="glass-panel p-5 border-emerald-500/40 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                  📋 PRE-EVENT GAME MASTER CHECKLIST
                </h3>
                <p className="text-[11px] text-gray-400">
                  Synchronizes automated system checks with field physical verifications. Manual checks cannot override blocked server gates.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {operatorChecklist.items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 bg-obsidian border rounded-2xl flex flex-wrap items-center justify-between gap-3 transition-all ${
                    item.isManuallyChecked || item.automatedStatus === 'READY'
                      ? 'border-emerald-500/40'
                      : 'border-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-[240px]">
                    <input
                      type="checkbox"
                      checked={item.isManuallyChecked}
                      onChange={(e) => handleUpdateChecklist(item.id, e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-gray-700 bg-gray-900 text-emerald-500 focus:ring-0 cursor-pointer min-h-[24px] min-w-[24px]"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{item.label}</span>
                        {item.isAutomated && (
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                              item.automatedStatus === 'READY'
                                ? 'bg-emerald-950 text-emerald-400'
                                : item.automatedStatus === 'WARNING'
                                ? 'bg-amber-950 text-amber-400'
                                : 'bg-red-950 text-red-400'
                            }`}
                          >
                            AUTO: {item.automatedStatus}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.description}</p>
                      {item.checkedAt && (
                        <span className="text-[10px] text-gray-500 block mt-1">
                          Verified by {item.checkedBy} at {new Date(item.checkedAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold ${
                      item.isManuallyChecked ? 'text-emerald-400' : 'text-gray-500'
                    }`}
                  >
                    {item.isManuallyChecked ? 'CONFIRMED' : 'PENDING'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. TAB: QR & QUEST AUDIT */}
        {activeTab === 'qr_audit' && (
          <div className="space-y-6">
            {qrAuditReport && (
              <div className="glass-panel p-5 border-cyan-500/40 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
                  <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                    🔍 QR CODE ASSIGNMENTS & INTEGRITY AUDIT ({qrAuditReport.readyCount}/{qrAuditReport.totalQrQuests} READY)
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold text-[10px]">
                      {qrAuditReport.readyCount} Ready
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold text-[10px]">
                      {qrAuditReport.warningCount} Warning
                    </span>
                    <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 font-bold text-[10px]">
                      {qrAuditReport.brokenCount} Broken
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {qrAuditReport.items.map((q) => (
                    <div
                      key={q.questId}
                      className="p-3 bg-obsidian border border-gray-800 rounded-xl flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{q.questTitle}</span>
                          <span className="text-[10px] text-gray-500">({q.questId})</span>
                        </div>
                        <span className="text-[11px] text-gray-400 block font-mono">
                          QR Identifier: {q.qrCodeIdentifier} • Route: {q.verificationPath}
                        </span>
                        {q.issues.length > 0 && (
                          <div className="text-[11px] text-red-400 mt-1 space-y-0.5">
                            {q.issues.map((err, i) => (
                              <div key={i}>❌ {err}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                          q.status === 'READY'
                            ? 'bg-emerald-950 text-emerald-400'
                            : q.status === 'WARNING'
                            ? 'bg-amber-950 text-amber-400'
                            : 'bg-red-950 text-red-400'
                        }`}
                      >
                        {q.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {questAuditReport && (
              <div className="glass-panel p-5 border-amber-500/40 space-y-4">
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider border-b border-gray-800 pb-3">
                  📍 QUEST ROSTER & LOCATION BOUNDARY AUDIT ({questAuditReport.summary.ready}/{questAuditReport.summary.total} READY)
                </h3>
                <div className="space-y-2">
                  {questAuditReport.items.map((q) => (
                    <div
                      key={q.questId}
                      className="p-3 bg-obsidian border border-gray-800 rounded-xl flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{q.title}</span>
                          <span className="text-[10px] text-amber-400 font-extrabold">+{q.pointValue} XP</span>
                          <span className="text-[10px] text-purple-300 uppercase">[{q.category}]</span>
                        </div>
                        <span className="text-[11px] text-gray-400 block">
                          Proof: {q.proofType} • Location: {q.locationName || 'Unbound'}
                          {q.hasPrerequisite && ` • Prereq: ${q.prerequisiteQuestId}`}
                        </span>
                        {q.issues.length > 0 && (
                          <div className="text-[11px] text-red-400 mt-1">
                            {q.issues.map((err, i) => (
                              <div key={i}>❌ {err}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                          q.auditStatus === 'READY'
                            ? 'bg-emerald-950 text-emerald-400'
                            : q.auditStatus === 'WARNING'
                            ? 'bg-amber-950 text-amber-400'
                            : 'bg-red-950 text-red-400'
                        }`}
                      >
                        {q.auditStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. TAB: REHEARSAL SANDBOX */}
        {activeTab === 'rehearsal' && (
          <div className="space-y-6">
            <div className="glass-panel p-5 border-purple-500/40 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
                <div>
                  <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                    🧪 REHEARSAL DRILL CENTER & SIMULATION SANDBOX
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Runs end-to-end player journeys and full event phase simulations with 100% isolation from real player scores.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunWalkUpRehearsal}
                    disabled={isRunningWalkUp}
                    className="btn btn-cyan text-xs py-2 px-3 font-bold min-h-[44px]"
                  >
                    {isRunningWalkUp ? '⏳ Running...' : '🧪 Run Walk-Up Rehearsal'}
                  </button>
                  <button
                    onClick={handleRunFullRehearsal}
                    disabled={isRunningFullRehearsal}
                    className="btn btn-primary text-xs py-2 px-3 font-bold min-h-[44px]"
                  >
                    {isRunningFullRehearsal ? '⏳ Running...' : '🏆 Run Full 8-Phase Drill'}
                  </button>
                </div>
              </div>

              {/* Isolation Banner */}
              <div className="p-3 bg-purple-950/40 border border-purple-500/50 rounded-xl text-[11px] text-purple-200 flex items-center gap-2">
                <span>🛡️</span>
                <span>
                  <strong>SANDBOX ISOLATION GUARANTEE:</strong> All rehearsal executions operate under <code>isRehearsal: true</code>. Production players, leaderboards, score ledgers, and prize snapshots remain completely unaltered.
                </span>
              </div>

              {/* Walk-up Rehearsal Results */}
              {walkUpRehearsalResult && (
                <div className="p-4 bg-obsidian border border-cyan-500/50 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <span className="font-bold text-white text-xs">
                      ✅ WALK-UP PLAYER REHEARSAL RECEIPT ({walkUpRehearsalResult.steps.length}/10 STEPS PASSED)
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono">
                      Completed in {walkUpRehearsalResult.durationMs}ms
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {walkUpRehearsalResult.steps.map((st) => (
                      <div
                        key={st.stepNumber}
                        className="p-2 bg-gray-900/80 rounded-lg text-[11px] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">Step {st.stepNumber}:</span>
                          <span className="text-white">{st.title}</span>
                        </div>
                        <span className="text-gray-400 text-[10px]">{st.details}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Event Rehearsal Results */}
              {fullRehearsalResult && (
                <div className="p-4 bg-obsidian border border-emerald-500/50 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <span className="font-bold text-white text-xs">
                      🏆 FULL EVENT 8-PHASE REHEARSAL RECEIPT
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {fullRehearsalResult.simulatedPlayerCount} Players • {fullRehearsalResult.simulatedQuestsCompleted} Quests • {fullRehearsalResult.simulatedVotesCast} Votes
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {fullRehearsalResult.phases.map((ph) => (
                      <div key={ph.phase} className="p-2.5 bg-gray-900/80 rounded-xl border border-gray-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-white text-[11px] uppercase">{ph.phase}</span>
                          <span className="text-emerald-400 text-[10px] font-bold">PASSED</span>
                        </div>
                        <p className="text-[10px] text-gray-400">{ph.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. TAB: EMERGENCY & CLOSURE */}
        {activeTab === 'emergency' && (
          <div className="glass-panel p-5 border-red-500/60 bg-red-950/20 space-y-6">
            <div className="border-b border-red-900 pb-3">
              <h3 className="font-extrabold text-sm text-red-300 uppercase tracking-wider">
                ⚠️ EMERGENCY OPERATIONS & EVENT CLOSURE CENTER
              </h3>
              <p className="text-[11px] text-gray-400">
                High-priority fail-safe controls for on-field emergencies and final event conclusion.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-obsidian border border-red-500/40 rounded-2xl space-y-2">
                <span className="text-lg block">🛑</span>
                <span className="font-bold text-white text-xs block">Emergency Game Pause</span>
                <p className="text-[10px] text-gray-400">
                  Holds all player quest submissions immediately. Used for severe weather or field safety hazards.
                </p>
                <button
                  onClick={handleTogglePause}
                  className={`w-full py-2 rounded-xl font-bold text-xs transition-all min-h-[44px] ${
                    event.isPaused ? 'bg-emerald-500 text-obsidian' : 'bg-red-600 text-white'
                  }`}
                >
                  {event.isPaused ? '▶️ RESUME EVENT' : '🛑 PAUSE EVENT NOW'}
                </button>
              </div>

              <div className="p-4 bg-obsidian border border-purple-500/40 rounded-2xl space-y-2">
                <span className="text-lg block">⏸️</span>
                <span className="font-bold text-white text-xs block">Freeze Spectator System</span>
                <p className="text-[10px] text-gray-400">
                  Locks public voting airwaves and spectator interactions without interrupting in-game players.
                </p>
                <button
                  onClick={() => handleToggleSpectatorFreeze(!spectatorSettings?.isSpectatorSystemDisabled)}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs transition-all min-h-[44px]"
                >
                  {spectatorSettings?.isSpectatorSystemDisabled ? '▶️ Unfreeze Spectators' : '⏸️ Freeze Spectators'}
                </button>
              </div>

              <div className="p-4 bg-obsidian border border-amber-500/40 rounded-2xl space-y-2">
                <span className="text-lg block">🏁</span>
                <span className="font-bold text-white text-xs block">Conclude Live Event</span>
                <p className="text-[10px] text-gray-400">
                  Permanently ends scoring, locks final leaderboard, closes spectator voting, and archives event state.
                </p>
                <button
                  onClick={() => setActiveModal('end_event' as any)}
                  className="w-full py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:opacity-90 text-white rounded-xl font-bold text-xs transition-all min-h-[44px]"
                >
                  🏁 Conclude Event...
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. TAB: AUDIENCE OPERATIONS */}
        {activeTab === 'audience' && (
          <div className="space-y-6">

        {/* REHEARSAL SIMULATION MODE RESULTS BANNER */}
        {simulationResult && (
          <div className="glass-panel p-4 border-yellow-500/60 bg-yellow-950/30 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-yellow-500 text-obsidian font-extrabold text-[10px]">
                  🟡 REHEARSAL SIMULATION MODE
                </span>
                <span className="font-bold text-white text-xs">
                  {simulationResult.simulatedEvent.title}
                </span>
              </div>
              <button
                onClick={() => setSimulationResult(null)}
                className="text-[10px] text-gray-400 hover:text-white"
              >
                ✕ Dismiss
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-obsidian/70 p-3 rounded-xl border border-gray-800">
              <div>
                <span className="text-gray-400 block text-[10px]">Simulated Total Votes:</span>
                <span className="font-bold text-white">{simulationResult.totalVotesSimulated} Votes</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">Projected Winner:</span>
                <span className="font-bold text-emerald-400">{simulationResult.winningOption.optionLabel}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">Attributed Action:</span>
                <span className="font-bold text-cyan-400">{simulationResult.broadcastPreview.headline}</span>
              </div>
            </div>
            <div className="text-[11px] text-gray-300">
              <span className="font-bold text-yellow-400">Broadcast Preview: </span>
              {simulationResult.broadcastPreview.body}
            </div>
          </div>
        )}

        {/* AUDIENCE INFLUENCE & LIVE OPERATIONS COMMAND CENTER */}
        <div className="glass-panel p-5 border-purple-500/40 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse"></span>
              <h2 className="font-extrabold text-sm text-white uppercase tracking-wider">
                🗳️ AUDIENCE INFLUENCE & SPECTATOR OPERATIONS
              </h2>
              {spectatorSettings?.isSpectatorSystemDisabled && (
                <span className="px-2 py-0.5 rounded-full bg-red-950 border border-red-500 text-red-300 text-[10px] font-bold">
                  ⚠️ SPECTATOR SYSTEM FROZEN
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  handleToggleSpectatorFreeze(!spectatorSettings?.isSpectatorSystemDisabled)
                }
                className={`px-3 py-1 rounded-xl font-bold text-xs transition-all ${
                  spectatorSettings?.isSpectatorSystemDisabled
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-700'
                }`}
              >
                {spectatorSettings?.isSpectatorSystemDisabled
                  ? '▶️ Unfreeze Spectators'
                  : '⏸️ Freeze Spectators'}
              </button>
              <button
                onClick={() => {
                  handleVotePresetChange('double_xp_arts');
                  setActiveModal('create_audience_vote');
                }}
                className="btn btn-primary text-xs py-1 px-3 font-bold"
              >
                + New Audience Vote
              </button>
            </div>
          </div>

          {/* ACTIVE DECISION CARD */}
          {activeAudienceEvent ? (
            <div className="p-4 bg-obsidian border border-purple-500/50 rounded-2xl space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-purple-500 text-obsidian font-extrabold text-[10px] uppercase">
                      {activeAudienceEvent.status.replace('_', ' ')}
                    </span>
                    <span className="text-gray-400 text-[11px]">
                      Ends:{' '}
                      {activeAudienceEvent.endsAt
                        ? new Date(activeAudienceEvent.endsAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : 'Open'}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-white text-base mt-1">
                    {activeAudienceEvent.title}
                  </h3>
                  {activeAudienceEvent.description && (
                    <p className="text-gray-300 text-xs mt-0.5">{activeAudienceEvent.description}</p>
                  )}
                </div>

                {/* 1-Click Decision Action Controls */}
                <div className="flex flex-wrap gap-2">
                  {activeAudienceEvent.status === 'voting_active' && (
                    <button
                      onClick={() => handleCloseAudienceVoting(activeAudienceEvent.id)}
                      className="px-3 py-1.5 bg-yellow-600/80 hover:bg-yellow-600 text-white rounded-xl font-bold text-xs"
                    >
                      🔒 Close Voting
                    </button>
                  )}
                  <button
                    onClick={() => handleResolveAudienceEvent(activeAudienceEvent.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs"
                  >
                    🏆 Resolve & Execute Effect
                  </button>
                  <button
                    onClick={() => {
                      setOverrideTargetEventId(activeAudienceEvent.id);
                      setOverrideSelectedOptionId(activeAudienceOptions[0]?.id || '');
                      setActiveModal('override_vote');
                    }}
                    className="px-3 py-1.5 bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-600 rounded-xl font-bold text-xs"
                  >
                    ⚡ GM Override
                  </button>
                  <button
                    onClick={() => {
                      setCancelTargetEventId(activeAudienceEvent.id);
                      setActiveModal('cancel_vote');
                    }}
                    className="px-3 py-1.5 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 rounded-xl font-bold text-xs"
                  >
                    ⛔ Cancel
                  </button>
                </div>
              </div>

              {/* Live Vote Breakdown */}
              <div className="space-y-2 pt-1">
                {(() => {
                  const totalVotes = activeAudienceOptions.reduce(
                    (sum, opt) => sum + (opt.voteCount || 0),
                    0
                  );
                  const highestVotes = Math.max(
                    ...activeAudienceOptions.map((o) => o.voteCount || 0),
                    0
                  );

                  return activeAudienceOptions.map((opt) => {
                    const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
                    const isWinning = opt.voteCount === highestVotes && totalVotes > 0;

                    return (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isWinning
                            ? 'bg-purple-950/40 border-purple-500'
                            : 'bg-card border-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{opt.optionLabel}</span>
                            {isWinning && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-extrabold border border-emerald-500/40">
                                👑 PROJECTED WINNER
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-purple-300 font-bold">
                            {opt.voteCount} votes ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isWinning ? 'bg-gradient-to-r from-purple-500 to-amber-400' : 'bg-purple-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {opt.optionDescription && (
                          <div className="text-[11px] text-gray-400 mt-1">{opt.optionDescription}</div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-obsidian border border-dashed border-gray-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div>
                <span className="text-gray-300 font-bold block text-sm">
                  No Audience Decision Currently Active
                </span>
                <span className="text-gray-500 text-xs">
                  Launch a live audience vote to let spectators influence the game world.
                </span>
              </div>
              <button
                onClick={() => {
                  handleVotePresetChange('double_xp_arts');
                  setActiveModal('create_audience_vote');
                }}
                className="btn btn-primary text-xs py-2 px-4 font-bold"
              >
                + Launch Audience Decision
              </button>
            </div>
          )}

          {/* UPCOMING & RESOLVED SPLIT GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            {/* Scheduled Upcoming Votes */}
            <div className="p-3 bg-obsidian border border-gray-800 rounded-2xl space-y-2">
              <span className="font-bold text-xs text-white uppercase block">
                📅 Scheduled / Upcoming Votes ({upcomingAudienceEvents.length})
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {upcomingAudienceEvents.length === 0 ? (
                  <div className="text-gray-500 text-xs">No upcoming scheduled votes.</div>
                ) : (
                  upcomingAudienceEvents.map((ue) => (
                    <div
                      key={ue.id}
                      className="p-2.5 bg-card border border-gray-800 rounded-xl flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-white block">{ue.title}</span>
                        <span className="text-gray-400 text-[10px]">
                          Scheduled: {ue.startsAt ? new Date(ue.startsAt).toLocaleTimeString() : 'Manual'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleActivateAudienceEvent(ue.id)}
                        className="btn btn-primary text-[10px] py-1 px-2.5 font-bold"
                      >
                        🚀 Launch Now
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recently Resolved History */}
            <div className="p-3 bg-obsidian border border-gray-800 rounded-2xl space-y-2">
              <span className="font-bold text-xs text-white uppercase block">
                🏆 Recently Resolved Decisions ({resolvedAudienceEvents.length})
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {resolvedAudienceEvents.length === 0 ? (
                  <div className="text-gray-500 text-xs">No resolved decisions recorded yet.</div>
                ) : (
                  resolvedAudienceEvents.map((re) => (
                    <div
                      key={re.id}
                      className="p-2.5 bg-card border border-gray-800 rounded-xl space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{re.title}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            re.status === 'cancelled'
                              ? 'bg-red-950 text-red-300 border border-red-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {re.status === 'cancelled'
                            ? 'CANCELLED'
                            : re.isManuallyOverridden
                            ? 'GM OVERRIDE'
                            : 'RESOLVED'}
                        </span>
                      </div>
                      {re.overrideReason && (
                        <div className="text-[10px] text-purple-300">
                          GM Reason: {re.overrideReason}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

        {/* 7. TAB: GAME DIRECTOR CONTROLS */}
        {activeTab === 'director' && (
          <div className="space-y-6">
            {/* 1-CLICK ACTION CONTROLS GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <button
                onClick={() => setActiveModal('announce')}
                className="p-3.5 bg-obsidian hover:bg-amber-950/30 border border-amber-500/40 hover:border-amber-400 rounded-2xl text-left space-y-1 transition-all active:scale-95 shadow min-h-[44px]"
              >
                <span className="text-xl block">📢</span>
                <span className="text-white font-bold text-xs block">Broadcast Alert</span>
                <span className="text-[10px] text-gray-400 block">Live ticker alert</span>
              </button>

              <button
                onClick={() => setActiveModal('flash')}
                className="p-3.5 bg-obsidian hover:bg-red-950/30 border border-red-500/40 hover:border-red-400 rounded-2xl text-left space-y-1 transition-all active:scale-95 shadow min-h-[44px]"
              >
                <span className="text-xl block">⚡</span>
                <span className="text-white font-bold text-xs block">Flash Drop</span>
                <span className="text-[10px] text-gray-400 block">Timed pop-up quest</span>
              </button>

              <button
                onClick={() => {
                  handleVotePresetChange('custom');
                  setActiveModal('create_audience_vote');
                }}
                className="p-3.5 bg-obsidian hover:bg-purple-950/30 border border-purple-500/50 hover:border-purple-400 rounded-2xl text-left space-y-1 transition-all active:scale-95 shadow min-h-[44px]"
              >
                <span className="text-xl block">🗳️</span>
                <span className="text-purple-300 font-bold text-xs block">Audience Vote</span>
                <span className="text-[10px] text-gray-400 block">Launch public vote</span>
              </button>

              <button
                onClick={() => setActiveModal('bonus')}
                className="p-3.5 bg-obsidian hover:bg-amber-950/30 border border-amber-500/40 hover:border-amber-400 rounded-2xl text-left space-y-1 transition-all active:scale-95 shadow min-h-[44px]"
              >
                <span className="text-xl block">🔥</span>
                <span className="text-white font-bold text-xs block">Bonus Window</span>
                <span className="text-[10px] text-gray-400 block">2x/3x multiplier</span>
              </button>

              <button
                onClick={() => setActiveModal('score')}
                className="p-3.5 bg-obsidian hover:bg-cyan-950/30 border border-cyan-500/40 hover:border-cyan-400 rounded-2xl text-left space-y-1 transition-all active:scale-95 shadow min-h-[44px]"
              >
                <span className="text-xl block">➕</span>
                <span className="text-cyan-300 font-bold text-xs block">Score Adjust</span>
                <span className="text-[10px] text-gray-400 block">Manual XP adjust</span>
              </button>
            </div>

            {/* PHASE SELECTOR BAR */}
            <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3 border-gray-800">
              <span className="text-white font-bold text-xs">CHANGE EVENT PHASE:</span>
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
                    className={`px-3 py-2 rounded-xl uppercase font-bold text-[11px] border transition-all min-h-[44px] ${
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
                  <button onClick={() => setActiveModal('announce')} className="text-amber-400 hover:underline text-xs font-bold">
                    + New
                  </button>
                </h2>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {announcements.length === 0 ? (
                    <div className="text-gray-500 text-xs">No active announcements.</div>
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
                        <div className="text-gray-300 text-xs">{a.message}</div>
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
                    <div className="text-gray-500 text-xs">No recent activity logged.</div>
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
          </div>
        )}

        {/* OPERATIONAL LIVE EVENT TIMELINE & AUDIT TRAIL */}
        <div className="glass-panel p-5 border-cyan-500/40 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
              <h2 className="font-extrabold text-sm text-white uppercase tracking-wider">
                📜 LIVE EVENT OPERATIONAL TIMELINE & AUDIT TRAIL
              </h2>
            </div>

            <div className="flex gap-1 bg-obsidian p-1 rounded-xl border border-gray-800 text-[10px]">
              {(['all', 'audience', 'phases', 'effects'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimelineFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg uppercase font-bold transition-all ${
                    timelineFilter === filter
                      ? 'bg-cyan-500 text-obsidian'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {timelineLogs.length === 0 ? (
              <div className="text-gray-500 text-xs">No live operational events logged yet.</div>
            ) : (
              timelineLogs
                .filter((entry) => {
                  if (timelineFilter === 'audience')
                    return entry.actionType.startsWith('audience_');
                  if (timelineFilter === 'phases')
                    return entry.actionType === 'phase_change' || entry.actionType === 'emergency_pause';
                  if (timelineFilter === 'effects')
                    return entry.actionType === 'effect_executed' || entry.actionType === 'flash_quest_triggered';
                  return true;
                })
                .map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                      entry.isRehearsal
                        ? 'bg-yellow-950/20 border-yellow-800/40'
                        : 'bg-obsidian border-gray-800'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{entry.title}</span>
                        {entry.isRehearsal && (
                          <span className="px-1.5 py-0.2 rounded bg-yellow-500/20 text-yellow-300 text-[8px] font-bold border border-yellow-500/30">
                            REHEARSAL
                          </span>
                        )}
                      </div>
                      <div className="text-gray-300 text-[11px]">{entry.details}</div>
                      <div className="text-[10px] text-gray-500">Actor: {entry.actor}</div>
                    </div>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      </main>

      {/* ACTION MODALS */}
      {/* AUDIENCE VOTE CREATOR MODAL */}
      {activeModal === 'create_audience_vote' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-lg w-full bg-obsidian border border-purple-500/40 p-6 rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>🗳️ Create & Launch Audience Decision</span>
            </h3>

            <form onSubmit={handleCreateAudienceVote} className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-1">Effect Preset</label>
                <select
                  value={votePreset}
                  onChange={(e) => handleVotePresetChange(e.target.value)}
                  className="input-field text-xs"
                >
                  <option value="custom">-- Custom Decision --</option>
                  <option value="double_xp_arts">🎨 Double XP Arts District (30m)</option>
                  <option value="flash_drop">⚡ Centennial Plaza Flash Drop (20m)</option>
                  <option value="secret_passcode">🔑 Secret Passcode Drop (150 XP)</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1">Decision Title</label>
                <input
                  type="text"
                  value={voteTitle}
                  onChange={(e) => setVoteTitle(e.target.value)}
                  placeholder="e.g. 🎯 COMMUNITY MULTIPLIER: ARTS CORRIDOR"
                  className="input-field text-xs font-bold text-white"
                  required
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">Public Description / Prompt</label>
                <textarea
                  value={voteDescription}
                  onChange={(e) => setVoteDescription(e.target.value)}
                  placeholder="e.g. Should all agents in the Arts District receive Double XP?"
                  className="input-field text-xs h-16"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 block mb-1">Duration (Minutes)</label>
                  <select
                    value={voteDuration}
                    onChange={(e) => setVoteDuration(Number(e.target.value))}
                    className="input-field text-xs"
                  >
                    <option value={3}>3 Minutes (Fast)</option>
                    <option value={5}>5 Minutes (Standard)</option>
                    <option value={10}>10 Minutes (Extended)</option>
                    <option value={15}>15 Minutes</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Activation Mode</label>
                  <select
                    value={launchImmediately ? 'now' : 'schedule'}
                    onChange={(e) => setLaunchImmediately(e.target.value === 'now')}
                    className="input-field text-xs"
                  >
                    <option value="now">🚀 Launch Immediately</option>
                    <option value="schedule">📅 Save as Scheduled</option>
                  </select>
                </div>
              </div>

              {/* Options Config */}
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <span className="font-bold text-white text-xs block">Voting Options</span>
                {voteOptions.map((opt, idx) => (
                  <div key={idx} className="p-3 bg-card rounded-xl border border-gray-800 space-y-2">
                    <span className="text-purple-300 font-bold text-[10px]">Option #{idx + 1}</span>
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => {
                        const next = [...voteOptions];
                        next[idx].label = e.target.value;
                        setVoteOptions(next);
                      }}
                      placeholder="Option label"
                      className="input-field text-xs"
                      required
                    />
                    <input
                      type="text"
                      value={opt.description}
                      onChange={(e) => {
                        const next = [...voteOptions];
                        next[idx].description = e.target.value;
                        setVoteOptions(next);
                      }}
                      placeholder="Option description for spectators"
                      className="input-field text-xs"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-3">
                <button type="submit" className="btn btn-primary text-xs py-2 px-4 flex-1 font-bold">
                  {launchImmediately ? '🚀 LAUNCH VOTE NOW' : '💾 SAVE SCHEDULED VOTE'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="btn btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERRIDE MODAL */}
      {activeModal === 'override_vote' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-obsidian border border-purple-500/40 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white">⚡ Game Master Manual Override</h3>
            <p className="text-xs text-gray-300">
              Select the option you wish to resolve directly, bypassing the standard vote count.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-1">Select Winning Option</label>
                <select
                  value={overrideSelectedOptionId}
                  onChange={(e) => setOverrideSelectedOptionId(e.target.value)}
                  className="input-field text-xs"
                >
                  {activeAudienceOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.optionLabel} ({opt.voteCount} votes)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Override Reason (Audited & Published)</label>
                <input
                  type="text"
                  value={overrideReasonInput}
                  onChange={(e) => setOverrideReasonInput(e.target.value)}
                  placeholder="e.g. Field safety balancing"
                  className="input-field text-xs"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    handleResolveAudienceEvent(
                      overrideTargetEventId,
                      overrideSelectedOptionId,
                      overrideReasonInput
                    )
                  }
                  className="btn btn-primary text-xs py-2 px-4 flex-1 font-bold"
                >
                  ⚡ APPLY OVERRIDE & EXECUTE
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="btn btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL VOTE MODAL */}
      {activeModal === 'cancel_vote' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-obsidian border border-red-500/40 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white">⛔ Cancel Active Audience Decision</h3>
            <p className="text-xs text-gray-300">
              Cancelling this decision will immediately close voting without applying any gameplay effects.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-1">Cancellation Reason</label>
                <input
                  type="text"
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="e.g. Inclement weather / event pause"
                  className="input-field text-xs"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleCancelAudienceEvent(cancelTargetEventId, cancelReasonInput)}
                  className="btn btn-danger text-xs py-2 px-4 flex-1 font-bold"
                >
                  ⛔ CONFIRM CANCELLATION
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="btn btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* 8. END EVENT MODAL */}
      {activeModal === ('end_event' as any) && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="max-w-md w-full bg-obsidian border-2 border-red-500 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-red-400">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-base font-extrabold text-white uppercase tracking-wider">
                CONFIRM FINAL EVENT CLOSURE
              </h3>
            </div>
            <p className="text-xs text-gray-300">
              This action transitions the event to <strong>ENDED</strong>. It permanently halts new quest submissions, closes active spectator voting airwaves, locks the final leaderboard, and preserves drawing entries.
            </p>
            <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-[11px] text-red-200">
              <strong>OPERATIONAL INVARIANT:</strong> Historical score ledgers, player profiles, and audit timeline records remain permanently intact.
            </div>
            <div className="space-y-2">
              <label className="text-gray-400 block text-xs">Closure Reason / Notes</label>
              <input
                type="text"
                value={closureReasonInput}
                onChange={(e) => setClosureReasonInput(e.target.value)}
                placeholder="e.g. Live Event Concluded Gracefully"
                className="input-field text-xs text-white"
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleEndEventClosure}
                className="py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl text-xs flex-1 uppercase tracking-wider min-h-[44px]"
              >
                🏁 CONCLUDE & LOCK EVENT
              </button>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="btn btn-secondary text-xs py-2 px-4 min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
