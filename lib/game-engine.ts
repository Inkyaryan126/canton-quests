// Canton Quests — Core Game Engine & Persistence Layer (Phase 4 Event Factory)

import {
  Player,
  QuestEvent,
  Quest,
  QuestStep,
  QuestSubmission,
  ScoreLedgerEntry,
  DrawingEntryLedgerEntry,
  EventDrawingLedgerLock,
  PublicDrawingLedgerProjection,
  PublicPlayerDrawingEntry,
  PublicQuestView,
  LeaderboardEntry,
  PlayerEventProgress,
  ProofVerificationType,
  Team,
  TeamMember,
  TeamLeaderboardEntry,
  QuestState,
  SubmitProofParams,
  SubmitProofResult,
  EventActivityItem,
  EventPhaseType,
  LiveAnnouncement,
  SecretCode,
  CodeRedemption,
  Collectible,
  PlayerCollectible,
  NPCCharacter,
  BusinessPartnerInfo,
  CrowdObjective,
  BonusWindow,
  FinaleQualification,
  Prize,
  EventReadiness,
  QuestTemplate,
  GeneratedQR,
  LocationInfo,
  ProofReviewFlag,
  DrawingStatus,
  CanonicalSnapshotPlayer,
  CanonicalSnapshot,
  DrawMethod,
  PrizeDrawRecord,
  PublicPrizeDrawResult,
  PublicDrawingPageData,
  DrawingLedgerReview,
  DrawProvider,
} from './types';
import {
  SEED_CITY,
  SEED_LOCATIONS,
  SEED_EVENT,
  SEED_QUESTS,
  SEED_DEMO_PLAYERS,
  SEED_TEAMS,
  SEED_TEAM_MEMBERS,
  SEED_COLLECTIBLES,
  SEED_SECRET_CODES,
  SEED_ANNOUNCEMENTS,
  SEED_NPCS,
  SEED_PARTNERS,
  SEED_CROWD_OBJECTIVES,
  SEED_BONUS_WINDOWS,
  SEED_PRIZES,
} from './seed-data';
import { checkProximity, formatDistance } from './geo';
import { evaluateProofIntegrity } from './proof-integrity';
import { sanitizeTextContent } from './spectator-engine';

const STORAGE_KEYS = {
  CURRENT_PLAYER: 'canton_quests_current_player',
  PLAYERS: 'canton_quests_players',
  EVENTS: 'canton_quests_events',
  QUESTS: 'canton_quests_quests',
  SUBMISSIONS: 'canton_quests_submissions',
  SCORE_LEDGER: 'canton_quests_score_ledger',
  DRAWING_LEDGER: 'canton_quests_drawing_ledger',
  DRAWING_LOCKS: 'canton_quests_drawing_locks',
  TEAMS: 'canton_quests_teams',
  TEAM_MEMBERS: 'canton_quests_team_members',
  ACTIVITY_LOG: 'canton_quests_activity_log',
  ANNOUNCEMENTS: 'canton_quests_announcements',
  SECRET_CODES: 'canton_quests_secret_codes',
  CODE_REDEMPTIONS: 'canton_quests_code_redemptions',
  COLLECTIBLES: 'canton_quests_collectibles',
  PLAYER_COLLECTIBLES: 'canton_quests_player_collectibles',
  NPCS: 'canton_quests_npcs',
  PARTNERS: 'canton_quests_partners',
  CROWD_OBJECTIVES: 'canton_quests_crowd_objectives',
  BONUS_WINDOWS: 'canton_quests_bonus_windows',
  FINALE_QUALIFICATIONS: 'canton_quests_finale_qualifications',
  PRIZES: 'canton_quests_prizes',
  PRIZE_DRAWS: 'canton_quests_prize_draw_records',
  GENERATED_QRS: 'canton_quests_generated_qrs',
  LOCATIONS: 'canton_quests_locations',
};

const inMemoryStore = new Map<string, any>();

const MAX_TRUSTED_GPS_ACCURACY_METERS = 100;

function getServerProofSecretMaps():
  | {
      QUEST_TARGET_CODE_HASHES: Record<string, string>;
      SECRET_CODE_HASHES: Record<string, string>;
    }
  | undefined {
  if (typeof window !== 'undefined') return undefined;
  const nodeRequire = eval('require') as (id: string) => any;
  return nodeRequire(`${process.cwd()}/lib/quest-proof-secrets.server.json`);
}

function mergeServerQuestTargetCodes(quests: Quest[]): Quest[] {
  const maps = getServerProofSecretMaps();
  if (!maps) return quests;
  return quests.map((quest) => ({
    ...quest,
    targetCode: quest.targetCode || maps.QUEST_TARGET_CODE_HASHES[quest.id],
  }));
}

function mergeServerSecretCodes(codes: SecretCode[]): SecretCode[] {
  const maps = getServerProofSecretMaps();
  if (!maps) return codes;
  return codes.map((code) => ({
    ...code,
    code: code.code || maps.SECRET_CODE_HASHES[code.id] || '',
  }));
}

function proofDigest(value: string): string | undefined {
  if (typeof window !== 'undefined') return undefined;
  const nodeRequire = eval('require') as (id: string) => any;
  return nodeRequire('crypto').createHash('sha256').update(value.trim().toUpperCase()).digest('hex');
}

function proofMatches(inputValue: string | undefined, targetValue: string | undefined): boolean {
  const input = (inputValue || '').trim().toUpperCase();
  const target = (targetValue || '').trim();
  if (!input || !target) return false;
  if (target.toLowerCase().startsWith('sha256:')) {
    return proofDigest(input) === target.slice('sha256:'.length).toLowerCase();
  }
  return input === target.toUpperCase();
}

function getStoredItem<T>(key: string, fallback: T): T {
  const resolvedFallback =
    key === STORAGE_KEYS.QUESTS
      ? (mergeServerQuestTargetCodes(fallback as Quest[]) as T)
      : key === STORAGE_KEYS.SECRET_CODES
        ? (mergeServerSecretCodes(fallback as SecretCode[]) as T)
        : fallback;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(`Error reading ${key} from localStorage`, e);
    }
  }
  return inMemoryStore.has(key) ? inMemoryStore.get(key) : resolvedFallback;
}

function setStoredItem<T>(key: string, value: T): void {
  inMemoryStore.set(key, value);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error writing ${key} to localStorage`, e);
    }
  }
}

// Ensure default seed data is initialized in storage
export function initializeGameEngine(): void {
  if (getStoredItem<QuestEvent[]>(STORAGE_KEYS.EVENTS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.EVENTS, [SEED_EVENT]);
  }
  if (getStoredItem<Quest[]>(STORAGE_KEYS.QUESTS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.QUESTS, mergeServerQuestTargetCodes(SEED_QUESTS));
  }
  if (getStoredItem<LocationInfo[]>(STORAGE_KEYS.LOCATIONS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.LOCATIONS, SEED_LOCATIONS);
  }
  if (getStoredItem<Player[]>(STORAGE_KEYS.PLAYERS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.PLAYERS, SEED_DEMO_PLAYERS);
  }
  if (getStoredItem<Team[]>(STORAGE_KEYS.TEAMS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.TEAMS, SEED_TEAMS);
  }
  if (getStoredItem<TeamMember[]>(STORAGE_KEYS.TEAM_MEMBERS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.TEAM_MEMBERS, SEED_TEAM_MEMBERS);
  }
  if (getStoredItem<Collectible[]>(STORAGE_KEYS.COLLECTIBLES, []).length === 0) {
    setStoredItem(STORAGE_KEYS.COLLECTIBLES, SEED_COLLECTIBLES);
  }
  if (getStoredItem<SecretCode[]>(STORAGE_KEYS.SECRET_CODES, []).length === 0) {
    setStoredItem(STORAGE_KEYS.SECRET_CODES, mergeServerSecretCodes(SEED_SECRET_CODES));
  }
  if (getStoredItem<LiveAnnouncement[]>(STORAGE_KEYS.ANNOUNCEMENTS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.ANNOUNCEMENTS, SEED_ANNOUNCEMENTS);
  }
  if (getStoredItem<NPCCharacter[]>(STORAGE_KEYS.NPCS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.NPCS, SEED_NPCS);
  }
  if (getStoredItem<BusinessPartnerInfo[]>(STORAGE_KEYS.PARTNERS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.PARTNERS, SEED_PARTNERS);
  }
  if (getStoredItem<CrowdObjective[]>(STORAGE_KEYS.CROWD_OBJECTIVES, []).length === 0) {
    setStoredItem(STORAGE_KEYS.CROWD_OBJECTIVES, SEED_CROWD_OBJECTIVES);
  }
  if (getStoredItem<BonusWindow[]>(STORAGE_KEYS.BONUS_WINDOWS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.BONUS_WINDOWS, SEED_BONUS_WINDOWS);
  }
  if (getStoredItem<Prize[]>(STORAGE_KEYS.PRIZES, []).length === 0) {
    setStoredItem(STORAGE_KEYS.PRIZES, SEED_PRIZES);
  }
}

export function resetGameEngineStore(): void {
  inMemoryStore.clear();
  initializeGameEngine();
}

// 1. EVENT FACTORY — CREATION, EDIT & DUPLICATION
export function createEventWizard(eventData: Omit<QuestEvent, 'id' | 'createdAt'>): QuestEvent {
  initializeGameEngine();
  const events = getEvents();
  const newEvent: QuestEvent = {
    ...eventData,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    currentPhase: eventData.currentPhase || 'day_1',
    isPaused: false,
    createdAt: new Date().toISOString(),
  };

  setStoredItem(STORAGE_KEYS.EVENTS, [newEvent, ...events]);

  logActivity({
    type: 'announcement',
    actorName: 'Game Master',
    title: `🎉 New Event Created: ${newEvent.title}`,
    details: `Status: ${newEvent.status.toUpperCase()}`,
  });

  return newEvent;
}

export function duplicateEvent(
  sourceEventId: string,
  newTitle: string,
  newSlug: string,
  newDates?: { startTime?: string; endTime?: string }
): { newEvent: QuestEvent; duplicatedQuestsCount: number } {
  initializeGameEngine();
  const events = getEvents();
  const source = events.find((e) => e.id === sourceEventId);
  if (!source) {
    throw new Error('Source event not found!');
  }

  const newEventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newEvent: QuestEvent = {
    ...source,
    id: newEventId,
    title: newTitle.trim(),
    slug: newSlug.trim().toLowerCase().replace(/\s+/g, '-'),
    status: 'draft',
    currentPhase: 'pre_game',
    isPaused: false,
    startTime: newDates?.startTime || source.startTime,
    endTime: newDates?.endTime || source.endTime,
    createdAt: new Date().toISOString(),
  };

  // Duplicate Quests & Maintain Chain Mappings
  const sourceQuests = getQuestsForEvent(sourceEventId);
  const questIdMap = new Map<string, string>();

  const newQuests: Quest[] = sourceQuests.map((sq) => {
    const nqId = `qst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    questIdMap.set(sq.id, nqId);

    return {
      ...sq,
      id: nqId,
      eventId: newEventId,
      currentClaims: 0,
      createdAt: new Date().toISOString(),
    };
  });

  // Re-link Prerequisite Chain IDs
  newQuests.forEach((nq) => {
    if (nq.prerequisiteQuestId && questIdMap.has(nq.prerequisiteQuestId)) {
      nq.prerequisiteQuestId = questIdMap.get(nq.prerequisiteQuestId);
    }
  });

  const allQuests = getStoredItem<Quest[]>(STORAGE_KEYS.QUESTS, SEED_QUESTS);
  setStoredItem(STORAGE_KEYS.EVENTS, [newEvent, ...events]);
  setStoredItem(STORAGE_KEYS.QUESTS, [...allQuests, ...newQuests]);

  logActivity({
    type: 'announcement',
    actorName: 'Game Master',
    title: `📋 Event Duplicated: ${newEvent.title}`,
    details: `${newQuests.length} quests copied from template`,
  });

  return { newEvent, duplicatedQuestsCount: newQuests.length };
}

// 2. EVENT READINESS CHECK & DESIGN METRICS
export function getEventReadinessCheck(eventId: string): EventReadiness {
  initializeGameEngine();
  const event = getEvents().find((e) => e.id === eventId);
  const eventQuests = getQuestsForEvent(eventId);
  const locations = getLocations();

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!event) {
    return {
      isReady: false,
      blockers: ['Event does not exist.'],
      warnings: [],
      metrics: {
        totalQuests: 0,
        totalXp: 0,
        categoryCounts: {},
        locationCount: 0,
        secretCount: 0,
        flashCount: 0,
        chainCount: 0,
        timeLockedXpPercentage: 0,
      },
    };
  }

  if (!event.startTime || !event.endTime) {
    blockers.push('Start time and end time must be configured.');
  }

  if (eventQuests.length === 0) {
    blockers.push('Event must contain at least 1 published/active quest.');
  }

  // Detect Broken Prerequisite Chains & Circular Dependencies
  const questIdSet = new Set(eventQuests.map((q) => q.id));
  let chainCount = 0;

  eventQuests.forEach((q) => {
    if (q.prerequisiteQuestId) {
      chainCount++;
      if (q.prerequisiteQuestId === q.id) {
        blockers.push(`Quest "${q.title}" cannot be its own prerequisite.`);
      } else if (!questIdSet.has(q.prerequisiteQuestId)) {
        blockers.push(`Quest "${q.title}" references a missing prerequisite quest ID (${q.prerequisiteQuestId}).`);
      }
    }
  });

  // Calculate Metrics
  let totalXp = 0;
  let timeLockedXp = 0;
  let secretCount = 0;
  let flashCount = 0;
  const categoryCounts: Record<string, number> = {};

  eventQuests.forEach((q) => {
    totalXp += q.pointValue;
    categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;

    if (q.isSecret) secretCount++;
    if (q.isFlash) {
      flashCount++;
      timeLockedXp += q.pointValue;
    }
  });

  if (totalXp < 500) {
    warnings.push('Total event XP is below 500. Consider adding more quests for player progression.');
  }

  const timeLockedXpPercentage = totalXp > 0 ? Math.round((timeLockedXp / totalXp) * 100) : 0;
  if (timeLockedXpPercentage > 40) {
    warnings.push(`High time-locked XP (${timeLockedXpPercentage}%). Partial-weekend players may be disadvantaged.`);
  }

  return {
    isReady: blockers.length === 0,
    blockers,
    warnings,
    metrics: {
      totalQuests: eventQuests.length,
      totalXp,
      categoryCounts,
      locationCount: locations.length,
      secretCount,
      flashCount,
      chainCount,
      timeLockedXpPercentage,
    },
  };
}

// 3. QUEST STUDIO & TEMPLATES
export function getQuestTemplates(): QuestTemplate[] {
  return [
    {
      id: 'tmpl-checkin',
      name: 'Landmark GPS Check-In',
      description: 'Physical location check-in via GPS proximity sensor (e.g. Centennial Plaza).',
      preset: {
        category: 'exploration',
        verificationType: 'checkin',
        pointValue: 50,
        difficulty: 'easy',
        proofRequirement: 'Confirm physical check-in within location radius.',
        radiusMeters: 60,
      },
    },
    {
      id: 'tmpl-qr-discovery',
      name: 'QR Emblem Discovery',
      description: 'Find and scan an official Canton Quests QR emblem card.',
      preset: {
        category: 'business_partner',
        verificationType: 'qr',
        pointValue: 100,
        difficulty: 'easy',
        proofRequirement: 'Scan or enter QR passcode displayed at partner location.',
        requireQrAndLocation: true,
      },
    },
    {
      id: 'tmpl-passphrase',
      name: 'Plaque Passphrase Cipher',
      description: 'Find historic year or inscription on a bronze plaque or stone.',
      preset: {
        category: 'puzzle',
        verificationType: 'passphrase',
        pointValue: 150,
        difficulty: 'medium',
        proofRequirement: 'Enter the exact word or year found on the plaque.',
      },
    },
    {
      id: 'tmpl-photo-challenge',
      name: 'Creative Photo Challenge',
      description: 'Upload a team victory pose or creative photo in front of a landmark.',
      preset: {
        category: 'creative',
        verificationType: 'photo',
        pointValue: 200,
        difficulty: 'medium',
        proofRequirement: 'Upload a photo showing team members at the location.',
      },
    },
    {
      id: 'tmpl-flash-drop',
      name: '⚡ Timed Pop-Up Flash Drop',
      description: 'Pop-up drop with active countdown timer.',
      preset: {
        category: 'flash',
        verificationType: 'checkin',
        pointValue: 250,
        difficulty: 'medium',
        isFlash: true,
        proofRequirement: 'Rapid physical check-in before timer expires.',
      },
    },
    {
      id: 'tmpl-secret-quest',
      name: '🔒 Hidden Secret Cipher',
      description: 'Unlisted quest hidden from map/list until unlocked by passcode or collectible.',
      preset: {
        category: 'secret',
        verificationType: 'passphrase',
        pointValue: 500,
        difficulty: 'epic',
        isSecret: true,
        proofRequirement: 'Enter decoded master passphrase.',
      },
    },
  ];
}

export function duplicateQuest(questId: string): Quest | undefined {
  initializeGameEngine();
  const quest = getQuestById(questId);
  if (!quest) return undefined;

  const newQuest: Quest = {
    ...quest,
    id: `qst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: `${quest.title} (Copy)`,
    slug: `${quest.slug}-copy-${Math.floor(Math.random() * 1000)}`,
    currentClaims: 0,
    createdAt: new Date().toISOString(),
  };

  const quests = getStoredItem<Quest[]>(STORAGE_KEYS.QUESTS, SEED_QUESTS);
  setStoredItem(STORAGE_KEYS.QUESTS, [...quests, newQuest]);
  return newQuest;
}

// 4. LOCATION MANAGER
export function getLocations(): LocationInfo[] {
  initializeGameEngine();
  return getStoredItem<LocationInfo[]>(STORAGE_KEYS.LOCATIONS, SEED_LOCATIONS);
}

export function createLocation(locData: Omit<LocationInfo, 'id'>): LocationInfo {
  initializeGameEngine();
  const locs = getLocations();
  const newLoc: LocationInfo = {
    ...locData,
    id: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  };
  setStoredItem(STORAGE_KEYS.LOCATIONS, [...locs, newLoc]);
  return newLoc;
}

export function updateLocation(locId: string, updates: Partial<LocationInfo>): LocationInfo | undefined {
  initializeGameEngine();
  const locs = getLocations();
  const idx = locs.findIndex((l) => l.id === locId);
  if (idx === -1) return undefined;

  const updated = { ...locs[idx], ...updates };
  locs[idx] = updated;
  setStoredItem(STORAGE_KEYS.LOCATIONS, locs);
  return updated;
}

// 5. QR CODE STUDIO & TOKEN RESOLUTION
export function generateQRCodeToken(
  eventId: string,
  targetType: GeneratedQR['targetType'],
  targetId: string,
  label: string
): GeneratedQR {
  initializeGameEngine();
  const qrs = getStoredItem<GeneratedQR[]>(STORAGE_KEYS.GENERATED_QRS, []);
  const token = `CQQR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const targetUrl = `https://divinedesigndestinations.com/qr/${token}`;

  const newQr: GeneratedQR = {
    id: `qr-${Date.now()}`,
    eventId,
    token,
    targetType,
    targetId,
    targetUrl,
    label: label.trim(),
    createdAt: new Date().toISOString(),
  };

  setStoredItem(STORAGE_KEYS.GENERATED_QRS, [...qrs, newQr]);
  return newQr;
}

export function getGeneratedQRs(eventId: string): GeneratedQR[] {
  initializeGameEngine();
  return getStoredItem<GeneratedQR[]>(STORAGE_KEYS.GENERATED_QRS, []).filter((q) => q.eventId === eventId);
}

export function resolveQRToken(token: string): GeneratedQR | undefined {
  initializeGameEngine();
  const qrs = getStoredItem<GeneratedQR[]>(STORAGE_KEYS.GENERATED_QRS, []);
  const clean = token.trim().toUpperCase();
  return qrs.find((q) => q.token.toUpperCase() === clean);
}

// 6. EVENT EXPORT & IMPORT UTILITIES
export function exportEventJSON(eventId: string): string {
  initializeGameEngine();
  const event = getEvents().find((e) => e.id === eventId);
  const eventQuests = getQuestsForEvent(eventId);
  const locations = getLocations();
  const secretCodes = getStoredItem<SecretCode[]>(STORAGE_KEYS.SECRET_CODES, []).filter((c) => c.eventId === eventId);
  const collectibles = getStoredItem<Collectible[]>(STORAGE_KEYS.COLLECTIBLES, SEED_COLLECTIBLES);
  const npcs = getNPCCharacters(eventId);

  const exportPayload = {
    version: '4.0',
    exportedAt: new Date().toISOString(),
    event,
    quests: eventQuests,
    locations,
    secretCodes,
    collectibles,
    npcs,
  };

  return JSON.stringify(exportPayload, null, 2);
}

export function importEventJSON(jsonStr: string): { success: boolean; message: string; newEvent?: QuestEvent } {
  try {
    const payload = JSON.parse(jsonStr);
    if (!payload.event || !payload.quests) {
      return { success: false, message: 'Invalid Canton Quests export format.' };
    }

    const dupResult = duplicateEvent(
      SEED_EVENT.id,
      payload.event.title || 'Imported Event',
      payload.event.slug || `imported-${Date.now()}`
    );

    return {
      success: true,
      message: `Event "${dupResult.newEvent.title}" imported successfully!`,
      newEvent: dupResult.newEvent,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'JSON parsing failed.' };
  }
}

// 7. EXISTING GAME FUNCTIONS (Phase 1, 2 & 3)
export function setEventPhase(eventId: string, phase: EventPhaseType): QuestEvent | undefined {
  initializeGameEngine();
  const events = getEvents();
  const event = events.find((e) => e.id === eventId);
  if (!event) return undefined;

  event.currentPhase = phase;
  setStoredItem(STORAGE_KEYS.EVENTS, events);

  logActivity({
    type: 'phase_change',
    actorName: 'Game Director',
    title: `🔄 Event Phase Changed: ${phase.toUpperCase()}`,
    details: `Canton Quests entered ${phase} phase`,
  });

  return event;
}

export function toggleEventPause(eventId: string, isPaused: boolean, reason?: string): QuestEvent | undefined {
  initializeGameEngine();
  const events = getEvents();
  const event = events.find((e) => e.id === eventId);
  if (!event) return undefined;

  event.isPaused = isPaused;
  event.pauseReason = reason;
  setStoredItem(STORAGE_KEYS.EVENTS, events);

  logActivity({
    type: 'announcement',
    actorName: 'Game Master',
    title: isPaused ? '🛑 EVENT TEMPORARILY PAUSED' : '▶️ EVENT RESUMED',
    details: reason || (isPaused ? 'Event paused for field safety check' : 'Event resumed'),
  });

  return event;
}

export function createAnnouncement(
  eventId: string,
  title: string,
  message: string,
  urgency: LiveAnnouncement['urgency'] = 'info',
  expiresAt?: string,
  linkedQuestId?: string
): LiveAnnouncement {
  initializeGameEngine();
  const announcements = getStoredItem<LiveAnnouncement[]>(STORAGE_KEYS.ANNOUNCEMENTS, SEED_ANNOUNCEMENTS);

  const newAnn: LiveAnnouncement = {
    id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    eventId,
    title: title.trim(),
    message: message.trim(),
    urgency,
    expiresAt,
    linkedQuestId,
    createdAt: new Date().toISOString(),
  };

  setStoredItem(STORAGE_KEYS.ANNOUNCEMENTS, [newAnn, ...announcements]);

  logActivity({
    type: 'announcement',
    actorName: 'Game Director',
    title: `📢 Announcement: ${newAnn.title}`,
    details: newAnn.message,
  });

  return newAnn;
}

export function getAnnouncements(eventId: string): LiveAnnouncement[] {
  initializeGameEngine();
  const announcements = getStoredItem<LiveAnnouncement[]>(STORAGE_KEYS.ANNOUNCEMENTS, SEED_ANNOUNCEMENTS);
  const now = Date.now();
  return announcements
    .filter((a) => a.eventId === eventId)
    .filter((a) => !a.expiresAt || new Date(a.expiresAt).getTime() > now)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createSecretCode(
  eventId: string,
  code: string,
  description: string,
  bonusPoints: number = 100,
  maxRedemptions?: number,
  grantCollectibleId?: string
): SecretCode {
  initializeGameEngine();
  const codes = getStoredItem<SecretCode[]>(STORAGE_KEYS.SECRET_CODES, SEED_SECRET_CODES);

  const newCode: SecretCode = {
    id: `code-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    eventId,
    code: code.trim().toUpperCase(),
    description: description.trim(),
    bonusPoints,
    maxRedemptions,
    currentRedemptions: 0,
    isActive: true,
    grantCollectibleId,
    createdAt: new Date().toISOString(),
  };

  setStoredItem(STORAGE_KEYS.SECRET_CODES, [...codes, newCode]);
  return newCode;
}

export function redeemSecretCode(
  codeStr: string,
  playerId: string,
  eventId: string
): { success: boolean; message: string; pointsAwarded: number; collectibleAwarded?: Collectible } {
  initializeGameEngine();
  const codes = getStoredItem<SecretCode[]>(STORAGE_KEYS.SECRET_CODES, SEED_SECRET_CODES);
  const redemptions = getStoredItem<CodeRedemption[]>(STORAGE_KEYS.CODE_REDEMPTIONS, []);

  const targetCode = codes.find((c) => c.eventId === eventId && proofMatches(codeStr, c.code) && c.isActive);
  if (!targetCode) {
    return { success: false, message: 'Invalid or inactive secret passcode!', pointsAwarded: 0 };
  }

  if (targetCode.expiresAt && new Date(targetCode.expiresAt).getTime() <= Date.now()) {
    return { success: false, message: 'This secret passcode has expired!', pointsAwarded: 0 };
  }

  if (targetCode.maxRedemptions && targetCode.currentRedemptions >= targetCode.maxRedemptions) {
    return { success: false, message: 'Maximum redemptions reached for this passcode!', pointsAwarded: 0 };
  }

  const alreadyRedeemed = redemptions.some((r) => r.codeId === targetCode.id && r.playerId === playerId);
  if (alreadyRedeemed) {
    return { success: false, message: 'You have already redeemed this passcode!', pointsAwarded: 0 };
  }

  targetCode.currentRedemptions += 1;
  setStoredItem(STORAGE_KEYS.SECRET_CODES, codes);

  const newRedemption: CodeRedemption = {
    id: `red-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    codeId: targetCode.id,
    playerId,
    redeemedAt: new Date().toISOString(),
    pointsAwarded: targetCode.bonusPoints,
  };
  setStoredItem(STORAGE_KEYS.CODE_REDEMPTIONS, [...redemptions, newRedemption]);

  recordScoreLedger({
    eventId,
    playerId,
    points: targetCode.bonusPoints,
    category: 'secret_code',
    description: 'Redeemed Secret Code',
  });

  let grantedCol: Collectible | undefined = undefined;
  if (targetCode.grantCollectibleId) {
    grantedCol = awardCollectible(playerId, targetCode.grantCollectibleId, 'Secret Code');
  }

  const player = getAllPlayers().find((p) => p.id === playerId);
  logActivity({
    type: 'code_redeemed',
    actorName: player?.displayName || 'Player',
    title: 'Passcode Redeemed',
    details: `+${targetCode.bonusPoints} XP awarded`,
  });

  return {
    success: true,
    message: `Passcode cracked! +${targetCode.bonusPoints} XP awarded!`,
    pointsAwarded: targetCode.bonusPoints,
    collectibleAwarded: grantedCol,
  };
}

export function awardCollectible(playerId: string, collectibleId: string, source: string = 'quest'): Collectible | undefined {
  initializeGameEngine();
  const catalog = getStoredItem<Collectible[]>(STORAGE_KEYS.COLLECTIBLES, SEED_COLLECTIBLES);
  const playerCols = getStoredItem<PlayerCollectible[]>(STORAGE_KEYS.PLAYER_COLLECTIBLES, []);

  const item = catalog.find((c) => c.id === collectibleId || c.slug === collectibleId);
  if (!item) return undefined;

  const alreadyHas = playerCols.some((pc) => pc.playerId === playerId && pc.collectibleId === item.id);
  if (!alreadyHas) {
    const newRecord: PlayerCollectible = {
      id: `pcol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      playerId,
      collectibleId: item.id,
      earnedAt: new Date().toISOString(),
      source,
      collectible: item,
    };
    setStoredItem(STORAGE_KEYS.PLAYER_COLLECTIBLES, [...playerCols, newRecord]);

    const player = getAllPlayers().find((p) => p.id === playerId);
    logActivity({
      type: 'collectible_earned',
      actorName: player?.displayName || 'Player',
      title: `Collectible Unlocked: ${item.name}`,
      details: `${item.badgeSymbol} ${item.description}`,
    });
  }

  return item;
}

export function getCollectiblesForPlayer(playerId: string): PlayerCollectible[] {
  initializeGameEngine();
  const playerCols = getStoredItem<PlayerCollectible[]>(STORAGE_KEYS.PLAYER_COLLECTIBLES, []);
  const catalog = getStoredItem<Collectible[]>(STORAGE_KEYS.COLLECTIBLES, SEED_COLLECTIBLES);

  return playerCols
    .filter((pc) => pc.playerId === playerId)
    .map((pc) => ({
      ...pc,
      collectible: catalog.find((c) => c.id === pc.collectibleId),
    }));
}

export function getNPCCharacters(eventId: string): NPCCharacter[] {
  initializeGameEngine();
  const npcs = getStoredItem<NPCCharacter[]>(STORAGE_KEYS.NPCS, SEED_NPCS);
  return npcs.filter((n) => n.eventId === eventId);
}

export function updateNPCCharacter(npcId: string, updates: Partial<NPCCharacter>): NPCCharacter | undefined {
  initializeGameEngine();
  const npcs = getStoredItem<NPCCharacter[]>(STORAGE_KEYS.NPCS, SEED_NPCS);
  const index = npcs.findIndex((n) => n.id === npcId);
  if (index === -1) return undefined;

  const updated = {
    ...npcs[index],
    ...updates,
    lastSpottedAt: new Date().toISOString(),
  };
  npcs[index] = updated;
  setStoredItem(STORAGE_KEYS.NPCS, npcs);

  logActivity({
    type: 'announcement',
    actorName: updated.aliasName,
    title: `🕵️ NPC SPOTTED: ${updated.aliasName}`,
    details: `Zone: ${updated.currentZone} • Clue: ${updated.clueHint}`,
  });

  return updated;
}

export function getCrowdObjectives(eventId: string): CrowdObjective[] {
  initializeGameEngine();
  const objectives = getStoredItem<CrowdObjective[]>(STORAGE_KEYS.CROWD_OBJECTIVES, SEED_CROWD_OBJECTIVES);
  return objectives.filter((co) => co.eventId === eventId);
}

export function incrementCrowdObjective(eventId: string, count: number = 1): void {
  initializeGameEngine();
  const objectives = getStoredItem<CrowdObjective[]>(STORAGE_KEYS.CROWD_OBJECTIVES, SEED_CROWD_OBJECTIVES);
  objectives.forEach((obj) => {
    if (obj.eventId === eventId && !obj.isAchieved) {
      obj.currentCount += count;
      if (obj.currentCount >= obj.targetCount) {
        obj.isAchieved = true;
        logActivity({
          type: 'announcement',
          actorName: 'Canton Community',
          title: `🏆 CROWD OBJECTIVE ACHIEVED: ${obj.title}`,
          details: obj.description,
        });
      }
    }
  });
  setStoredItem(STORAGE_KEYS.CROWD_OBJECTIVES, objectives);
}

export function createBonusWindow(
  eventId: string,
  title: string,
  multiplier: number = 2.0,
  targetCategory?: Quest['category'],
  durationMinutes: number = 45
): BonusWindow {
  initializeGameEngine();
  const windows = getStoredItem<BonusWindow[]>(STORAGE_KEYS.BONUS_WINDOWS, SEED_BONUS_WINDOWS);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();

  const newWindow: BonusWindow = {
    id: `bw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    eventId,
    title: title.trim(),
    multiplier,
    flatBonus: 0,
    targetCategory,
    startsAt: now.toISOString(),
    expiresAt,
    isActive: true,
  };

  setStoredItem(STORAGE_KEYS.BONUS_WINDOWS, [...windows, newWindow]);

  logActivity({
    type: 'bonus_activated',
    actorName: 'Game Master',
    title: `🔥 Bonus Window Activated: ${newWindow.title}`,
    details: `${multiplier}x XP for ${durationMinutes} minutes`,
  });

  return newWindow;
}

export function getActiveBonusMultiplier(eventId: string, category?: Quest['category']): number {
  initializeGameEngine();
  const windows = getStoredItem<BonusWindow[]>(STORAGE_KEYS.BONUS_WINDOWS, SEED_BONUS_WINDOWS);
  const now = Date.now();

  const activeWindow = windows.find((w) => {
    if (w.eventId !== eventId || !w.isActive) return false;
    if (new Date(w.expiresAt).getTime() <= now) return false;
    if (w.targetCategory && w.targetCategory !== category) return false;
    return true;
  });

  return activeWindow ? activeWindow.multiplier : 1.0;
}

export function adjustPlayerScoreManual(
  eventId: string,
  playerId: string,
  points: number,
  reason: string,
  adminName: string = 'Game Master'
): ScoreLedgerEntry {
  initializeGameEngine();
  const entry = recordScoreLedger({
    eventId,
    playerId,
    points,
    category: 'admin_adjustment',
    description: `Manual adjustment by ${adminName}: ${reason}`,
  });

  entry.adminIdentity = adminName;

  logActivity({
    type: 'quest_completed',
    actorName: adminName,
    title: `Manual Score Adjustment (${points > 0 ? '+' : ''}${points} XP)`,
    details: `Reason: ${reason}`,
  });

  return entry;
}

export function reconcilePlayerScores(eventId: string): { reconciledCount: number } {
  initializeGameEngine();
  const ledger = getStoredItem<ScoreLedgerEntry[]>(STORAGE_KEYS.SCORE_LEDGER, []);
  const players = getAllPlayers();

  const playerTotals: Record<string, number> = {};
  ledger
    .filter((entry) => entry.eventId === eventId)
    .forEach((entry) => {
      playerTotals[entry.playerId] = (playerTotals[entry.playerId] || 0) + entry.points;
    });

  let count = 0;
  players.forEach((p) => {
    if (playerTotals[p.id] !== undefined && playerTotals[p.id] !== p.totalXp) {
      p.totalXp = playerTotals[p.id];
      p.level = Math.floor(p.totalXp / 250) + 1;
      count++;
    }
  });

  setStoredItem(STORAGE_KEYS.PLAYERS, players);
  return { reconciledCount: count };
}

export function grantFinaleQualification(
  eventId: string,
  playerId: string,
  reason: string,
  isWildcard: boolean = false
): FinaleQualification {
  initializeGameEngine();
  const quals = getStoredItem<FinaleQualification[]>(STORAGE_KEYS.FINALE_QUALIFICATIONS, []);
  const existing = quals.find((q) => q.eventId === eventId && q.playerId === playerId);

  if (existing) return existing;

  const newQual: FinaleQualification = {
    id: `qual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    eventId,
    playerId,
    qualificationReason: reason,
    isWildcard,
    qualifiedAt: new Date().toISOString(),
  };

  setStoredItem(STORAGE_KEYS.FINALE_QUALIFICATIONS, [...quals, newQual]);

  const player = getAllPlayers().find((p) => p.id === playerId);
  logActivity({
    type: 'finale_qualified',
    actorName: isWildcard ? 'Game Master' : player?.displayName || 'Player',
    title: `🏆 Finale Qualification Granted: ${player?.displayName || 'Agent'}`,
    details: `Reason: ${reason}`,
  });

  return newQual;
}

export function isPlayerQualifiedForFinale(playerId: string, eventId: string): boolean {
  initializeGameEngine();
  const quals = getStoredItem<FinaleQualification[]>(STORAGE_KEYS.FINALE_QUALIFICATIONS, []);
  if (quals.some((q) => q.eventId === eventId && q.playerId === playerId)) return true;

  const player = getAllPlayers().find((p) => p.id === playerId);
  if (player && player.totalXp >= 750) return true;

  const submissions = getSubmissionsForPlayer(playerId, eventId);
  const verifiedCount = submissions.filter((s) => s.status === 'verified').length;
  return verifiedCount >= 5;
}

export function calculateQuestState(
  quest: Quest,
  completedQuestIds: string[],
  pendingQuestIds: string[],
  nowMs: number = Date.now()
): QuestState {
  if (completedQuestIds.includes(quest.id)) return 'completed';
  if (pendingQuestIds.includes(quest.id)) return 'pending';
  if (quest.status === 'inactive' || quest.status === 'draft') return 'hidden';

  if (quest.claimLimit && quest.currentClaims && quest.currentClaims >= quest.claimLimit) {
    return 'claimed_out';
  }

  if (quest.prerequisiteQuestId && !completedQuestIds.includes(quest.prerequisiteQuestId)) {
    return 'locked';
  }

  if (quest.startsAt && new Date(quest.startsAt).getTime() > nowMs) {
    return 'locked';
  }

  if (quest.isFlash) {
    if (quest.expiresAt && new Date(quest.expiresAt).getTime() <= nowMs) {
      return 'expired';
    }
    return 'flash';
  }

  return 'available';
}

export function getCurrentPlayer(): Player {
  initializeGameEngine();
  const player = getStoredItem<Player | null>(STORAGE_KEYS.CURRENT_PLAYER, null);
  if (player) return player;

  const defaultPlayer: Player = {
    id: 'plr-default-guest',
    displayName: 'Canton Explorer',
    avatarUrl: '⚡',
    role: 'player',
    totalXp: 0,
    level: 1,
    createdAt: new Date().toISOString(),
  };
  setStoredItem(STORAGE_KEYS.CURRENT_PLAYER, defaultPlayer);
  return defaultPlayer;
}

export function syncCanonicalPlayer(player: Player): void {
  initializeGameEngine();
  setStoredItem(STORAGE_KEYS.CURRENT_PLAYER, player);

  const players = getStoredItem<Player[]>(STORAGE_KEYS.PLAYERS, SEED_DEMO_PLAYERS);
  const existingIdx = players.findIndex(
    (p) => p.id === player.id || p.displayName.toLowerCase() === player.displayName.toLowerCase()
  );

  if (existingIdx >= 0) {
    players[existingIdx] = player;
    setStoredItem(STORAGE_KEYS.PLAYERS, players);
  } else {
    setStoredItem(STORAGE_KEYS.PLAYERS, [...players, player]);
  }
}

export function completeSpectatorConversion(displayName: string, serverConvertedPlayerId?: string): Player {
  const player = setCurrentPlayer(displayName, '⚡');
  if (serverConvertedPlayerId && serverConvertedPlayerId !== player.id) {
    player.id = serverConvertedPlayerId;
    syncCanonicalPlayer(player);
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('canton_player_profile', JSON.stringify(player));
    } catch {
      // Ignore storage errors in SSR or restricted environments
    }
  }
  return player;
}

export function setCurrentPlayer(displayName: string, avatarUrl: string = '⚡'): Player {
  initializeGameEngine();
  const players = getStoredItem<Player[]>(STORAGE_KEYS.PLAYERS, SEED_DEMO_PLAYERS);
  const existing = players.find(
    (p) => p.displayName.toLowerCase() === displayName.trim().toLowerCase()
  );

  if (existing) {
    setStoredItem(STORAGE_KEYS.CURRENT_PLAYER, existing);
    return existing;
  }

  const newPlayer: Player = {
    id: `plr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    displayName: displayName.trim(),
    avatarUrl,
    role: 'player',
    totalXp: 0,
    level: 1,
    createdAt: new Date().toISOString(),
  };

  const updatedPlayers = [...players, newPlayer];
  setStoredItem(STORAGE_KEYS.PLAYERS, updatedPlayers);
  setStoredItem(STORAGE_KEYS.CURRENT_PLAYER, newPlayer);

  logActivity({
    type: 'player_joined',
    actorName: newPlayer.displayName,
    title: `Agent Initialized: ${newPlayer.displayName}`,
    details: 'Joined Canton Quests field network',
  });

  return newPlayer;
}

export function getAllPlayers(): Player[] {
  initializeGameEngine();
  return getStoredItem<Player[]>(STORAGE_KEYS.PLAYERS, SEED_DEMO_PLAYERS);
}

export function getEvents(): QuestEvent[] {
  initializeGameEngine();
  return getStoredItem<QuestEvent[]>(STORAGE_KEYS.EVENTS, [SEED_EVENT]);
}

export function getEventBySlug(slug: string): QuestEvent | undefined {
  const events = getEvents();
  return events.find((e) => e.slug === slug);
}

export function createEvent(eventData: Omit<QuestEvent, 'id' | 'createdAt'>): QuestEvent {
  return createEventWizard(eventData);
}

export function updateEventStatus(eventId: string, status: QuestEvent['status']): QuestEvent | undefined {
  const events = getEvents();
  const event = events.find((e) => e.id === eventId);
  if (!event) return undefined;

  event.status = status;
  setStoredItem(STORAGE_KEYS.EVENTS, events);
  return event;
}

export function getQuestsForEvent(eventId: string): Quest[] {
  initializeGameEngine();
  const quests = getStoredItem<Quest[]>(STORAGE_KEYS.QUESTS, SEED_QUESTS);
  return quests
    .filter((q) => q.eventId === eventId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getQuestById(questId: string): Quest | undefined {
  initializeGameEngine();
  const quests = getStoredItem<Quest[]>(STORAGE_KEYS.QUESTS, SEED_QUESTS);
  return quests.find((q) => q.id === questId);
}

export function getQuestBySlug(slug: string): Quest | undefined {
  initializeGameEngine();
  const quests = getStoredItem<Quest[]>(STORAGE_KEYS.QUESTS, SEED_QUESTS);
  return quests.find((q) => q.slug === slug);
}

export function createQuest(questData: Omit<Quest, 'id' | 'createdAt'>): Quest {
  const quests = getStoredItem<Quest[]>(STORAGE_KEYS.QUESTS, SEED_QUESTS);
  const newQuest: Quest = {
    ...questData,
    id: `qst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  setStoredItem(STORAGE_KEYS.QUESTS, [...quests, newQuest]);
  return newQuest;
}

export function updateQuest(questId: string, updates: Partial<Quest>): Quest | undefined {
  const quests = getStoredItem<Quest[]>(STORAGE_KEYS.QUESTS, SEED_QUESTS);
  const index = quests.findIndex((q) => q.id === questId);
  if (index === -1) return undefined;

  const updatedQuest = { ...quests[index], ...updates };
  quests[index] = updatedQuest;
  setStoredItem(STORAGE_KEYS.QUESTS, quests);
  return updatedQuest;
}

export function triggerFlashQuest(questId: string, durationMinutes: number = 30): Quest | undefined {
  initializeGameEngine();
  const quest = getQuestById(questId);
  if (!quest) return undefined;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();

  const updated = updateQuest(questId, {
    isFlash: true,
    status: 'active',
    startsAt: now.toISOString(),
    expiresAt,
  });

  if (updated) {
    createAnnouncement(
      quest.eventId,
      `⚡ FLASH DROP: ${updated.title}`,
      `A high-priority pop-up drop is active for ${durationMinutes} minutes! (+${updated.pointValue} XP)`,
      'flash',
      expiresAt,
      quest.id
    );
  }

  return updated;
}

export function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CQ-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function createTeam(eventId: string, name: string, captainId: string, avatarSymbol: string = '🛡️'): Team {
  initializeGameEngine();
  const teams = getStoredItem<Team[]>(STORAGE_KEYS.TEAMS, SEED_TEAMS);
  const members = getStoredItem<TeamMember[]>(STORAGE_KEYS.TEAM_MEMBERS, SEED_TEAM_MEMBERS);

  let joinCode = generateJoinCode();
  while (teams.some((t) => t.joinCode === joinCode)) {
    joinCode = generateJoinCode();
  }

  const newTeam: Team = {
    id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    eventId,
    name: name.trim(),
    joinCode,
    captainId,
    avatarSymbol,
    totalPoints: 0,
    createdAt: new Date().toISOString(),
  };

  const newMember: TeamMember = {
    id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    teamId: newTeam.id,
    playerId: captainId,
    joinedAt: new Date().toISOString(),
  };

  setStoredItem(STORAGE_KEYS.TEAMS, [...teams, newTeam]);
  setStoredItem(STORAGE_KEYS.TEAM_MEMBERS, [...members, newMember]);

  const captain = getAllPlayers().find((p) => p.id === captainId);
  logActivity({
    type: 'team_created',
    actorName: captain?.displayName || 'Player',
    title: `Team Formed: ${newTeam.name}`,
    details: `Join Code: ${newTeam.joinCode}`,
  });

  return newTeam;
}

export function joinTeamByCode(joinCode: string, playerId: string, eventId: string): { success: boolean; team?: Team; message: string } {
  initializeGameEngine();
  const teams = getStoredItem<Team[]>(STORAGE_KEYS.TEAMS, SEED_TEAMS);
  const members = getStoredItem<TeamMember[]>(STORAGE_KEYS.TEAM_MEMBERS, SEED_TEAM_MEMBERS);

  const cleanCode = joinCode.trim().toUpperCase();
  const targetTeam = teams.find((t) => t.eventId === eventId && t.joinCode === cleanCode);

  if (!targetTeam) {
    return { success: false, message: 'Invalid team join code! Please double-check the code.' };
  }

  const isAlreadyMember = members.some((m) => m.teamId === targetTeam.id && m.playerId === playerId);
  if (isAlreadyMember) {
    return { success: true, team: targetTeam, message: `You are already a member of ${targetTeam.name}!` };
  }

  const otherTeamIds = teams.filter((t) => t.eventId === eventId).map((t) => t.id);
  const filteredMembers = members.filter((m) => !(m.playerId === playerId && otherTeamIds.includes(m.teamId)));

  const newMember: TeamMember = {
    id: `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    teamId: targetTeam.id,
    playerId,
    joinedAt: new Date().toISOString(),
  };

  setStoredItem(STORAGE_KEYS.TEAM_MEMBERS, [...filteredMembers, newMember]);

  const player = getAllPlayers().find((p) => p.id === playerId);
  logActivity({
    type: 'team_joined',
    actorName: player?.displayName || 'Player',
    title: `Joined Team: ${targetTeam.name}`,
    details: `Agent joined squad ${targetTeam.joinCode}`,
  });

  return { success: true, team: targetTeam, message: `Successfully joined ${targetTeam.name}!` };
}

export function getTeamForPlayer(playerId: string, eventId: string): { team?: Team; members: TeamMember[] } {
  initializeGameEngine();
  const teams = getStoredItem<Team[]>(STORAGE_KEYS.TEAMS, SEED_TEAMS);
  const members = getStoredItem<TeamMember[]>(STORAGE_KEYS.TEAM_MEMBERS, SEED_TEAM_MEMBERS);
  const players = getAllPlayers();

  const playerTeamMember = members.find((m) => {
    if (m.playerId !== playerId) return false;
    const teamObj = teams.find((t) => t.id === m.teamId);
    return teamObj && teamObj.eventId === eventId;
  });

  if (!playerTeamMember) return { team: undefined, members: [] };

  const team = teams.find((t) => t.id === playerTeamMember.teamId);
  const teamMembers = members
    .filter((m) => m.teamId === playerTeamMember.teamId)
    .map((m) => ({
      ...m,
      player: players.find((p) => p.id === m.playerId),
    }));

  return { team, members: teamMembers };
}

export function getTeamLeaderboardForEvent(eventId: string): TeamLeaderboardEntry[] {
  initializeGameEngine();
  const teams = getStoredItem<Team[]>(STORAGE_KEYS.TEAMS, SEED_TEAMS).filter((t) => t.eventId === eventId);
  const members = getStoredItem<TeamMember[]>(STORAGE_KEYS.TEAM_MEMBERS, SEED_TEAM_MEMBERS);
  const ledger = getStoredItem<ScoreLedgerEntry[]>(STORAGE_KEYS.SCORE_LEDGER, []);
  const players = getAllPlayers();

  const teamStats: Record<
    string,
    { totalPoints: number; completedQuests: Set<string>; lastScoreTime: string; memberIds: Set<string> }
  > = {};

  teams.forEach((t) => {
    teamStats[t.id] = {
      totalPoints: 0,
      completedQuests: new Set(),
      lastScoreTime: t.createdAt,
      memberIds: new Set(members.filter((m) => m.teamId === t.id).map((m) => m.playerId)),
    };
  });

  ledger
    .filter((entry) => entry.eventId === eventId)
    .forEach((entry) => {
      let targetTeamId = entry.teamId;
      if (!targetTeamId) {
        const playerTeam = members.find((m) => {
          if (m.playerId !== entry.playerId) return false;
          const t = teams.find((team) => team.id === m.teamId);
          return t && t.eventId === eventId;
        });
        if (playerTeam) targetTeamId = playerTeam.teamId;
      }

      if (targetTeamId && teamStats[targetTeamId]) {
        teamStats[targetTeamId].totalPoints += entry.points;
        if (entry.questId) {
          teamStats[targetTeamId].completedQuests.add(entry.questId);
        }
        if (new Date(entry.awardedAt) > new Date(teamStats[targetTeamId].lastScoreTime)) {
          teamStats[targetTeamId].lastScoreTime = entry.awardedAt;
        }
      }
    });

  const leaderboard: TeamLeaderboardEntry[] = teams.map((team) => {
    const stats = teamStats[team.id];
    const captain = players.find((p) => p.id === team.captainId);

    return {
      rank: 0,
      teamId: team.id,
      teamName: team.name,
      joinCode: team.joinCode,
      captainId: team.captainId,
      captainName: captain?.displayName || 'Captain',
      memberCount: stats ? stats.memberIds.size : 1,
      totalPoints: stats ? stats.totalPoints : 0,
      questsCompletedCount: stats ? stats.completedQuests.size : 0,
      lastScoreTime: stats ? stats.lastScoreTime : team.createdAt,
    };
  });

  leaderboard.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return new Date(a.lastScoreTime || 0).getTime() - new Date(b.lastScoreTime || 0).getTime();
  });

  return leaderboard.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

export function getSubmissionsForPlayer(playerId: string, eventId?: string): QuestSubmission[] {
  initializeGameEngine();
  const submissions = getStoredItem<QuestSubmission[]>(STORAGE_KEYS.SUBMISSIONS, []);
  return submissions.filter((s) => s.playerId === playerId && (!eventId || s.eventId === eventId));
}

export function getAllSubmissions(): QuestSubmission[] {
  initializeGameEngine();
  return getStoredItem<QuestSubmission[]>(STORAGE_KEYS.SUBMISSIONS, []);
}

function getLatestQuestProgressSubmission(
  submissions: QuestSubmission[],
  playerId: string,
  questId: string
): QuestSubmission | undefined {
  return submissions
    .filter((s) => s.playerId === playerId && s.questId === questId)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
}

function buildRejectedSubmission(
  params: SubmitProofParams,
  message: string,
  fields: Partial<QuestSubmission> = {}
): QuestSubmission {
  return {
    id: `sub-failed-${Date.now()}`,
    questId: params.questId,
    playerId: params.playerId,
    eventId: params.eventId,
    proofType: params.proofType,
    status: 'rejected',
    awardedPoints: 0,
    drawingEntriesAwarded: 0,
    feedback: message,
    submittedAt: new Date().toISOString(),
    ...fields,
  };
}

function getQuestTargetCoordinates(quest: Quest): { lat?: number; lon?: number; radiusMeters: number } {
  return {
    lat: quest.location?.latitude,
    lon: quest.location?.longitude,
    radiusMeters: quest.radiusMeters || quest.location?.radiusMeters || 100,
  };
}

function validateLocationProof(
  params: SubmitProofParams,
  quest: Quest,
  step?: QuestStep
): { ok: true; distanceMeters?: number; message: string } | { ok: false; submission: QuestSubmission; message: string } {
  const targetLat = step?.location?.latitude ?? quest.location?.latitude;
  const targetLon = step?.location?.longitude ?? quest.location?.longitude;
  const requiredRadius = step?.radiusMeters || quest.radiusMeters || quest.location?.radiusMeters || 100;

  if (targetLat === undefined || targetLon === undefined) {
    const message = 'Authoritative quest location is missing; Game Master review is required.';
    return { ok: false, submission: buildRejectedSubmission(params, message), message };
  }

  if (params.userLat === undefined || params.userLon === undefined) {
    const message = 'GPS location verification required. Please enable location services.';
    return { ok: false, submission: buildRejectedSubmission(params, message), message };
  }

  if (
    params.userAccuracyMeters !== undefined &&
    Number.isFinite(params.userAccuracyMeters) &&
    params.userAccuracyMeters > MAX_TRUSTED_GPS_ACCURACY_METERS
  ) {
    const message = `GPS accuracy is too weak for reward verification (${Math.round(params.userAccuracyMeters)}m). Refresh GPS closer to the node.`;
    return {
      ok: false,
      submission: buildRejectedSubmission(params, message, {
        userLat: params.userLat,
        userLon: params.userLon,
      }),
      message,
    };
  }

  const prox = checkProximity(
    { latitude: params.userLat, longitude: params.userLon, accuracy: params.userAccuracyMeters },
    targetLat,
    targetLon,
    requiredRadius
  );

  if (!prox.isWithinRadius) {
    return {
      ok: false,
      submission: buildRejectedSubmission(params, prox.message, {
        userLat: params.userLat,
        userLon: params.userLon,
        distanceFromLocation: prox.distanceMeters,
      }),
      message: prox.message,
    };
  }

  return {
    ok: true,
    distanceMeters: prox.distanceMeters,
    message: `GPS Location verified! Signal confirmed (${prox.distanceMeters}m from target).`,
  };
}

function verifyStepProof(
  params: SubmitProofParams,
  quest: Quest,
  step: QuestStep
): {
  status: 'verified' | 'pending' | 'rejected';
  message: string;
  distanceMeters?: number;
} {
  if (step.verificationType === 'passphrase' || step.verificationType === 'qr') {
    if (proofMatches(params.submittedContent, step.targetCode)) {
      return { status: 'verified', message: `Step ${step.stepOrder} verified.` };
    }
    return { status: 'rejected', message: `Step ${step.stepOrder} verification failed. Incorrect answer or unverified proof.` };
  }

  if (step.verificationType === 'gps' || step.verificationType === 'checkin') {
    const locationResult = validateLocationProof(params, quest, step);
    if (!locationResult.ok) {
      return { status: 'rejected', message: locationResult.message };
    }
    return { status: 'verified', message: locationResult.message, distanceMeters: locationResult.distanceMeters };
  }

  if (step.verificationType === 'photo' || step.verificationType === 'video' || step.verificationType === 'game_master') {
    if (!params.proofUrl && !params.submittedContent) {
      return { status: 'rejected', message: `Step ${step.stepOrder} requires proof details before Game Master review.` };
    }
    return { status: 'pending', message: `Step ${step.stepOrder} submitted for Game Master review.` };
  }

  return { status: 'rejected', message: `Unsupported step verification type: ${step.verificationType}` };
}

export function submitQuestProof(params: SubmitProofParams): SubmitProofResult {
  initializeGameEngine();
  const event = getEvents().find((e) => e.id === params.eventId);
  const isPaused = event ? event.isPaused : false;

  if (event && event.isPaused) {
    return {
      success: false,
      submission: {
        id: `sub-paused-${Date.now()}`,
        questId: params.questId,
        playerId: params.playerId,
        eventId: params.eventId,
        proofType: params.proofType,
        status: 'rejected',
        awardedPoints: 0,
        submittedAt: new Date().toISOString(),
      },
      message: `Event is currently paused by Game Master (${event.pauseReason || 'Field safety check'}). Submissions held.`,
      awardedPoints: 0,
    };
  }

  const quest = getQuestById(params.questId);
  if (!quest) {
    throw new Error('Quest not found');
  }

  // Evaluate Proof Integrity & Automated Review Flags
  const existingSubmissions = getAllSubmissions();
  const reviewFlags = evaluateProofIntegrity(params, quest, existingSubmissions, isPaused);

  if (quest.claimLimit) {
    const currentClaims = quest.currentClaims || 0;
    if (currentClaims >= quest.claimLimit) {
      return {
        success: false,
        submission: {
          id: `sub-claimedout-${Date.now()}`,
          questId: params.questId,
          playerId: params.playerId,
          eventId: params.eventId,
          proofType: params.proofType,
          status: 'rejected',
          awardedPoints: 0,
          submittedAt: new Date().toISOString(),
        },
        message: `Claim limit reached! All ${quest.claimLimit} available completion slots have been claimed.`,
        awardedPoints: 0,
      };
    }
  }

  const verifiedExistingSub = existingSubmissions.find(
    (s) => s.playerId === params.playerId && s.questId === params.questId && s.status === 'verified'
  );
  const existingSub =
    verifiedExistingSub || getLatestQuestProgressSubmission(existingSubmissions, params.playerId, params.questId);

  if (existingSub) {
    if (existingSub.status === 'verified') {
      return {
        success: false,
        submission: existingSub,
        message: 'Quest already completed! Points have already been awarded.',
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
      };
    }
    if (existingSub.status === 'pending') {
      return {
        success: false,
        submission: existingSub,
        message: 'Your proof submission for this quest is currently under review by a Game Master.',
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
      };
    }
  }

  let proximityChecked = false;
  let distanceFromLoc: number | undefined = undefined;

  const requiresStrictGps =
    quest.verificationType === 'checkin' ||
    quest.verificationType === 'gps' ||
    quest.requireLocationVerification ||
    quest.requireQrAndLocation;

  if (requiresStrictGps && (params.userLat === undefined || params.userLon === undefined)) {
    const failedSubmission = buildRejectedSubmission(params, 'GPS location verification required. Please enable location services.');
    return {
      success: false,
      submission: failedSubmission,
      message: failedSubmission.feedback || 'GPS location verification required. Please enable location services.',
      awardedPoints: 0,
      drawingEntriesAwarded: 0,
      flags: reviewFlags,
    };
  }

  if (requiresStrictGps || params.userLat !== undefined || params.userLon !== undefined) {
    const locationResult = validateLocationProof(params, quest);
    if (!locationResult.ok) {
      return {
        success: false,
        submission: locationResult.submission,
        message: locationResult.message,
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
        flags: reviewFlags,
      };
    }
    distanceFromLoc = locationResult.distanceMeters;
    proximityChecked = true;
  }

  let isAutoVerified = false;
  let validationMessage = '';
  let isMultiStepProgress = false;
  let currentStepCompletedOrder: number | undefined = undefined;
  let nextUnlockedStep: QuestStep | undefined = undefined;

  if (quest.verificationType === 'checkin' || quest.verificationType === 'gps') {
    isAutoVerified = true;
    validationMessage = proximityChecked
      ? `GPS Location verified! Signal confirmed (${distanceFromLoc}m from target).`
      : 'Check-in verified! Field beacon active.';
  } else if (quest.verificationType === 'passphrase') {
    if (proofMatches(params.submittedContent, quest.targetCode)) {
      isAutoVerified = true;
      validationMessage = 'Cipher Cracked! Passphrase verified successfully.';
    } else {
      const failedSub: QuestSubmission = {
        id: `sub-${Date.now()}`,
        questId: params.questId,
        playerId: params.playerId,
        eventId: params.eventId,
        proofType: params.proofType,
        submittedContent: params.submittedContent,
        status: 'rejected',
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
        feedback: 'Incorrect passphrase code. Inspect the location closely.',
        submittedAt: new Date().toISOString(),
      };
      setStoredItem(STORAGE_KEYS.SUBMISSIONS, [...existingSubmissions, failedSub]);
      return {
        success: false,
        submission: failedSub,
        message: 'Incorrect passcode frequency! Re-examine the location or plaque.',
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
        flags: reviewFlags,
      };
    }
  } else if (quest.verificationType === 'qr') {
    if (proofMatches(params.submittedContent, quest.targetCode)) {
      isAutoVerified = true;
      validationMessage = quest.requireQrAndLocation
        ? `QR Emblem & Physical Proximity Verified (${distanceFromLoc !== undefined ? `${distanceFromLoc}m` : 'Location confirmed'})! Quest Completed.`
        : 'QR Emblem Scanned! Quest completed.';
    } else {
      const failedSub: QuestSubmission = {
        id: `sub-${Date.now()}`,
        questId: params.questId,
        playerId: params.playerId,
        eventId: params.eventId,
        proofType: params.proofType,
        submittedContent: params.submittedContent,
        status: 'rejected',
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
        feedback: 'Invalid QR token code.',
        submittedAt: new Date().toISOString(),
      };
      setStoredItem(STORAGE_KEYS.SUBMISSIONS, [...existingSubmissions, failedSub]);
      return {
        success: false,
        submission: failedSub,
        message: 'Invalid QR Code token! Make sure you are scanning an official Canton Quests QR emblem.',
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
        flags: reviewFlags,
      };
    }
  } else if (quest.verificationType === 'photo' || quest.verificationType === 'video' || quest.verificationType === 'game_master') {
    isAutoVerified = false;
    validationMessage = quest.verificationType === 'game_master'
      ? 'Submitted for Game Master manual approval.'
      : 'Media proof submitted! Routed to Game Master review queue.';
  } else if (quest.verificationType === 'multi_step') {
    const steps = quest.steps || [];
    const completedSoFar = existingSub ? (existingSub.completedStepOrder || 0) : 0;
    const expectedStepIdx = completedSoFar;
    const requestedStepIdx = params.stepIndex ?? expectedStepIdx;

    if (requestedStepIdx !== expectedStepIdx) {
      return {
        success: false,
        submission: {
          id: `sub-failed-${Date.now()}`,
          questId: params.questId,
          playerId: params.playerId,
          eventId: params.eventId,
          proofType: params.proofType,
          status: 'rejected',
          awardedPoints: 0,
          submittedAt: new Date().toISOString(),
        },
        message: `Invalid step sequence. You must complete step ${expectedStepIdx + 1} next.`,
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
      };
    }

    const targetStep = steps[requestedStepIdx];
    if (!targetStep) {
      return {
        success: false,
        submission: {
          id: `sub-failed-${Date.now()}`,
          questId: params.questId,
          playerId: params.playerId,
          eventId: params.eventId,
          proofType: params.proofType,
          status: 'rejected',
          awardedPoints: 0,
          submittedAt: new Date().toISOString(),
        },
        message: 'Invalid step index for multi-step quest.',
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
      };
    }

    const stepResult = verifyStepProof(params, quest, targetStep);
    if (stepResult.distanceMeters !== undefined) {
      distanceFromLoc = stepResult.distanceMeters;
    }

    if (stepResult.status === 'pending') {
      currentStepCompletedOrder = requestedStepIdx + 1;
      validationMessage = stepResult.message;
    } else if (stepResult.status === 'rejected') {
      return {
        success: false,
        submission: buildRejectedSubmission(params, stepResult.message),
        message: stepResult.message,
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
      };
    }

    if (stepResult.status === 'pending') {
      isMultiStepProgress = false;
      currentStepCompletedOrder = completedSoFar;
    } else if (requestedStepIdx < steps.length - 1) {
      isMultiStepProgress = true;
      currentStepCompletedOrder = requestedStepIdx + 1;
      nextUnlockedStep = steps[requestedStepIdx + 1];
      validationMessage = `Step ${requestedStepIdx + 1} completed! Next step unlocked: ${nextUnlockedStep.title}`;
    } else {
      isAutoVerified = true;
      currentStepCompletedOrder = steps.length;
      validationMessage = 'All multi-step objectives completed! Quest fully verified.';
    }
  }

  if (params.isHardModeOptIn && !isAutoVerified && quest.verificationType === 'passphrase') {
    const penalty = quest.riskReward?.failurePenalty || 50;
    recordScoreLedger({
      eventId: params.eventId,
      playerId: params.playerId,
      points: -penalty,
      category: 'hard_mode_penalty',
      description: `Hard mode failure penalty for ${quest.title}`,
    });
  }

  const playerTeamInfo = getTeamForPlayer(params.playerId, params.eventId);
  const teamId = params.teamId || playerTeamInfo.team?.id;

  let claimPlacement: number | undefined = undefined;
  if (isAutoVerified) {
    const currentClaims = quest.currentClaims || 0;
    claimPlacement = currentClaims + 1;
    updateQuest(quest.id, { currentClaims: claimPlacement });
  }

  const drawingEntriesCount = quest.drawingEntryReward ?? 1;

  const newSubmission: QuestSubmission = {
    id: `sub-${Date.now()}`,
    questId: params.questId,
    playerId: params.playerId,
    teamId,
    eventId: params.eventId,
    proofType: params.proofType,
    submittedContent: params.submittedContent,
    proofUrl: params.proofUrl,
    status: isMultiStepProgress ? 'in_progress' : isAutoVerified ? 'verified' : 'pending',
    awardedPoints: isAutoVerified ? (quest.xpReward || quest.pointValue) : 0,
    drawingEntriesAwarded: isAutoVerified ? drawingEntriesCount : 0,
    completedStepOrder: currentStepCompletedOrder,
    reviewFlags: reviewFlags.length > 0 ? reviewFlags : undefined,
    submittedAt: new Date().toISOString(),
    reviewedAt: isAutoVerified ? new Date().toISOString() : undefined,
    userLat: params.userLat,
    userLon: params.userLon,
    distanceFromLocation: distanceFromLoc,
    claimPlacement,
  };

  const updatedSubmissions = [...existingSubmissions, newSubmission];
  setStoredItem(STORAGE_KEYS.SUBMISSIONS, updatedSubmissions);

  let awardedPoints = 0;
  let drawingEntriesAwarded = 0;
  let grantedCol: Collectible | undefined = undefined;

  if (isAutoVerified) {
    let basePoints = quest.xpReward || quest.pointValue;

    const multiplier = getActiveBonusMultiplier(params.eventId, quest.category);
    basePoints = Math.round(basePoints * multiplier);

    if (quest.raceRewards && claimPlacement) {
      const raceBonus = quest.raceRewards.find((r) => r.place === claimPlacement);
      if (raceBonus) {
        basePoints += raceBonus.bonusPoints;
        validationMessage += ` 🥇 Placement Bonus #${claimPlacement}: +${raceBonus.bonusPoints} XP!`;
      }
    }

    if (params.isHardModeOptIn && quest.riskReward) {
      basePoints += quest.riskReward.hardModeBonus;
      validationMessage += ` ⚡ Hard Mode Victory: +${quest.riskReward.hardModeBonus} XP!`;
    }

    awardedPoints = basePoints;
    drawingEntriesAwarded = drawingEntriesCount;

    // 1. Award Persistent XP
    recordScoreLedger({
      eventId: params.eventId,
      playerId: params.playerId,
      teamId,
      questId: params.questId,
      submissionId: newSubmission.id,
      points: awardedPoints,
      category: quest.category,
      description: `Completed ${quest.title}${multiplier > 1.0 ? ` (${multiplier}x Bonus)` : ''}`,
    });

    // 2. Award Event-Scoped Drawing Entries (Only if ledger is open)
    if (isDrawingLedgerLocked(params.eventId)) {
      drawingEntriesAwarded = 0;
      newSubmission.drawingEntriesAwarded = 0;
    } else {
      awardDrawingEntries({
        eventId: params.eventId,
        playerId: params.playerId,
        questId: params.questId,
        submissionId: newSubmission.id,
        entriesCount: drawingEntriesAwarded,
        sourceType: 'quest_completion',
        reason: `Completed quest: ${quest.title}`,
      });
    }

    incrementCrowdObjective(params.eventId, 1);

    if (quest.id === 'qst-centennial-discovery') {
      grantedCol = awardCollectible(params.playerId, 'col-founder-token', 'Centennial Beacon Quest');
    }

    const player = getAllPlayers().find((p) => p.id === params.playerId);
    logActivity({
      type: 'quest_completed',
      actorName: player?.displayName || 'Player',
      title: `Quest Completed: ${quest.title}`,
      details: `+${awardedPoints} XP, +${drawingEntriesAwarded} Drawing Entries awarded`,
    });
  }

  return {
    success: true,
    submission: newSubmission,
    message: validationMessage,
    awardedPoints,
    drawingEntriesAwarded,
    currentStepCompleted: currentStepCompletedOrder,
    nextStepUnlocked: nextUnlockedStep,
    isQuestFullyCompleted: isAutoVerified,
    claimPlacement,
    collectibleAwarded: grantedCol,
    flags: reviewFlags,
  };
}

export function recordScoreLedger(entryData: Omit<ScoreLedgerEntry, 'id' | 'awardedAt'>): ScoreLedgerEntry {
  initializeGameEngine();
  const ledger = getStoredItem<ScoreLedgerEntry[]>(STORAGE_KEYS.SCORE_LEDGER, []);

  // Idempotency check: if score for (eventId, playerId, questId) already exists with points > 0, do not duplicate!
  if (entryData.questId && entryData.points > 0) {
    const existing = ledger.find(
      (e) =>
        e.eventId === entryData.eventId &&
        e.playerId === entryData.playerId &&
        e.questId === entryData.questId &&
        e.points > 0
    );
    if (existing) {
      return existing;
    }
  }

  const newEntry: ScoreLedgerEntry = {
    ...entryData,
    id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    awardedAt: new Date().toISOString(),
  };

  const updatedLedger = [...ledger, newEntry];
  setStoredItem(STORAGE_KEYS.SCORE_LEDGER, updatedLedger);

  const players = getAllPlayers();
  const player = players.find((p) => p.id === entryData.playerId);
  if (player) {
    player.totalXp = Math.max(0, player.totalXp + entryData.points);
    player.level = Math.floor(player.totalXp / 250) + 1;
    setStoredItem(STORAGE_KEYS.PLAYERS, players);
  }

  return newEntry;
}

// -----------------------------------------------------------------------------
// Core Quest Rewards Backbone — Drawing Entry Ledger Subsystem
// -----------------------------------------------------------------------------

export function isDrawingLedgerLocked(eventId: string): boolean {
  initializeGameEngine();
  const locks = getStoredItem<EventDrawingLedgerLock[]>(STORAGE_KEYS.DRAWING_LOCKS, []);
  const lock = locks.find((l) => l.eventId === eventId);
  return !!(lock && (lock.isLocked || ['locked', 'drawn', 'published', 'cancelled'].includes(lock.status)));
}

const EMAIL_LABEL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
const PHONE_LABEL_REGEX = /\+?[0-9]{1,4}[-.\s]?\(?[0-9]{1,3}\)?[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{4}/;

export function getPublicPlayerLabel(playerObj: Player | undefined, playerId: string): string {
  const shortId = playerId.replace(/[^a-f0-9]/gi, '').slice(-4).toUpperCase() || '0000';
  if (!playerObj) {
    return `Agent #${shortId}`;
  }
  if ('isMinor' in playerObj && (playerObj as any).isMinor === true) {
    return `Agent #${shortId}`;
  }
  let label = (playerObj.displayName || '').trim();
  if (!label || label.startsWith('Agent #')) {
    return `Agent #${shortId}`;
  }
  if (EMAIL_LABEL_REGEX.test(label) || PHONE_LABEL_REGEX.test(label)) {
    return `Agent #${shortId}`;
  }
  const sanitized = sanitizeTextContent(label).trim();
  if (!sanitized || EMAIL_LABEL_REGEX.test(sanitized) || PHONE_LABEL_REGEX.test(sanitized) || sanitized.startsWith('Agent #')) {
    return `Agent #${shortId}`;
  }
  return sanitized;
}

export function awardDrawingEntries(
  entryData: Omit<DrawingEntryLedgerEntry, 'id' | 'createdAt'>
): DrawingEntryLedgerEntry {
  initializeGameEngine();
  if (isDrawingLedgerLocked(entryData.eventId)) {
    throw new Error(`Drawing ledger for event ${entryData.eventId} is locked. New drawing entries cannot be awarded.`);
  }

  const ledger = getStoredItem<DrawingEntryLedgerEntry[]>(STORAGE_KEYS.DRAWING_LEDGER, []);

  if (entryData.questId && entryData.entriesCount > 0) {
    const existing = ledger.find(
      (e) =>
        e.eventId === entryData.eventId &&
        e.playerId === entryData.playerId &&
        e.questId === entryData.questId &&
        e.entriesCount > 0
    );
    if (existing) {
      return existing;
    }
  }

  const newEntry: DrawingEntryLedgerEntry = {
    ...entryData,
    id: `dw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  setStoredItem(STORAGE_KEYS.DRAWING_LEDGER, [...ledger, newEntry]);
  return newEntry;
}

export function getDrawingEntriesForEvent(eventId: string): DrawingEntryLedgerEntry[] {
  initializeGameEngine();
  const ledger = getStoredItem<DrawingEntryLedgerEntry[]>(STORAGE_KEYS.DRAWING_LEDGER, []);
  return ledger.filter((e) => e.eventId === eventId);
}

export function getDrawingEntriesForPlayer(playerId: string, eventId?: string): DrawingEntryLedgerEntry[] {
  initializeGameEngine();
  const ledger = getStoredItem<DrawingEntryLedgerEntry[]>(STORAGE_KEYS.DRAWING_LEDGER, []);
  return ledger.filter((e) => e.playerId === playerId && (!eventId || e.eventId === eventId));
}

export function getPublicDrawingLedgerProjection(eventId: string): PublicDrawingLedgerProjection {
  initializeGameEngine();
  const entries = getDrawingEntriesForEvent(eventId);
  const players = getAllPlayers();
  const locks = getStoredItem<EventDrawingLedgerLock[]>(STORAGE_KEYS.DRAWING_LOCKS, []);
  const lock = locks.find((l) => l.eventId === eventId);

  const playerMap: Record<string, { label: string; count: number }> = {};
  let totalEntriesAcrossAllPlayers = 0;

  entries.forEach((e) => {
    totalEntriesAcrossAllPlayers += e.entriesCount;
    if (!playerMap[e.playerId]) {
      const playerObj = players.find((p) => p.id === e.playerId);
      const label = getPublicPlayerLabel(playerObj, e.playerId);
      playerMap[e.playerId] = { label, count: 0 };
    }
    playerMap[e.playerId].count += e.entriesCount;
  });

  const playerEntries: PublicPlayerDrawingEntry[] = Object.values(playerMap).map((pm) => ({
    playerPublicLabel: pm.label,
    totalQualifiedEntries: pm.count,
  }));

  const status: DrawingStatus = lock ? lock.status : 'open';

  return {
    eventId,
    totalEntriesAcrossAllPlayers,
    ledgerLockStatus: status,
    ledgerLockTimestamp: lock && lock.isLocked ? lock.lockedAt || null : null,
    playerEntries,
  };
}

export function getPublicParticipantId(playerId: string, eventId: string): string {
  const nodeRequire = typeof require === 'function' ? require : undefined;
  if (nodeRequire) {
    return nodeRequire('crypto')
      .createHash('sha256')
      .update(`${playerId}:${eventId}`, 'utf8')
      .digest('hex')
      .slice(0, 8);
  }
  let hash = 0;
  const str = `${playerId}:${eventId}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

export function exportDrawingLedgerSnapshot(eventId: string): {
  snapshot: CanonicalSnapshot;
  snapshotHash: string;
} {
  initializeGameEngine();
  const entries = getDrawingEntriesForEvent(eventId);
  const players = getAllPlayers();

  const playerTotals: Record<string, { label: string; publicParticipantId: string; entries: number }> = {};

  entries.forEach((e) => {
    if (e.entriesCount > 0) {
      if (!playerTotals[e.playerId]) {
        const pObj = players.find((p) => p.id === e.playerId);
        const label = getPublicPlayerLabel(pObj, e.playerId);
        const publicParticipantId = getPublicParticipantId(e.playerId, eventId);
        playerTotals[e.playerId] = { label, publicParticipantId, entries: 0 };
      }
      playerTotals[e.playerId].entries += e.entriesCount;
    }
  });

  // Sort deterministically: primary by publicPlayerLabel ASC, secondary by entries ASC, tertiary by publicParticipantId ASC
  const canonicalPlayers: CanonicalSnapshotPlayer[] = Object.values(playerTotals)
    .filter((pt) => pt.entries > 0)
    .map((pt) => ({
      publicPlayerLabel: pt.label,
      publicParticipantId: pt.publicParticipantId,
      entries: pt.entries,
    }))
    .sort(
      (a, b) =>
        a.publicPlayerLabel.localeCompare(b.publicPlayerLabel) ||
        a.entries - b.entries ||
        (a.publicParticipantId || '').localeCompare(b.publicParticipantId || '')
    );

  const canonicalSnapshot: CanonicalSnapshot = {
    eventId,
    players: canonicalPlayers,
  };

  const jsonString = JSON.stringify(canonicalSnapshot);
  const nodeRequire = typeof require === 'function' ? require : undefined;
  if (!nodeRequire) {
    throw new Error('Synchronous SHA-256 export hashing requires a Node.js runtime.');
  }
  const rawHash = nodeRequire('crypto').createHash('sha256').update(jsonString, 'utf8').digest('hex');
  const snapshotHash = `SHA256-${rawHash}`;

  return { snapshot: canonicalSnapshot, snapshotHash };
}

export function getDrawingLedgerReview(eventId: string): DrawingLedgerReview {
  initializeGameEngine();
  const events = getEvents();
  const event = events.find((e) => e.id === eventId || e.slug === eventId);
  const eventTitle = event ? event.title : 'Canton Quests Event';
  const realEventId = event ? event.id : eventId;

  const entries = getDrawingEntriesForEvent(realEventId);
  const players = getAllPlayers();

  const playerTotals: Record<string, { label: string; entries: number; isMinor?: boolean }> = {};
  let totalQualifiedEntries = 0;

  entries.forEach((e) => {
    if (e.entriesCount > 0) {
      totalQualifiedEntries += e.entriesCount;
      if (!playerTotals[e.playerId]) {
        const pObj = players.find((p) => p.id === e.playerId);
        const label = getPublicPlayerLabel(pObj, e.playerId);
        playerTotals[e.playerId] = {
          label,
          entries: 0,
          isMinor: pObj && 'isMinor' in pObj ? (pObj as any).isMinor : false,
        };
      }
      playerTotals[e.playerId].entries += e.entriesCount;
    }
  });

  const playerEntries = Object.entries(playerTotals).map(([playerId, data]) => ({
    playerId,
    publicPlayerLabel: data.label,
    entries: data.entries,
    isMinor: data.isMinor,
  }));

  const submissions = getStoredItem<QuestSubmission[]>(STORAGE_KEYS.SUBMISSIONS, []);
  const pendingSubmissionsCount = submissions.filter(
    (s) => s.eventId === realEventId && s.status === 'pending'
  ).length;

  const locks = getStoredItem<EventDrawingLedgerLock[]>(STORAGE_KEYS.DRAWING_LOCKS, []);
  const lock = locks.find((l) => l.eventId === realEventId);
  const ledgerStatus: DrawingStatus = lock ? lock.status : 'open';

  return {
    eventId: realEventId,
    eventTitle,
    ledgerStatus,
    totalQualifiedEntries,
    totalQualifiedPlayers: playerEntries.length,
    playerEntries,
    pendingSubmissionsCount,
    hasPendingSubmissionsWarning: pendingSubmissionsCount > 0,
  };
}

export function lockDrawingLedger(
  eventId: string,
  options?: { lockReason?: string; lockedBy?: string; confirmPendingBypass?: boolean }
): EventDrawingLedgerLock {
  initializeGameEngine();
  const events = getEvents();
  const event = events.find((e) => e.id === eventId || e.slug === eventId);
  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }
  const realEventId = event.id;

  const review = getDrawingLedgerReview(realEventId);
  if (review.ledgerStatus !== 'open' && review.ledgerStatus !== 'review') {
    const locks = getStoredItem<EventDrawingLedgerLock[]>(STORAGE_KEYS.DRAWING_LOCKS, []);
    const existingLock = locks.find((l) => l.eventId === realEventId);
    if (existingLock) return existingLock;
  }

  if (review.hasPendingSubmissionsWarning && !options?.confirmPendingBypass) {
    throw new Error(
      `Cannot lock drawing ledger: ${review.pendingSubmissionsCount} unresolved submission(s) remain pending. Admin confirmation required.`
    );
  }

  const snapshotData = exportDrawingLedgerSnapshot(realEventId);
  const locks = getStoredItem<EventDrawingLedgerLock[]>(STORAGE_KEYS.DRAWING_LOCKS, []);

  const newLock: EventDrawingLedgerLock = {
    eventId: realEventId,
    isLocked: true,
    status: 'locked',
    lockedAt: new Date().toISOString(),
    lockReason: options?.lockReason || 'Administrative Ledger Freeze',
    lockedBy: options?.lockedBy || 'GM Admin',
    snapshotHash: snapshotData.snapshotHash,
    canonicalSnapshot: snapshotData.snapshot,
    totalQualifiedEntries: snapshotData.snapshot.players.reduce((sum: number, p: CanonicalSnapshotPlayer) => sum + p.entries, 0),
    totalQualifiedPlayers: snapshotData.snapshot.players.length,
    updatedAt: new Date().toISOString(),
  };

  const filtered = locks.filter((l) => l.eventId !== realEventId);
  setStoredItem(STORAGE_KEYS.DRAWING_LOCKS, [...filtered, newLock]);
  return newLock;
}

export const InternalTestDrawProvider: DrawProvider = {
  id: 'internal_test',
  name: 'Internal Seeded Test Provider (DEV / INTERNAL ONLY)',
  isIndependent: false,
  async executeDraw(params) {
    const seed = params.testSeed || 'TEST_SEED_DEFAULT';
    const players = params.snapshot.players.filter((p: CanonicalSnapshotPlayer) => {
      if (!params.excludedPlayerIds || params.excludedPlayerIds.length === 0) return true;
      const internalId = Object.entries(params.playerMap).find(([id, pInfo]: [string, { label: string; isMinor?: boolean }]) => {
        const participantId = getPublicParticipantId(id, params.eventId);
        if (p.publicParticipantId && participantId === p.publicParticipantId) return true;
        return pInfo.label === p.publicPlayerLabel;
      })?.[0];
      return !internalId || !params.excludedPlayerIds.includes(internalId);
    });

    if (players.length === 0) {
      throw new Error('No eligible players available for drawing.');
    }

    const totalWeightedUnits = players.reduce((sum: number, p: CanonicalSnapshotPlayer) => sum + p.entries, 0);
    if (totalWeightedUnits <= 0) {
      throw new Error('Drawing pool has 0 qualified entries.');
    }

    const nodeRequire = typeof require === 'function' ? require : undefined;
    if (!nodeRequire) {
      throw new Error('Deterministic test draw requires Node.js runtime.');
    }
    const seedDigest = nodeRequire('crypto')
      .createHash('sha256')
      .update(`${seed}:${params.prizeId}:${params.snapshotHash}`, 'utf8')
      .digest('hex');

    const bigHash = BigInt('0x' + seedDigest);
    const selectedWeightedEntryIndex = Number(bigHash % BigInt(totalWeightedUnits));

    let currentUnits = 0;
    let selectedPlayer = players[0];
    for (const player of players) {
      currentUnits += player.entries;
      if (selectedWeightedEntryIndex < currentUnits) {
        selectedPlayer = player;
        break;
      }
    }

    const winningPlayerId =
      Object.entries(params.playerMap).find(([id, pInfo]: [string, { label: string; isMinor?: boolean }]) => {
        const participantId = getPublicParticipantId(id, params.eventId);
        if (selectedPlayer.publicParticipantId && participantId === selectedPlayer.publicParticipantId) return true;
        return pInfo.label === selectedPlayer.publicPlayerLabel;
      })?.[0] ||
      `plr-anon-${selectedPlayer.publicPlayerLabel.replace(/\s+/g, '-').toLowerCase()}`;

    return {
      winningPlayerId,
      winningPublicPlayerLabel: selectedPlayer.publicPlayerLabel,
      selectedWeightedEntryIndex,
      drawMethod: 'internal_test',
      providerReference: `TEST_SEED:${seed}`,
      auditMetadata: {
        seed,
        isTestProvider: true,
        isSystemVerified: true,
        isIndependent: false,
        verificationStatus: 'internal_seeded',
        disclaimer: 'INTERNAL TEST / NON-INDEPENDENT SEED ONLY',
        totalWeightedUnits,
        selectedWeightedEntryIndex,
        prizeId: params.prizeId,
        prizeTitle: params.prizeTitle,
        lockedLedgerHash: params.snapshotHash,
      },
    };
  },
};

export const ManualExternalDrawProvider: DrawProvider = {
  id: 'manual_external',
  name: 'Manual External Draw Record (Manually Recorded / Unverified)',
  isIndependent: false,
  async executeDraw(params) {
    if (!params.manualWinnerPublicLabel && !params.manualWinnerPlayerId && !params.manualWinnerPublicParticipantId) {
      throw new Error('Manual external provider draw requires a winner public label, public participant ID, or internal player ID.');
    }
    if (!params.providerReference) {
      throw new Error('Manual external provider draw requires a valid provider reference (e.g. RANDOM.ORG Serial # or Wheel Spin #).');
    }

    let playerInSnapshot: CanonicalSnapshotPlayer | undefined;

    if (params.manualWinnerPublicParticipantId) {
      playerInSnapshot = params.snapshot.players.find(
        (p) => p.publicParticipantId === params.manualWinnerPublicParticipantId
      );
    } else if (params.manualWinnerPlayerId) {
      const targetParticipantId = getPublicParticipantId(params.manualWinnerPlayerId, params.eventId);
      playerInSnapshot = params.snapshot.players.find(
        (p) => p.publicParticipantId === targetParticipantId || p.publicParticipantId === params.manualWinnerPlayerId
      );
    } else if (params.manualWinnerPublicLabel) {
      const matchingPlayers = params.snapshot.players.filter(
        (p) => p.publicPlayerLabel === params.manualWinnerPublicLabel
      );
      if (matchingPlayers.length > 1) {
        throw new Error(
          `Ambiguous winner: Multiple participants share public label "${params.manualWinnerPublicLabel}". Please specify the unique publicParticipantId (e.g. PUB-...) to identify the winner.`
        );
      }
      playerInSnapshot = matchingPlayers[0];
    }

    if (!playerInSnapshot) {
      const identifier = params.manualWinnerPublicParticipantId || params.manualWinnerPublicLabel || params.manualWinnerPlayerId;
      throw new Error(`Specified winner "${identifier}" was not found in the frozen canonical snapshot pool.`);
    }

    const winningPlayerId =
      params.manualWinnerPlayerId ||
      Object.entries(params.playerMap).find(([id, pInfo]) => {
        const participantId = getPublicParticipantId(id, params.eventId);
        if (playerInSnapshot?.publicParticipantId && participantId === playerInSnapshot.publicParticipantId) return true;
        return pInfo.label === playerInSnapshot?.publicPlayerLabel;
      })?.[0] ||
      `plr-anon-${playerInSnapshot.publicPlayerLabel.replace(/\s+/g, '-').toLowerCase()}`;

    if (params.excludedPlayerIds && params.excludedPlayerIds.includes(winningPlayerId)) {
      throw new Error(`Player "${playerInSnapshot.publicPlayerLabel}" has already won a primary prize for this event.`);
    }

    return {
      winningPlayerId,
      winningPublicPlayerLabel: playerInSnapshot.publicPlayerLabel,
      selectedWeightedEntryIndex: -1,
      drawMethod: 'manual_external',
      providerReference: params.providerReference,
      auditMetadata: {
        isIndependent: false,
        isSystemVerified: false,
        verificationStatus: 'manual_unverified',
        drawMethod: 'manual_external',
        providerReference: params.providerReference,
        disclaimer: 'MANUALLY RECORDED RESULT — NOT SYSTEM VERIFIED BY CANTON QUESTS',
        auditNotes: params.auditMetadata?.auditNotes || 'Recorded manually by Game Master. Canton Quests did not independently verify external draw execution.',
        lockedLedgerHash: params.snapshotHash,
      },
    };
  },
};

export const RandomOrgFutureDrawProvider: DrawProvider = {
  id: 'random_org',
  name: 'RANDOM.ORG API (Future Independent Adapter)',
  isIndependent: true,
  async executeDraw(params) {
    if (!process.env.RANDOM_ORG_API_KEY) {
      throw new Error(
        'RANDOM.ORG live API integration requires configured API credentials. Record external provider results via manual_external.'
      );
    }
    throw new Error('RANDOM.ORG live API adapter is pending external provider authorization and credentials.');
  },
};

export function getEventPrizes(eventId: string): Prize[] {
  initializeGameEngine();
  const prizes = getStoredItem<Prize[]>(STORAGE_KEYS.PRIZES, []);
  return prizes.filter((p) => p.eventId === eventId);
}

export function createEventPrize(
  eventId: string,
  title: string,
  sponsorName?: string,
  quantity?: number
): Prize {
  initializeGameEngine();
  const prizes = getStoredItem<Prize[]>(STORAGE_KEYS.PRIZES, []);
  const newPrize: Prize = {
    id: `prz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    eventId,
    title,
    sponsorName: sponsorName || 'Canton Quests',
    quantity: quantity || 1,
    eligibilityRule: 'ONE_PRIMARY_PRIZE_PER_PLAYER',
  };
  setStoredItem(STORAGE_KEYS.PRIZES, [...prizes, newPrize]);
  return newPrize;
}

export function cancelDrawingLedger(
  eventId: string,
  reason?: string,
  adminIdentity?: string
): EventDrawingLedgerLock {
  initializeGameEngine();
  const locks = getStoredItem<EventDrawingLedgerLock[]>(STORAGE_KEYS.DRAWING_LOCKS, []);
  const lock = locks.find((l) => l.eventId === eventId);
  if (!lock) {
    throw new Error(`Drawing ledger lock not found for event ${eventId}`);
  }
  lock.status = 'cancelled';
  lock.isLocked = true;
  lock.lockReason = reason || lock.lockReason || 'Administrative Ledger Cancellation';
  lock.lockedBy = adminIdentity || lock.lockedBy || 'GM Admin';
  lock.updatedAt = new Date().toISOString();
  setStoredItem(STORAGE_KEYS.DRAWING_LOCKS, locks);
  return lock;
}

export async function executePrizeDraw(params: {
  eventId: string;
  prizeId?: string;
  prizeTitle?: string;
  testSeed?: string;
  drawMethod?: DrawMethod;
  providerReference?: string;
  manualWinnerPublicLabel?: string;
  manualWinnerPublicParticipantId?: string;
  manualWinnerPlayerId?: string;
  auditMetadata?: Record<string, any>;
  adminIdentity?: string;
}): Promise<PrizeDrawRecord> {
  initializeGameEngine();
  const events = getEvents();
  const event = events.find((e) => e.id === params.eventId || e.slug === params.eventId);
  if (!event) throw new Error(`Event not found: ${params.eventId}`);
  const realEventId = event.id;

  const locks = getStoredItem<EventDrawingLedgerLock[]>(STORAGE_KEYS.DRAWING_LOCKS, []);
  const lock = locks.find((l) => l.eventId === realEventId);

  if (!lock || !lock.isLocked || !lock.snapshotHash || !lock.canonicalSnapshot) {
    throw new Error('Drawing ledger must be locked before executing a draw.');
  }

  if (lock.status === 'cancelled') {
    throw new Error(`Cannot execute prize draw: Drawing ledger for event ${realEventId} is cancelled.`);
  }

  if (lock.status !== 'locked' && lock.status !== 'drawn') {
    throw new Error(
      `Cannot execute prize draw: Drawing ledger status is "${lock.status}". Prize draws are only allowed from a locked or drawn ledger state.`
    );
  }

  const prizeTitle = params.prizeTitle || 'Grand Prize';
  const prizeId = params.prizeId || `prz-default-${realEventId}`;

  const existingDraws = getStoredItem<PrizeDrawRecord[]>(STORAGE_KEYS.PRIZE_DRAWS, []);

  // Check for duplicate active draw for same event, prize, and locked hash
  const activeDuplicate = existingDraws.find(
    (d) =>
      d.eventId === realEventId &&
      d.status !== 'cancelled' &&
      d.lockedLedgerHash === lock.snapshotHash &&
      (d.prizeId === prizeId || d.prizeTitle === prizeTitle)
  );

  if (activeDuplicate) {
    throw new Error(
      `An active draw record already exists for prize "${prizeTitle}" under locked ledger hash ${lock.snapshotHash}. Void/cancel the existing draw record before drawing again.`
    );
  }

  const activeDraws = existingDraws.filter((d) => d.eventId === realEventId && d.status !== 'cancelled');
  const excludedPlayerIds = activeDraws.map((d) => d.winningPlayerId);

  const players = getAllPlayers();
  const playerMap: Record<string, { label: string; isMinor?: boolean }> = {};
  getDrawingEntriesForEvent(realEventId).forEach((e) => {
    if (!playerMap[e.playerId]) {
      const pObj = players.find((p) => p.id === e.playerId);
      playerMap[e.playerId] = {
        label: getPublicPlayerLabel(pObj, e.playerId),
        isMinor: pObj && 'isMinor' in pObj ? (pObj as any).isMinor : false,
      };
    }
  });

  const drawMethod: DrawMethod = params.drawMethod || 'internal_test';
  let provider: DrawProvider = InternalTestDrawProvider;
  if (drawMethod === 'manual_external') {
    provider = ManualExternalDrawProvider;
  } else if (drawMethod === 'random_org') {
    provider = RandomOrgFutureDrawProvider;
  }

  const drawResult = await provider.executeDraw({
    eventId: realEventId,
    prizeId,
    prizeTitle,
    snapshot: lock.canonicalSnapshot,
    playerMap,
    snapshotHash: lock.snapshotHash,
    testSeed: params.testSeed,
    excludedPlayerIds,
    manualWinnerPublicLabel: params.manualWinnerPublicLabel,
    manualWinnerPublicParticipantId: params.manualWinnerPublicParticipantId,
    manualWinnerPlayerId: params.manualWinnerPlayerId,
    providerReference: params.providerReference,
    auditMetadata: params.auditMetadata,
  });

  const record: PrizeDrawRecord = {
    id: `pdr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    eventId: realEventId,
    prizeId,
    prizeTitle,
    status: 'drawn',
    lockedLedgerHash: lock.snapshotHash,
    lockedAt: lock.lockedAt || new Date().toISOString(),
    drawMethod: drawResult.drawMethod,
    providerReference: drawResult.providerReference,
    drawnAt: new Date().toISOString(),
    winningPlayerId: drawResult.winningPlayerId,
    winningPublicPlayerLabel: drawResult.winningPublicPlayerLabel,
    selectedWeightedEntryIndex: drawResult.selectedWeightedEntryIndex,
    auditMetadata: drawResult.auditMetadata,
    createdAt: new Date().toISOString(),
  };

  setStoredItem(STORAGE_KEYS.PRIZE_DRAWS, [...existingDraws, record]);

  // Update lock status to 'drawn'
  lock.status = 'drawn';
  lock.updatedAt = new Date().toISOString();
  setStoredItem(STORAGE_KEYS.DRAWING_LOCKS, locks);

  return record;
}

export function publishDrawingResults(eventId: string, adminIdentity?: string): PrizeDrawRecord[] {
  initializeGameEngine();
  const events = getEvents();
  const event = events.find((e) => e.id === eventId || e.slug === eventId);
  if (!event) throw new Error(`Event not found: ${eventId}`);
  const realEventId = event.id;

  const locks = getStoredItem<EventDrawingLedgerLock[]>(STORAGE_KEYS.DRAWING_LOCKS, []);
  const lock = locks.find((l) => l.eventId === realEventId);
  if (!lock || !lock.isLocked) {
    throw new Error(`Cannot publish drawing results: Drawing ledger for event ${realEventId} is not locked.`);
  }
  if (lock.status === 'cancelled') {
    throw new Error(`Cannot publish drawing results: Drawing ledger for event ${realEventId} is cancelled.`);
  }
  if (lock.status !== 'drawn') {
    throw new Error(
      `Cannot publish drawing results: Drawing ledger status is "${lock.status}". Publishing is only allowed from a drawn ledger state.`
    );
  }

  const draws = getStoredItem<PrizeDrawRecord[]>(STORAGE_KEYS.PRIZE_DRAWS, []);
  const eventDraws = draws.filter((d) => d.eventId === realEventId && d.status === 'drawn');

  if (eventDraws.length === 0) {
    throw new Error('No completed draws found to publish.');
  }

  const now = new Date().toISOString();
  eventDraws.forEach((d) => {
    d.status = 'published';
    d.publishedAt = now;
  });
  setStoredItem(STORAGE_KEYS.PRIZE_DRAWS, draws);

  lock.status = 'published';
  lock.updatedAt = now;
  setStoredItem(STORAGE_KEYS.DRAWING_LOCKS, locks);

  logActivity({
    type: 'announcement',
    actorName: adminIdentity || 'Game Master',
    title: `🏆 Prize Drawing Results Published!`,
    details: `Official winners published for event ${event.title}`,
  });

  return eventDraws;
}

export function voidPrizeDrawRecord(
  eventId: string,
  drawRecordId: string,
  cancellationReason: string,
  adminIdentity?: string
): PrizeDrawRecord {
  initializeGameEngine();
  if (!cancellationReason || cancellationReason.trim().length < 5) {
    throw new Error('An explicit audit reason is required to void or cancel a prize drawing record.');
  }

  const draws = getStoredItem<PrizeDrawRecord[]>(STORAGE_KEYS.PRIZE_DRAWS, []);
  const record = draws.find((d) => d.id === drawRecordId && d.eventId === eventId);
  if (!record) {
    throw new Error(`Draw record not found: ${drawRecordId}`);
  }

  record.status = 'cancelled';
  record.cancellationReason = cancellationReason.trim();
  record.cancelledAt = new Date().toISOString();
  record.cancelledBy = adminIdentity || 'GM Admin';

  setStoredItem(STORAGE_KEYS.PRIZE_DRAWS, draws);

  const activeDraws = draws.filter((d) => d.eventId === eventId && d.status !== 'cancelled');
  const locks = getStoredItem<EventDrawingLedgerLock[]>(STORAGE_KEYS.DRAWING_LOCKS, []);
  const lock = locks.find((l) => l.eventId === eventId);
  if (lock) {
    if (activeDraws.length === 0) {
      lock.status = 'locked';
      lock.updatedAt = new Date().toISOString();
      setStoredItem(STORAGE_KEYS.DRAWING_LOCKS, locks);
    }
  }

  return record;
}

export function getPublicDrawingPageData(eventId: string): PublicDrawingPageData {
  initializeGameEngine();
  const events = getEvents();
  const event = events.find((e) => e.id === eventId || e.slug === eventId);
  const eventTitle = event ? event.title : 'Canton Quests Event';
  const realEventId = event ? event.id : eventId;

  const locks = getStoredItem<EventDrawingLedgerLock[]>(STORAGE_KEYS.DRAWING_LOCKS, []);
  const lock = locks.find((l) => l.eventId === realEventId);

  const projection = getPublicDrawingLedgerProjection(realEventId);

  const draws = getStoredItem<PrizeDrawRecord[]>(STORAGE_KEYS.PRIZE_DRAWS, []);
  const publishedDraws = draws.filter((d) => d.eventId === realEventId && d.status === 'published');

  const publishedPrizes: PublicPrizeDrawResult[] = publishedDraws.map((d) => ({
    drawRecordId: d.id,
    prizeId: d.prizeId,
    prizeTitle: d.prizeTitle,
    winnerPublicLabel: d.winningPublicPlayerLabel, // STRICTLY public label, no internal UUID!
    drawMethod: d.drawMethod,
    providerReference: d.providerReference,
    drawnAt: d.drawnAt,
    verificationStatus: d.auditMetadata?.verificationStatus || (d.drawMethod === 'manual_external' ? 'manual_unverified' : 'internal_seeded'),
    isSystemVerified: d.auditMetadata?.isSystemVerified ?? false,
    isIndependent: d.auditMetadata?.isIndependent ?? false,
  }));

  const ledgerLockStatus: DrawingStatus = lock ? lock.status : 'open';
  const firstPublished = publishedDraws[0];

  return {
    eventId: realEventId,
    eventTitle,
    ledgerLockStatus,
    ledgerLockTimestamp: lock && lock.isLocked ? lock.lockedAt || null : null,
    snapshotHash: lock && lock.snapshotHash ? lock.snapshotHash : null,
    canonicalSnapshot: lock && lock.canonicalSnapshot ? lock.canonicalSnapshot : null,
    totalQualifiedEntries: projection.totalEntriesAcrossAllPlayers,
    totalQualifiedPlayers: projection.playerEntries.length,
    publicPlayerEntries: projection.playerEntries,
    publishedPrizes,
    publishedAt: firstPublished ? firstPublished.publishedAt || null : null,
    verificationInfo: lock && lock.snapshotHash
      ? `This drawing entry pool was finalized and cryptographically hashed (SHA-256: ${lock.snapshotHash}) on ${lock.lockedAt}. The winner selection is tied directly to the frozen canonical snapshot.`
      : undefined,
  };
}

export function getPublicQuestView(quest: Quest): PublicQuestView {
  const { targetCode, gmNotes, ...safeQuest } = quest;
  if (safeQuest.steps) {
    safeQuest.steps = safeQuest.steps.map(({ targetCode: _targetCode, ...stepRest }) => stepRest);
  }
  return safeQuest;
}

export function getLeaderboardForEvent(eventId: string): LeaderboardEntry[] {
  initializeGameEngine();
  const ledger = getStoredItem<ScoreLedgerEntry[]>(STORAGE_KEYS.SCORE_LEDGER, []);
  const players = getAllPlayers();
  const teams = getStoredItem<Team[]>(STORAGE_KEYS.TEAMS, SEED_TEAMS);
  const members = getStoredItem<TeamMember[]>(STORAGE_KEYS.TEAM_MEMBERS, SEED_TEAM_MEMBERS);

  const playerStats: Record<
    string,
    { totalPoints: number; completedQuestIds: Set<string>; lastScoreTime: string }
  > = {};

  ledger
    .filter((entry) => entry.eventId === eventId)
    .forEach((entry) => {
      if (!playerStats[entry.playerId]) {
        playerStats[entry.playerId] = {
          totalPoints: 0,
          completedQuestIds: new Set<string>(),
          lastScoreTime: entry.awardedAt,
        };
      }
      playerStats[entry.playerId].totalPoints += entry.points;
      if (entry.questId) {
        playerStats[entry.playerId].completedQuestIds.add(entry.questId);
      }
      if (new Date(entry.awardedAt) > new Date(playerStats[entry.playerId].lastScoreTime)) {
        playerStats[entry.playerId].lastScoreTime = entry.awardedAt;
      }
    });

  const currentPlayer = getCurrentPlayer();
  if (!playerStats[currentPlayer.id]) {
    playerStats[currentPlayer.id] = {
      totalPoints: 0,
      completedQuestIds: new Set<string>(),
      lastScoreTime: new Date().toISOString(),
    };
  }

  const leaderboard: LeaderboardEntry[] = Object.entries(playerStats).map(([playerId, stats]) => {
    const playerObj = players.find((p) => p.id === playerId) || {
      displayName: playerId === currentPlayer.id ? currentPlayer.displayName : 'Anonymous Agent',
      avatarUrl: '⚡',
    };

    const teamMember = members.find((m) => {
      if (m.playerId !== playerId) return false;
      const t = teams.find((team) => team.id === m.teamId);
      return t && t.eventId === eventId;
    });
    const teamObj = teamMember ? teams.find((t) => t.id === teamMember.teamId) : undefined;

    return {
      rank: 0,
      playerId,
      displayName: playerObj.displayName,
      avatarUrl: playerObj.avatarUrl || '⚡',
      totalPoints: Math.max(0, stats.totalPoints),
      questsCompletedCount: stats.completedQuestIds.size,
      lastScoreTime: stats.lastScoreTime,
      teamName: teamObj?.name,
    };
  });

  leaderboard.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return new Date(a.lastScoreTime || 0).getTime() - new Date(b.lastScoreTime || 0).getTime();
  });

  return leaderboard.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

export function getPlayerProgress(playerId: string, eventId: string): PlayerEventProgress {
  initializeGameEngine();
  const submissions = getSubmissionsForPlayer(playerId, eventId);
  const quests = getQuestsForEvent(eventId);
  const leaderboard = getLeaderboardForEvent(eventId);
  const teamInfo = getTeamForPlayer(playerId, eventId);
  const isQualified = isPlayerQualifiedForFinale(playerId, eventId);

  const verifiedSubmissions = submissions.filter((s) => s.status === 'verified');
  const pendingSubmissions = submissions.filter((s) => s.status === 'pending');

  const completedQuestIds = verifiedSubmissions.map((s) => s.questId);
  const pendingSubmissionQuestIds = pendingSubmissions.map((s) => s.questId);

  const totalPoints = verifiedSubmissions.reduce((sum, s) => sum + s.awardedPoints, 0);
  const leaderboardEntry = leaderboard.find((l) => l.playerId === playerId);

  return {
    totalPoints,
    completedQuestIds,
    pendingSubmissionQuestIds,
    completedCount: completedQuestIds.length,
    availableCount: quests.length,
    rank: leaderboardEntry ? leaderboardEntry.rank : leaderboard.length + 1,
    team: teamInfo.team,
    isQualifiedForFinale: isQualified,
  };
}

export function reviewSubmission(
  submissionId: string,
  newStatus: 'verified' | 'rejected' | 'retry_requested',
  feedback?: string,
  reviewerNotes?: string
): QuestSubmission | undefined {
  initializeGameEngine();
  const submissions = getAllSubmissions();
  const sub = submissions.find((s) => s.id === submissionId);
  if (!sub) return undefined;

  sub.status = newStatus;
  sub.feedback = feedback;
  sub.reviewerNotes = reviewerNotes;
  sub.reviewedAt = new Date().toISOString();
  if (newStatus === 'retry_requested') {
    sub.retryRequested = true;
  }

  if (newStatus === 'verified') {
    const quest = getQuestById(sub.questId);
    const isMultiStepQuest = quest?.verificationType === 'multi_step';
    const totalStepCount = quest?.steps?.length || 0;
    const approvedStepOrder = sub.completedStepOrder || 0;

    if (isMultiStepQuest && approvedStepOrder > 0 && approvedStepOrder < totalStepCount) {
      sub.status = 'in_progress';
      sub.awardedPoints = 0;
      sub.drawingEntriesAwarded = 0;
      setStoredItem(STORAGE_KEYS.SUBMISSIONS, submissions);
      return sub;
    }

    const xp = quest ? (quest.xpReward || quest.pointValue) : 100;
    const entries = quest ? (quest.drawingEntryReward ?? 1) : 1;

    sub.awardedPoints = xp;
    sub.drawingEntriesAwarded = entries;

    recordScoreLedger({
      eventId: sub.eventId,
      playerId: sub.playerId,
      teamId: sub.teamId,
      questId: sub.questId,
      submissionId: sub.id,
      points: sub.awardedPoints,
      category: quest ? quest.category : 'admin_approved',
      description: `Media submission approved for ${quest ? quest.title : 'Quest'}`,
    });

    awardDrawingEntries({
      eventId: sub.eventId,
      playerId: sub.playerId,
      questId: sub.questId,
      submissionId: sub.id,
      entriesCount: entries,
      sourceType: 'quest_completion',
      reason: `Media submission approved for ${quest ? quest.title : 'Quest'}`,
    });
  }

  setStoredItem(STORAGE_KEYS.SUBMISSIONS, submissions);
  return sub;
}

export function getActivityLog(): EventActivityItem[] {
  initializeGameEngine();
  return getStoredItem<EventActivityItem[]>(STORAGE_KEYS.ACTIVITY_LOG, []);
}

export function logActivity(item: Omit<EventActivityItem, 'id' | 'timestamp'>): void {
  initializeGameEngine();
  const logs = getStoredItem<EventActivityItem[]>(STORAGE_KEYS.ACTIVITY_LOG, []);
  const newLog: EventActivityItem = {
    ...item,
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  setStoredItem(STORAGE_KEYS.ACTIVITY_LOG, [newLog, ...logs].slice(0, 50));
}

// -----------------------------------------------------------------------------
// Spectator Engine Re-exports (Phase 5.1)
// -----------------------------------------------------------------------------
export {
  createSessionTokenHash,
  createIpHash,
  registerOrUpdateSpectatorSession,
  convertSpectatorToPlayer,
  createAudienceEvent,
  getAudienceEvents,
  getAudienceEventOptions,
  castSpectatorVote,
  resolveAudienceEvent,
  mapCoordinatesToDistrict,
  sanitizeActivityItem,
  publishToPublicGameFeed,
  getPublicGameFeed,
  createHostBroadcast,
  getHostBroadcasts,
  toggleSpectatorSystemFreeze,
  getSpectatorSystemSettings,
  resetSpectatorStores,
} from './spectator-engine';
