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
  EventParticipation,
  ProofVerificationType,
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
  Achievement,
  PlayerAchievement,
  StartingPath,
  QuestPath,
  DistrictContentSummary,
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
  AuthenticatedPlayerDrawingQualification,
  DrawingLedgerReview,
  DrawProvider,
  FinalQuestEventMetrics,
  FinalQuestTrailStep,
  FinalQuestTicketRange,
  FinalQuestDrawReceipt,
  RewardGrant,
  RewardGrantReason,
} from './types';
import {
  computeAwardedBonusesForSubmission,
  getEffectiveBaseXp,
  getQuestAvailability,
  getUnlockSummary,
} from './quest-rewards';
import {
  SEED_CITY,
  SEED_LOCATIONS,
  SEED_EVENT,
  SEED_FAIR_EVENT,
  SEED_MISSING_SIGNAL_EVENT,
  SEED_MIDNIGHT_LEDGER_EVENT,
  SEED_FAIR_QUESTS,
  SEED_QUESTS,
  SEED_DEMO_PLAYERS,
  SEED_COLLECTIBLES,
  SEED_ACHIEVEMENTS,
  SEED_SECRET_CODES,
  SEED_ANNOUNCEMENTS,
  SEED_NPCS,
  SEED_PARTNERS,
  SEED_CROWD_OBJECTIVES,
  SEED_BONUS_WINDOWS,
  SEED_PRIZES,
  SEED_FAIR_MYSTERY_PRIZES,
} from './seed-data';
import { checkProximity, formatDistance } from './geo';
import { evaluateProofIntegrity } from './proof-integrity';
import { sanitizeTextContent } from './spectator-engine';
import { isProfileIdentityComplete } from './player-command-center';
import {
  FOUNDER_CIPHER_DISTRICTS,
  verifyDistrictDecodeSequence,
} from './founders-cipher';
import {
  FAIR_CORE_CATEGORY,
  MYSTERY_TOTAL_POOL_CENTS,
  computeMysteryBoardTotals,
  parseMysterySignalNumber,
  type FairMysteryBoard,
  type FairMysteryClaimResult,
  type FairMysterySignalPublic,
  type FairMysteryWinner,
} from './fair-hunt';

const STORAGE_KEYS = {
  CURRENT_PLAYER: 'canton_quests_current_player',
  PLAYERS: 'canton_quests_players',
  EVENTS: 'canton_quests_events',
  QUESTS: 'canton_quests_quests',
  SUBMISSIONS: 'canton_quests_submissions',
  SCORE_LEDGER: 'canton_quests_score_ledger',
  DRAWING_LEDGER: 'canton_quests_drawing_ledger',
  DRAWING_LOCKS: 'canton_quests_drawing_locks',
  ACTIVITY_LOG: 'canton_quests_activity_log',
  ANNOUNCEMENTS: 'canton_quests_announcements',
  SECRET_CODES: 'canton_quests_secret_codes',
  CODE_REDEMPTIONS: 'canton_quests_code_redemptions',
  COLLECTIBLES: 'canton_quests_collectibles',
  PLAYER_COLLECTIBLES: 'canton_quests_player_collectibles',
  ACHIEVEMENTS: 'canton_quests_achievements',
  PLAYER_ACHIEVEMENTS: 'canton_quests_player_achievements',
  NPCS: 'canton_quests_npcs',
  PARTNERS: 'canton_quests_partners',
  CROWD_OBJECTIVES: 'canton_quests_crowd_objectives',
  BONUS_WINDOWS: 'canton_quests_bonus_windows',
  FINALE_QUALIFICATIONS: 'canton_quests_finale_qualifications',
  PRIZES: 'canton_quests_prizes',
  PRIZE_DRAWS: 'canton_quests_prize_draw_records',
  GENERATED_QRS: 'canton_quests_generated_qrs',
  LOCATIONS: 'canton_quests_locations',
  REWARD_GRANTS: 'canton_quests_reward_grants',
  EVENT_PLAYERS: 'canton_quests_event_players',
  CIPHER_FRAGMENT_GRANTS: 'canton_quests_cipher_fragment_grants',
  CIPHER_DISTRICT_PROGRESS: 'canton_quests_cipher_district_progress',
  FAIR_MYSTERY_PRIZES: 'canton_quests_fair_mystery_prizes',
  FAIR_MYSTERY_CLAIMS: 'canton_quests_fair_mystery_claims',
};

const inMemoryStore = new Map<string, any>();

const MAX_TRUSTED_GPS_ACCURACY_METERS = 100;

import { getServerProofSecretMaps, proofDigest, proofMatches, proofMatchesAny } from './quest-proof-secrets';

function mergeServerQuestTargetCodes(quests: Quest[]): Quest[] {
  const maps = getServerProofSecretMaps();
  if (!maps) return quests;
  return quests.map((quest) => ({
    ...quest,
    targetCode: quest.targetCode || maps.QUEST_TARGET_CODE_HASHES[quest.id],
    steps: quest.steps?.map((step) => ({
      ...step,
      targetCode: step.targetCode || maps.STEP_TARGET_CODE_HASHES?.[step.id],
    })),
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
    setStoredItem(STORAGE_KEYS.EVENTS, [
      JSON.parse(JSON.stringify(SEED_EVENT)),
      JSON.parse(JSON.stringify(SEED_FAIR_EVENT)),
      JSON.parse(JSON.stringify(SEED_MISSING_SIGNAL_EVENT)),
      JSON.parse(JSON.stringify(SEED_MIDNIGHT_LEDGER_EVENT)),
    ]);
  }
  if (getStoredItem<Quest[]>(STORAGE_KEYS.QUESTS, []).length === 0) {
    setStoredItem(
      STORAGE_KEYS.QUESTS,
      mergeServerQuestTargetCodes(JSON.parse(JSON.stringify([...SEED_QUESTS, ...SEED_FAIR_QUESTS])))
    );
  }
  if (getStoredItem<LocationInfo[]>(STORAGE_KEYS.LOCATIONS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.LOCATIONS, JSON.parse(JSON.stringify(SEED_LOCATIONS)));
  }
  if (getStoredItem<Player[]>(STORAGE_KEYS.PLAYERS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.PLAYERS, JSON.parse(JSON.stringify(SEED_DEMO_PLAYERS)));
  }
  if (getStoredItem<Collectible[]>(STORAGE_KEYS.COLLECTIBLES, []).length === 0) {
    setStoredItem(STORAGE_KEYS.COLLECTIBLES, JSON.parse(JSON.stringify(SEED_COLLECTIBLES)));
  }
  if (getStoredItem<Achievement[]>(STORAGE_KEYS.ACHIEVEMENTS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.parse(JSON.stringify(SEED_ACHIEVEMENTS)));
  }
  if (getStoredItem<SecretCode[]>(STORAGE_KEYS.SECRET_CODES, []).length === 0) {
    setStoredItem(STORAGE_KEYS.SECRET_CODES, mergeServerSecretCodes(JSON.parse(JSON.stringify(SEED_SECRET_CODES))));
  }
  if (getStoredItem<LiveAnnouncement[]>(STORAGE_KEYS.ANNOUNCEMENTS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.parse(JSON.stringify(SEED_ANNOUNCEMENTS)));
  }
  if (getStoredItem<NPCCharacter[]>(STORAGE_KEYS.NPCS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.NPCS, JSON.parse(JSON.stringify(SEED_NPCS)));
  }
  if (getStoredItem<BusinessPartnerInfo[]>(STORAGE_KEYS.PARTNERS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.PARTNERS, JSON.parse(JSON.stringify(SEED_PARTNERS)));
  }
  if (getStoredItem<CrowdObjective[]>(STORAGE_KEYS.CROWD_OBJECTIVES, []).length === 0) {
    setStoredItem(STORAGE_KEYS.CROWD_OBJECTIVES, JSON.parse(JSON.stringify(SEED_CROWD_OBJECTIVES)));
  }
  if (getStoredItem<BonusWindow[]>(STORAGE_KEYS.BONUS_WINDOWS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.BONUS_WINDOWS, JSON.parse(JSON.stringify(SEED_BONUS_WINDOWS)));
  }
  if (getStoredItem<Prize[]>(STORAGE_KEYS.PRIZES, []).length === 0) {
    setStoredItem(STORAGE_KEYS.PRIZES, JSON.parse(JSON.stringify(SEED_PRIZES)));
  }
  if (getStoredItem<Array<{ questId: string; cashCents: number }>>(STORAGE_KEYS.FAIR_MYSTERY_PRIZES, []).length === 0) {
    setStoredItem(STORAGE_KEYS.FAIR_MYSTERY_PRIZES, JSON.parse(JSON.stringify(SEED_FAIR_MYSTERY_PRIZES)));
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
  const targetUrl = `https://www.cantonquests.com/qr/${token}`;

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

export function awardCollectible(
  playerId: string,
  collectibleId: string,
  source: string = 'quest',
  eventId?: string
): Collectible | undefined {
  initializeGameEngine();
  const catalog = getStoredItem<Collectible[]>(STORAGE_KEYS.COLLECTIBLES, SEED_COLLECTIBLES);
  const playerCols = getStoredItem<PlayerCollectible[]>(STORAGE_KEYS.PLAYER_COLLECTIBLES, []);

  const item = catalog.find((c) => c.id === collectibleId || c.slug === collectibleId);
  if (!item) return undefined;

  const alreadyHas = playerCols.some(
    (pc) => pc.playerId === playerId && pc.collectibleId === item.id && (!eventId || !pc.eventId || pc.eventId === eventId)
  );
  if (!alreadyHas) {
    const newRecord: PlayerCollectible = {
      id: `pcol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      playerId,
      collectibleId: item.id,
      earnedAt: new Date().toISOString(),
      source,
      eventId,
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

export function getCollectiblesForPlayer(playerId: string, eventId?: string): PlayerCollectible[] {
  initializeGameEngine();
  const playerCols = getStoredItem<PlayerCollectible[]>(STORAGE_KEYS.PLAYER_COLLECTIBLES, []);
  const catalog = getStoredItem<Collectible[]>(STORAGE_KEYS.COLLECTIBLES, SEED_COLLECTIBLES);

  return playerCols
    .filter((pc) => pc.playerId === playerId && (!eventId || !pc.eventId || pc.eventId === eventId))
    .map((pc) => ({
      ...pc,
      collectible: catalog.find((c) => c.id === pc.collectibleId),
    }));
}

// 5b. ACHIEVEMENTS ENGINE
export function getAchievements(): Achievement[] {
  initializeGameEngine();
  return getStoredItem<Achievement[]>(STORAGE_KEYS.ACHIEVEMENTS, SEED_ACHIEVEMENTS);
}

export function getAchievementsForPlayer(playerId: string): PlayerAchievement[] {
  initializeGameEngine();
  const achievements = getAchievements();
  const playerAchievements = getStoredItem<PlayerAchievement[]>(STORAGE_KEYS.PLAYER_ACHIEVEMENTS, []);
  return playerAchievements
    .filter((pa) => pa.playerId === playerId)
    .map((pa) => ({
      ...pa,
      achievement: achievements.find((a) => a.slug === pa.achievementSlug || a.id === pa.achievementId),
    }));
}

export function awardAchievement(
  playerId: string,
  achievementSlug: string,
  eventId?: string,
  provenance?: string
): PlayerAchievement | undefined {
  initializeGameEngine();
  const achievements = getAchievements();
  const achievement = achievements.find((a) => a.slug === achievementSlug || a.id === achievementSlug);
  if (!achievement) return undefined;

  const existingList = getStoredItem<PlayerAchievement[]>(STORAGE_KEYS.PLAYER_ACHIEVEMENTS, []);
  const alreadyEarned = existingList.find(
    (pa) => pa.playerId === playerId && (pa.achievementSlug === achievement.slug || pa.achievementId === achievement.id)
  );
  if (alreadyEarned) {
    return {
      ...alreadyEarned,
      achievement,
    };
  }

  const newRecord: PlayerAchievement = {
    id: `pach-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    playerId,
    achievementId: achievement.id,
    achievementSlug: achievement.slug,
    eventId,
    earnedAt: new Date().toISOString(),
    provenance: provenance || 'Server verified accomplishment',
    achievement,
  };

  setStoredItem(STORAGE_KEYS.PLAYER_ACHIEVEMENTS, [...existingList, newRecord]);

  const player = getAllPlayers().find((p) => p.id === playerId);
  logActivity({
    type: 'collectible_earned',
    actorName: player?.displayName || 'Player',
    title: `Achievement Unlocked: ${achievement.name}`,
    details: `${achievement.badgeSymbol} ${achievement.description}`,
  });

  return newRecord;
}

export function evaluatePlayerAchievements(playerId: string, eventId: string): PlayerAchievement[] {
  initializeGameEngine();
  const player = getAllPlayers().find((p) => p.id === playerId);
  if (!player) return [];

  const submissions = getAllSubmissions().filter(
    (s) => s.playerId === playerId && s.eventId === eventId && s.status === 'verified'
  );
  const completedQuestIds = new Set(submissions.map((s) => s.questId));
  const quests = getQuestsForEvent(eventId);

  const completedQuests = quests.filter((q) => completedQuestIds.has(q.id));
  const completedPaths = new Set(completedQuests.map((q) => q.startingPath).filter(Boolean));

  const newlyAwarded: PlayerAchievement[] = [];

  // 1. Pathfinder for chosen starting path
  const chosenPath = player.selectedStartingPath;
  if (chosenPath) {
    const hasCompletedChosenPath = completedQuests.some((q) => q.startingPath === chosenPath);
    if (hasCompletedChosenPath) {
      const slug = `pathfinder-${chosenPath}`;
      const res = awardAchievement(playerId, slug, eventId, `Completed first ${chosenPath} mission`);
      if (res) newlyAwarded.push(res);
    }
  }

  // 2. Triple Threat (Family, Challenge, Secret)
  if (completedPaths.has('family') && completedPaths.has('challenge') && completedPaths.has('secret')) {
    const res = awardAchievement(playerId, 'triple-threat', eventId, 'Completed missions across all 3 starting paths');
    if (res) newlyAwarded.push(res);
  }

  // 3. District Sweeps
  for (const path of ['family', 'challenge', 'secret'] as StartingPath[]) {
    const activeDistrictQuests = quests.filter((q) => q.startingPath === path && q.status === 'active');
    if (activeDistrictQuests.length > 0 && activeDistrictQuests.every((q) => completedQuestIds.has(q.id))) {
      const res = awardAchievement(playerId, `district-sweep-${path}`, eventId, `Swept all active missions in ${path} district`);
      if (res) newlyAwarded.push(res);
    }
  }

  // 4. Nomad: Completed missions across all 3 districts within same day
  const submissionsByDay = new Map<string, Set<string>>();
  for (const sub of submissions) {
    const day = sub.submittedAt.slice(0, 10);
    const q = quests.find((item) => item.id === sub.questId);
    if (q?.startingPath && q.startingPath !== 'cross_city') {
      if (!submissionsByDay.has(day)) submissionsByDay.set(day, new Set());
      submissionsByDay.get(day)!.add(q.startingPath);
    }
  }
  for (const [, paths] of submissionsByDay) {
    if (paths.has('family') && paths.has('challenge') && paths.has('secret')) {
      const res = awardAchievement(playerId, 'nomad', eventId, 'Completed all 3 districts in a single day');
      if (res) newlyAwarded.push(res);
      break;
    }
  }

  return newlyAwarded;
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

export function getBonusWindows(eventId: string): BonusWindow[] {
  initializeGameEngine();
  const windows = getStoredItem<BonusWindow[]>(STORAGE_KEYS.BONUS_WINDOWS, SEED_BONUS_WINDOWS);
  return windows.filter((w) => w.eventId === eventId);
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

export function getPlayerThreeLocks(
  playerId: string,
  eventId?: string
): { mark: boolean; code: boolean; word: boolean; hasAll: boolean } {
  initializeGameEngine();
  const keys = new Set<string>();

  if (eventId) {
    // 1. Check reward_grants for event-scoped lock provenance
    const grants = getStoredItem<RewardGrant[]>(STORAGE_KEYS.REWARD_GRANTS, []);
    const eventGrants = grants.filter(
      (g) => g.playerId === playerId && g.eventId === eventId && (g.rewardType === 'THREE_LOCKS_FRAGMENT' || g.rewardType === 'COLLECTIBLE_UNLOCK')
    );
    for (const g of eventGrants) {
      if (g.rewardKey) keys.add(g.rewardKey);
    }

    // 2. Check player collectibles with eventId
    const playerCols = getStoredItem<PlayerCollectible[]>(STORAGE_KEYS.PLAYER_COLLECTIBLES, []);
    for (const pc of playerCols) {
      if (pc.playerId === playerId && pc.eventId === eventId) {
        keys.add(pc.collectibleId);
        if (pc.collectible?.slug) keys.add(pc.collectible.slug);
      }
    }
  } else {
    // Fallback if no eventId passed
    const owned = getCollectiblesForPlayer(playerId);
    for (const pc of owned) {
      keys.add(pc.collectibleId);
      if (pc.collectible?.slug) keys.add(pc.collectible.slug);
    }
  }

  const mark = keys.has('col-founder-mark') || keys.has('founder-mark');
  const code = keys.has('col-founder-code') || keys.has('founder-code');
  const word = keys.has('col-founder-word') || keys.has('founder-word');

  return {
    mark,
    code,
    word,
    hasAll: mark && code && word,
  };
}

export function isPlayerQualifiedForFinale(playerId: string, eventId: string): boolean {
  initializeGameEngine();
  const locks = getPlayerThreeLocks(playerId, eventId);
  if (!locks.hasAll) return false;

  const hasAllSigils = (['arts', 'challenge', 'secret'] as const).every((districtKey) =>
    isLocalCipherDistrictTokenUnlocked(playerId, eventId, districtKey)
  );
  return hasAllSigils;
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

export function getPlayerById(playerId: string): Player | undefined {
  initializeGameEngine();
  const players = getAllPlayers();
  return players.find((p) => p.id === playerId);
}

export function getPlayerByUserId(userId: string): Player | undefined {
  initializeGameEngine();
  const players = getAllPlayers();
  return players.find((p) => p.userId === userId);
}

export function claimLegacyPlayerByEmail(userId: string, email: string): Player | undefined {
  initializeGameEngine();
  const players = getAllPlayers();
  const cleanEmail = email.trim().toLowerCase();
  const legacy = players.find(
    (p) => p.email && p.email.toLowerCase() === cleanEmail && !p.userId
  );
  if (legacy) {
    legacy.userId = userId;
    legacy.updatedAt = new Date().toISOString();
    setStoredItem(STORAGE_KEYS.PLAYERS, players);
    return legacy;
  }
  return undefined;
}

export function registerPlayer(params: {
  displayName: string;
  userId?: string;
  email?: string;
  password?: string;
  avatarUrl?: string;
  avatarPresetKey?: string;
  profileImagePath?: string | null;
  profileImageCropZoom?: number;
  profileImageCropX?: number;
  profileImageCropY?: number;
  profileVisibility?: 'public' | 'private';
  playerImageVisibility?: 'public' | 'private';
  selectedStartingPath?: StartingPath;
  acquisitionSource?: string;
  isMinor?: boolean;
  bio?: string;
  tagline?: string;
  hometown?: string;
  themeColor?: string;
  favoriteStyle?: string;
  selectedFlair?: string;
}): Player {
  initializeGameEngine();
  const cleanName = sanitizeTextContent(params.displayName || '').trim();
  if (!cleanName || cleanName.length < 2) {
    throw new Error('Callsign must be at least 2 characters.');
  }

  const players = getStoredItem<Player[]>(STORAGE_KEYS.PLAYERS, SEED_DEMO_PLAYERS);

  // 1. If userId is provided, check if player already exists for this authenticated user
  if (params.userId) {
    const existingByUser = players.find((p) => p.userId === params.userId);
    if (existingByUser) {
      const updated: Player = {
        ...existingByUser,
        displayName: cleanName,
        email: params.email ? params.email.trim().toLowerCase() : existingByUser.email,
        selectedStartingPath: params.selectedStartingPath !== undefined ? params.selectedStartingPath : existingByUser.selectedStartingPath,
        acquisitionSource: existingByUser.acquisitionSource || params.acquisitionSource || 'main_site',
        avatarUrl: params.avatarUrl || existingByUser.avatarUrl || '⚡',
        avatarPresetKey: params.avatarPresetKey || existingByUser.avatarPresetKey,
        profileImagePath: params.profileImagePath || existingByUser.profileImagePath,
        profileImageCropZoom: params.profileImageCropZoom ?? existingByUser.profileImageCropZoom,
        profileImageCropX: params.profileImageCropX ?? existingByUser.profileImageCropX,
        profileImageCropY: params.profileImageCropY ?? existingByUser.profileImageCropY,
        // Privacy toggles are retired — always public.
        profileVisibility: 'public',
        playerImageVisibility: 'public',
        bio: params.bio !== undefined ? sanitizeTextContent(params.bio) : existingByUser.bio,
        tagline: params.tagline !== undefined ? sanitizeTextContent(params.tagline) : existingByUser.tagline,
        hometown: params.hometown !== undefined ? sanitizeTextContent(params.hometown) : existingByUser.hometown,
        themeColor: params.themeColor || existingByUser.themeColor,
        favoriteStyle: params.favoriteStyle || existingByUser.favoriteStyle,
        selectedFlair: params.selectedFlair || existingByUser.selectedFlair,
        isMinor: params.isMinor !== undefined ? params.isMinor : existingByUser.isMinor,
        updatedAt: new Date().toISOString(),
      };
      const updatedPlayers = players.map((p) => (p.id === existingByUser.id ? updated : p));
      setStoredItem(STORAGE_KEYS.PLAYERS, updatedPlayers);
      setStoredItem(STORAGE_KEYS.CURRENT_PLAYER, updated);
      return updated;
    }

    // 2. Check if an unlinked legacy account exists for the verified email
    if (params.email) {
      const cleanEmail = params.email.trim().toLowerCase();
      const legacy = players.find((p) => p.email && p.email.toLowerCase() === cleanEmail && !p.userId);
      if (legacy) {
        legacy.userId = params.userId;
        legacy.displayName = cleanName || legacy.displayName;
        legacy.updatedAt = new Date().toISOString();
        const updatedPlayers = players.map((p) => (p.id === legacy.id ? legacy : p));
        setStoredItem(STORAGE_KEYS.PLAYERS, updatedPlayers);
        setStoredItem(STORAGE_KEYS.CURRENT_PLAYER, legacy);
        return legacy;
      }
    }
  }

  // 3. Create a brand new player
  const newPlayer: Player = {
    id: `plr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: params.userId,
    displayName: cleanName,
    email: params.email?.trim().toLowerCase(),
    avatarUrl: params.avatarUrl || '⚡',
    avatarPresetKey: params.avatarPresetKey,
    profileImagePath: params.profileImagePath,
    profileImageCropZoom: params.profileImageCropZoom,
    profileImageCropX: params.profileImageCropX,
    profileImageCropY: params.profileImageCropY,
    // Privacy toggles are retired — always public.
    profileVisibility: 'public',
    playerImageVisibility: 'public',
    role: 'player',
    totalXp: 0,
    level: 1,
    selectedStartingPath: params.selectedStartingPath,
    acquisitionSource: params.acquisitionSource || 'main_site',
    bio: params.bio ? sanitizeTextContent(params.bio) : undefined,
    tagline: params.tagline ? sanitizeTextContent(params.tagline) : undefined,
    hometown: params.hometown ? sanitizeTextContent(params.hometown) : undefined,
    themeColor: params.themeColor,
    favoriteStyle: params.favoriteStyle,
    selectedFlair: params.selectedFlair,
    isMinor: params.isMinor,
    createdAt: new Date().toISOString(),
  };

  const updatedPlayers = [...players, newPlayer];
  setStoredItem(STORAGE_KEYS.PLAYERS, updatedPlayers);
  setStoredItem(STORAGE_KEYS.CURRENT_PLAYER, newPlayer);

  logActivity({
    type: 'player_joined',
    actorName: newPlayer.displayName,
    title: `Agent Registered: ${newPlayer.displayName}`,
    details: `Selected path: ${newPlayer.selectedStartingPath?.toUpperCase()} (Acquisition: ${newPlayer.acquisitionSource})`,
  });

  return newPlayer;
}

export function updatePlayerProfile(playerId: string, updates: Partial<Player>): Player {
  initializeGameEngine();
  const players = getStoredItem<Player[]>(STORAGE_KEYS.PLAYERS, SEED_DEMO_PLAYERS);
  const player = players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error('Player not found.');
  }

  // Never allow changing immutable id or acquisition source
  const updated: Player = {
    ...player,
    displayName: updates.displayName ? sanitizeTextContent(updates.displayName).trim() : player.displayName,
    avatarUrl: updates.avatarUrl || player.avatarUrl,
    avatarPresetKey: updates.avatarPresetKey !== undefined ? updates.avatarPresetKey : player.avatarPresetKey,
    profileImagePath: updates.profileImagePath !== undefined ? updates.profileImagePath : player.profileImagePath,
    profileImageCropZoom: updates.profileImageCropZoom !== undefined ? updates.profileImageCropZoom : player.profileImageCropZoom,
    profileImageCropX: updates.profileImageCropX !== undefined ? updates.profileImageCropX : player.profileImageCropX,
    profileImageCropY: updates.profileImageCropY !== undefined ? updates.profileImageCropY : player.profileImageCropY,
    // Privacy toggles are retired — always public.
    profileVisibility: 'public',
    playerImageVisibility: 'public',
    selectedStartingPath: updates.selectedStartingPath || player.selectedStartingPath,
    bio: updates.bio !== undefined ? sanitizeTextContent(updates.bio) : player.bio,
    tagline: updates.tagline !== undefined ? sanitizeTextContent(updates.tagline) : player.tagline,
    hometown: updates.hometown !== undefined ? sanitizeTextContent(updates.hometown) : player.hometown,
    themeColor: updates.themeColor || player.themeColor,
    favoriteStyle: updates.favoriteStyle || player.favoriteStyle,
    selectedFlair: updates.selectedFlair || player.selectedFlair,
    showcaseBadges: updates.showcaseBadges || player.showcaseBadges,
    featuredBadgeSlugs: updates.featuredBadgeSlugs || player.featuredBadgeSlugs,
    isMinor: updates.isMinor !== undefined ? updates.isMinor : player.isMinor,
    updatedAt: new Date().toISOString(),
  };

  const updatedPlayers = players.map((p) => (p.id === playerId ? updated : p));
  setStoredItem(STORAGE_KEYS.PLAYERS, updatedPlayers);

  const current = getStoredItem<Player | null>(STORAGE_KEYS.CURRENT_PLAYER, null);
  if (current && current.id === playerId) {
    setStoredItem(STORAGE_KEYS.CURRENT_PLAYER, updated);
  }

  return updated;
}

export const PROFILE_COMPLETION_XP = 100;

/**
 * The one-time, account-level Player Identity onboarding reward: +100 XP,
 * no Entry Token, awarded exactly once per player the first time they have
 * a valid avatar (preset or custom-with-upload). Path is deliberately not
 * part of this check — it's an Operation-specific attribute, not a
 * permanent-identity requirement (see isProfileIdentityComplete in
 * lib/player-command-center.ts). Call this after any profile mutation
 * capable of satisfying the requirement (avatar preset selection, custom
 * photo upload) — it always re-evaluates the player's current authoritative
 * state and is a safe no-op if already granted or not yet qualified. Never
 * awards a drawing entry.
 */
export function evaluateAndGrantProfileCompletionReward(playerId: string): { newlyGranted: boolean; xpAwarded: number; newAchievement?: PlayerAchievement } {
  initializeGameEngine();
  const player = getAllPlayers().find((p) => p.id === playerId);
  if (!player || !isProfileIdentityComplete(player)) {
    return { newlyGranted: false, xpAwarded: 0 };
  }

  const granted = recordRewardGrant({
    eventId: SEED_EVENT.id,
    playerId,
    rewardType: 'PROFILE_COMPLETION',
    rewardKey: 'profile_identity_complete',
    xpAwarded: PROFILE_COMPLETION_XP,
  });
  if (!granted) {
    return { newlyGranted: false, xpAwarded: 0 };
  }

  recordScoreLedger({
    eventId: SEED_EVENT.id,
    playerId,
    points: PROFILE_COMPLETION_XP,
    category: 'profile_completion',
    description: 'Player identity complete — avatar selected',
  });

  const newAchievement = awardAchievement(playerId, 'field-ready', SEED_EVENT.id, 'Player identity complete — avatar selected');

  return { newlyGranted: true, xpAwarded: PROFILE_COMPLETION_XP, newAchievement };
}

export function getEvents(): QuestEvent[] {
  initializeGameEngine();
  return getStoredItem<QuestEvent[]>(STORAGE_KEYS.EVENTS, [SEED_EVENT]);
}

export function getEventBySlug(slug: string): QuestEvent | undefined {
  const events = getEvents();
  return events.find((e) => e.slug === slug);
}

// -----------------------------------------------------------------------------
// Operation Participation (event_players) — local/offline engine
// -----------------------------------------------------------------------------

export function getEventParticipation(eventId: string, playerId: string): EventParticipation | undefined {
  initializeGameEngine();
  const rows = getStoredItem<EventParticipation[]>(STORAGE_KEYS.EVENT_PLAYERS, []);
  return rows.find((r) => r.eventId === eventId && r.playerId === playerId);
}

/**
 * Finds or creates the (event_id, player_id) participation record — the
 * canonical "this player entered this Operation" fact. Never creates a
 * second row for the same player+event (mirrors event_players' real
 * UNIQUE(event_id, player_id) constraint). If a path is supplied and the
 * existing record has none yet, it's filled in (a player choosing their
 * path after already entering); an existing non-null path is never
 * overwritten by a later call.
 */
export function getOrCreateEventParticipation(
  eventId: string,
  playerId: string,
  path?: StartingPath | null
): EventParticipation {
  initializeGameEngine();
  const rows = getStoredItem<EventParticipation[]>(STORAGE_KEYS.EVENT_PLAYERS, []);
  const existing = rows.find((r) => r.eventId === eventId && r.playerId === playerId);
  if (existing) {
    if (path && !existing.path) {
      existing.path = path;
      setStoredItem(STORAGE_KEYS.EVENT_PLAYERS, rows);
    }
    return existing;
  }

  const created: EventParticipation = {
    id: `evp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventId,
    playerId,
    path: path || null,
    registeredAt: new Date().toISOString(),
  };
  setStoredItem(STORAGE_KEYS.EVENT_PLAYERS, [...rows, created]);
  return created;
}

export function getLocalEventPlayerPaths(eventId: string): Record<'family' | 'challenge' | 'secret', number> {
  initializeGameEngine();
  const rows = getStoredItem<EventParticipation[]>(STORAGE_KEYS.EVENT_PLAYERS, []);
  const counts: Record<'family' | 'challenge' | 'secret', number> = { family: 0, challenge: 0, secret: 0 };
  for (const r of rows) {
    if (r.eventId === eventId && r.path && counts[r.path as 'family' | 'challenge' | 'secret'] !== undefined) {
      counts[r.path as 'family' | 'challenge' | 'secret']++;
    }
  }
  return counts;
}

export function getLocalActiveQuestsByPath(eventId: string): Record<'family' | 'challenge' | 'secret', number> {
  initializeGameEngine();
  const quests = getQuestsForEvent(eventId);
  const counts: Record<'family' | 'challenge' | 'secret', number> = { family: 0, challenge: 0, secret: 0 };
  for (const q of quests) {
    if (q.status === 'active' && q.startingPath && counts[q.startingPath as 'family' | 'challenge' | 'secret'] !== undefined) {
      counts[q.startingPath as 'family' | 'challenge' | 'secret']++;
    }
  }
  return counts;
}

export function createEvent(eventData: Omit<QuestEvent, 'id' | 'createdAt'>): QuestEvent {
  return createEventWizard(eventData);
}

export function updateEvent(eventId: string, patch: Partial<QuestEvent>): QuestEvent | undefined {
  const events = getEvents();
  const event = events.find((e) => e.id === eventId);
  if (!event) return undefined;

  Object.assign(event, patch);
  setStoredItem(STORAGE_KEYS.EVENTS, events);
  return event;
}

export function getEventById(eventId: string): QuestEvent | undefined {
  return getEvents().find((e) => e.id === eventId);
}

export function updateEventStatus(eventId: string, status: QuestEvent['status']): QuestEvent | undefined {
  return updateEvent(eventId, { status });
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

/**
 * Resolves a quest purely by its scan-only target_code (the value encoded
 * in a physical QR graphic) — never by slug/id, which are never printed
 * anywhere. Used by /api/qr/claim so a scanned code alone (no client-
 * supplied questId or eventId) can find the exact quest it belongs to,
 * whichever event owns it.
 */
export function getQuestByTargetCode(code: string): Quest | undefined {
  initializeGameEngine();
  const quests = getStoredItem<Quest[]>(STORAGE_KEYS.QUESTS, SEED_QUESTS);
  return quests.find((q) => q.verificationType === 'qr' && q.targetCode === code);
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

export function getSubmissionsForPlayer(playerId: string, eventId?: string): QuestSubmission[] {
  initializeGameEngine();
  const submissions = getStoredItem<QuestSubmission[]>(STORAGE_KEYS.SUBMISSIONS, []);
  return submissions.filter((s) => s.playerId === playerId && (!eventId || s.eventId === eventId));
}

export function getAllSubmissions(): QuestSubmission[] {
  initializeGameEngine();
  return getStoredItem<QuestSubmission[]>(STORAGE_KEYS.SUBMISSIONS, []);
}

/**
 * Distinct quests a player has ever submitted for, across all Missions
 * (lifetime scope, any submission status). Powers the Player Card's
 * PLAYER LEVEL segments.
 */
export function getParticipatedQuestCount(playerId: string): number {
  const submissions = getSubmissionsForPlayer(playerId);
  return new Set(submissions.map((s) => s.questId)).size;
}

/**
 * Whether a player has any submission (any status) for one specific
 * Mission. Powers the Player Card's PLAYER SIGNAL status.
 */
export function hasEventSubmission(playerId: string, eventId: string): boolean {
  return getSubmissionsForPlayer(playerId, eventId).length > 0;
}

function getLatestQuestProgressSubmission(
  submissions: QuestSubmission[],
  playerId: string,
  questId: string
): QuestSubmission | undefined {
  // submissions is in insertion order (oldest first). Tie-break equal
  // submittedAt timestamps (millisecond resolution — collides easily under
  // fast successive multi-step submissions) by preferring the
  // later-inserted entry, so "latest" never resolves to a stale step.
  let latest: QuestSubmission | undefined;
  for (const s of submissions) {
    if (s.playerId !== playerId || s.questId !== questId) continue;
    if (!latest || new Date(s.submittedAt).getTime() >= new Date(latest.submittedAt).getTime()) {
      latest = s;
    }
  }
  return latest;
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
    const serverSecrets = getServerProofSecretMaps();
    const stepTargetCode = step.targetCode || serverSecrets.STEP_TARGET_CODE_HASHES?.[step.id];
    if (proofMatchesAny(params.submittedContent, stepTargetCode, step.acceptedAnswerVariants)) {
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

  if (event && (event.currentPhase === 'ended' || event.status === 'ended' || (event as any).status === 'cancelled')) {
    return {
      success: false,
      submission: {
        id: `sub-ended-${Date.now()}`,
        questId: params.questId,
        playerId: params.playerId,
        eventId: params.eventId,
        proofType: params.proofType,
        status: 'rejected',
        awardedPoints: 0,
        submittedAt: new Date().toISOString(),
      },
      message: 'Event has concluded. No further quest submissions or score mutations are accepted.',
      awardedPoints: 0,
    };
  }

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

  const availability = getQuestAvailability(quest);
  if (!availability.ok) {
    return {
      success: false,
      submission: {
        id: `sub-unavailable-${Date.now()}`,
        questId: params.questId,
        playerId: params.playerId,
        eventId: params.eventId,
        proofType: params.proofType,
        status: 'rejected',
        awardedPoints: 0,
        submittedAt: new Date().toISOString(),
      },
      message: availability.message,
      awardedPoints: 0,
    };
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
      if (
        quest.remoteCapable &&
        params.proofType &&
        params.proofType !== existingSub.proofType &&
        (params.proofType === 'checkin' || params.proofType === 'gps' || params.proofType === 'photo' || params.proofType === 'video')
      ) {
        return submitSupplementalFieldProof(params, quest, existingSub);
      }
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

  if (quest.prerequisiteQuestId) {
    const hasCompletedPrerequisite = existingSubmissions.some(
      (submission) =>
        submission.playerId === params.playerId &&
        submission.eventId === params.eventId &&
        submission.questId === quest.prerequisiteQuestId &&
        submission.status === 'verified'
    );

    if (!hasCompletedPrerequisite) {
      const failedSubmission = buildRejectedSubmission(
        params,
        'Quest prerequisite is locked. Complete the previous mission in this chain first.'
      );
      return {
        success: false,
        submission: failedSubmission,
        message: failedSubmission.feedback || 'Quest prerequisite is locked.',
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
        flags: reviewFlags,
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
    const serverSecrets = getServerProofSecretMaps();
    const targetCode = quest.targetCode || serverSecrets.QUEST_TARGET_CODE_HASHES[quest.id] || (quest.slug ? serverSecrets.QUEST_TARGET_CODE_HASHES[quest.slug] : undefined);
    if (proofMatchesAny(params.submittedContent, targetCode, quest.acceptedAnswerVariants)) {
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
    const serverSecrets = getServerProofSecretMaps();
    const targetCode = quest.targetCode || serverSecrets.QUEST_TARGET_CODE_HASHES[quest.id] || (quest.slug ? serverSecrets.QUEST_TARGET_CODE_HASHES[quest.slug] : undefined);
    if (proofMatches(params.submittedContent, targetCode)) {
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
  let threeLocksFragmentAwardedResult: 'mark' | 'code' | 'word' | undefined;
  let threeLocksOwnedResult: { mark: boolean; code: boolean; word: boolean } | undefined;
  let cipherFragmentsAwarded: string[] | undefined;
  let cipherDistrictsUnlocked: Array<'arts' | 'challenge' | 'secret'> | undefined;
  let readyToDecodeDistricts: Array<'arts' | 'challenge' | 'secret'> | undefined;
  let isFirstCipherFragment: boolean | undefined;
  let oldRank: number | undefined = undefined;
  let newRank: number | undefined = undefined;
  let newAchievements: Array<{
    id: string;
    title: string;
    description: string;
    icon?: string;
    rewardXp?: number;
    rewardEntries?: number;
  }> | undefined = undefined;

  if (isAutoVerified) {
    const oldLeaderboard = getLeaderboardForEvent(params.eventId);
    oldRank = oldLeaderboard.find((e) => e.playerId === params.playerId)?.rank;

    const multiplier = getActiveBonusMultiplier(params.eventId, quest.category);
    const extraFlatXp = params.isHardModeOptIn && quest.riskReward ? quest.riskReward.hardModeBonus : 0;

    const grant = applyQuestRewardGrants(quest, newSubmission.id, params.eventId, params.playerId, params.proofType, {
      usedNfc: params.usedNfc,
      bonusMultiplier: multiplier,
      extraFlatXp,
      claimPlacement,
      scoreDescription: `Completed ${quest.title}${multiplier > 1.0 ? ` (${multiplier}x Bonus)` : ''}`,
    });

    if (grant.claimPlacement && quest.raceRewards) {
      const raceBonus = quest.raceRewards.find((r) => r.place === grant.claimPlacement);
      if (raceBonus) {
        validationMessage += ` 🥇 Placement Bonus #${grant.claimPlacement}: +${raceBonus.bonusPoints} XP!`;
      }
    }
    if (extraFlatXp > 0) {
      validationMessage += ` ⚡ Hard Mode Victory: +${extraFlatXp} XP!`;
    }

    awardedPoints = grant.awardedPoints;
    drawingEntriesAwarded = grant.drawingEntriesAwarded;
    grantedCol = grant.grantedCollectible;
    threeLocksFragmentAwardedResult = grant.threeLocksFragmentAwarded;
    threeLocksOwnedResult = grant.threeLocksOwned;
    cipherFragmentsAwarded = grant.cipherFragmentsAwarded;
    cipherDistrictsUnlocked = grant.cipherDistrictsUnlocked;
    readyToDecodeDistricts = grant.readyToDecodeDistricts;
    isFirstCipherFragment = grant.isFirstCipherFragment;
    newSubmission.awardedPoints = awardedPoints;
    newSubmission.drawingEntriesAwarded = drawingEntriesAwarded;
    setStoredItem(STORAGE_KEYS.SUBMISSIONS, updatedSubmissions);

    if (grant.newAchievements.length > 0) {
      newAchievements = grant.newAchievements;
    }

    const newLeaderboard = getLeaderboardForEvent(params.eventId);
    newRank = newLeaderboard.find((e) => e.playerId === params.playerId)?.rank;

    incrementCrowdObjective(params.eventId, 1);

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
    threeLocksFragmentAwarded: threeLocksFragmentAwardedResult,
    threeLocksOwned: threeLocksOwnedResult,
    cipherFragmentsAwarded,
    cipherDistrictsUnlocked,
    readyToDecodeDistricts,
    isFirstCipherFragment,
    flags: reviewFlags,
    oldRank,
    newRank,
    newAchievements,
  };
}

/* =========================================================================
   FAIR $300 MYSTERY MONEY HUNT — local/offline engine mirror
   -------------------------------------------------------------------------
   Deliberately NOT built on submitQuestProof/awardCollectible/the score
   ledger above — this is a fully separate claims/prizes mechanism with its
   own storage keys, so nothing here can affect Founder's Cipher or any
   other Mission's XP/scoring logic, and nothing in that shared code path
   can affect this. Mirrors lib/supabase-db.ts's claimFairMysterySignalDB /
   getFairMysteryBoardDB / getFairMysteryWinnersDB for the local/offline
   (Supabase-not-configured) engine that the Fair test suite runs against.
   ========================================================================= */

export function getFairMysteryPrizeMap(): Map<string, number> {
  const prizes = getStoredItem<Array<{ questId: string; cashCents: number }>>(STORAGE_KEYS.FAIR_MYSTERY_PRIZES, []);
  return new Map(prizes.map((p) => [p.questId, p.cashCents]));
}

interface LocalFairMysteryClaim {
  questId: string;
  playerId: string;
  claimedAt: string;
}

export function getFairMysteryClaims(): LocalFairMysteryClaim[] {
  return getStoredItem<LocalFairMysteryClaim[]>(STORAGE_KEYS.FAIR_MYSTERY_CLAIMS, []);
}

/** Admin-scoped: every claim for the given quest IDs, regardless of quest status — mirrors the unfiltered `fair_signal_claims .in('quest_id', questIds)` read the real Supabase-backed admin route performs. */
export function getFairMysteryClaimsForQuests(questIds: string[]): LocalFairMysteryClaim[] {
  const idSet = new Set(questIds);
  return getFairMysteryClaims().filter((c) => idSet.has(c.questId));
}

/**
 * Single-threaded, so "atomic" here simply means: read the claims list,
 * and if no row exists for this quest_id yet, append one before returning
 * — no other request can interleave between the check and the write in
 * this synchronous, in-memory engine. The real concurrency guarantee (for
 * actual simultaneous network requests) is the Postgres PRIMARY KEY on
 * fair_signal_claims.quest_id in the Supabase-backed path
 * (claimFairMysterySignalDB) — this local mirror exists for deterministic
 * offline testing, not to demonstrate database-level race safety itself.
 */
export function claimFairMysterySignal(playerId: string, questId: string): FairMysteryClaimResult {
  initializeGameEngine();
  const quest = getQuestById(questId);
  if (!quest || quest.category !== FAIR_CORE_CATEGORY) {
    return { outcome: 'not_recognized' };
  }
  if (quest.status !== 'active') {
    return { outcome: 'unavailable', message: 'This Signal is not currently active.' };
  }

  const nowMs = Date.now();
  if (quest.startsAt && new Date(quest.startsAt).getTime() > nowMs) {
    return { outcome: 'unavailable', message: 'The Fair QR Hunt is not open yet.' };
  }
  if (quest.expiresAt && new Date(quest.expiresAt).getTime() <= nowMs) {
    return { outcome: 'unavailable', message: 'The Fair QR Hunt has closed.' };
  }
  if (quest.eventId) {
    const event = getEvents().find((e) => e.id === quest.eventId);
    if (event) {
      if (event.isPaused) {
        return { outcome: 'unavailable', message: event.pauseReason || 'The Fair QR Hunt is temporarily paused.' };
      }
      if (event.startTime && new Date(event.startTime).getTime() > nowMs) {
        return { outcome: 'unavailable', message: 'The Fair QR Hunt is not open yet.' };
      }
      if (event.endTime && new Date(event.endTime).getTime() <= nowMs) {
        return { outcome: 'unavailable', message: 'The Fair QR Hunt has closed.' };
      }
    }
  }

  const prizeMap = getFairMysteryPrizeMap();
  const cashCents = prizeMap.get(questId);
  if (cashCents === undefined) {
    return { outcome: 'error', message: 'No prize is configured for this Signal.' };
  }

  const signalInfo = {
    questId: quest.id,
    slug: quest.slug,
    number: parseMysterySignalNumber(quest.slug) ?? 0,
    title: quest.title,
  };

  const claims = getFairMysteryClaims();
  const existing = claims.find((c) => c.questId === questId);
  if (existing) {
    const finder = getPlayerById(existing.playerId);
    return {
      outcome: 'already_claimed',
      signal: signalInfo,
      cashCents,
      winnerDisplayName: finder?.displayName || 'Another player',
    };
  }

  const newClaim: LocalFairMysteryClaim = { questId, playerId, claimedAt: new Date().toISOString() };
  setStoredItem(STORAGE_KEYS.FAIR_MYSTERY_CLAIMS, [...claims, newClaim]);

  const winner = getPlayerById(playerId);
  return {
    outcome: 'won',
    signal: signalInfo,
    cashCents,
    winnerDisplayName: winner?.displayName || 'You',
  };
}

export function getFairMysteryBoard(eventId: string): FairMysteryBoard {
  initializeGameEngine();
  const quests = getQuestsForEvent(eventId).filter((q) => q.category === FAIR_CORE_CATEGORY && q.status === 'active');
  const prizeMap = getFairMysteryPrizeMap();
  const claims = getFairMysteryClaims();
  const claimsByQuest = new Map(claims.map((c) => [c.questId, c]));

  const signals: FairMysterySignalPublic[] = quests
    .map((quest) => {
      const claim = claimsByQuest.get(quest.id);
      const base: FairMysterySignalPublic = {
        questId: quest.id,
        slug: quest.slug,
        number: parseMysterySignalNumber(quest.slug) ?? 0,
        title: quest.title,
        found: Boolean(claim),
      };
      if (claim) {
        const finder = getPlayerById(claim.playerId);
        base.finderDisplayName = finder?.displayName;
        base.finderAvatarUrl = finder?.avatarUrl;
        base.cashCents = prizeMap.get(quest.id);
        base.claimedAt = claim.claimedAt;
      }
      return base;
    })
    .sort((a, b) => a.number - b.number);

  const totals = computeMysteryBoardTotals(signals);

  return {
    signals,
    totalPoolCents: MYSTERY_TOTAL_POOL_CENTS,
    revealedCents: totals.revealedCents,
    hiddenCents: totals.hiddenCents,
    foundCount: totals.foundCount,
    totalCount: signals.length,
  };
}

export function getFairMysteryWinners(eventId: string): FairMysteryWinner[] {
  initializeGameEngine();
  const questIds = new Set(
    getQuestsForEvent(eventId)
      .filter((q) => q.category === FAIR_CORE_CATEGORY)
      .map((q) => q.id)
  );
  const prizeMap = getFairMysteryPrizeMap();
  const claims = getFairMysteryClaims().filter((c) => questIds.has(c.questId));

  const byPlayer = new Map<string, { signalsFound: number; totalCents: number }>();
  for (const claim of claims) {
    const cents = prizeMap.get(claim.questId) || 0;
    const entry = byPlayer.get(claim.playerId) || { signalsFound: 0, totalCents: 0 };
    entry.signalsFound += 1;
    entry.totalCents += cents;
    byPlayer.set(claim.playerId, entry);
  }

  const winners: FairMysteryWinner[] = Array.from(byPlayer.entries()).map(([playerId, stats]) => {
    const player = getPlayerById(playerId);
    return {
      playerId,
      displayName: player?.displayName || 'Unknown Player',
      avatarUrl: player?.avatarUrl,
      signalsFound: stats.signalsFound,
      totalCents: stats.totalCents,
    };
  });

  winners.sort((a, b) => b.totalCents - a.totalCents);
  return winners;
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
// Reward Grant Ledger — per-component audit trail + idempotency gate for the
// reusable QuestRewardConfig template (lib/quest-rewards.ts). One row per
// distinct reward a submission produces; the (submissionId, rewardType,
// rewardKey) triple is the uniqueness key, mirroring the Supabase
// reward_grants table's unique index.
// -----------------------------------------------------------------------------

/** Inserts a reward grant row, or returns null if this exact grant already exists (duplicate/retry). */
export function recordRewardGrant(entry: {
  eventId: string;
  playerId: string;
  questId?: string;
  submissionId?: string;
  rewardType: RewardGrantReason;
  rewardKey: string;
  xpAwarded?: number;
  drawingEntriesAwarded?: number;
}): RewardGrant | null {
  initializeGameEngine();
  const grants = getStoredItem<RewardGrant[]>(STORAGE_KEYS.REWARD_GRANTS, []);

  // Scoped by player+quest (not submission): the same specific reward must
  // never be granted twice to the same player for the same quest, even
  // across multiple submissions — this is what lets a remoteCapable quest's
  // later field/photo submission grant a genuinely new bonus component
  // without ever being able to re-grant a component already paid out.
  // A questless grant (e.g. a one-time account-level reward like profile
  // completion) has neither a quest nor a submission — dedupe those purely
  // by player+type+key so it can still only ever be granted once ever.
  const existing = entry.questId
    ? grants.find(
        (g) =>
          g.playerId === entry.playerId &&
          g.questId === entry.questId &&
          g.rewardType === entry.rewardType &&
          g.rewardKey === entry.rewardKey
      )
    : entry.submissionId
    ? grants.find(
        (g) =>
          g.submissionId === entry.submissionId &&
          g.rewardType === entry.rewardType &&
          g.rewardKey === entry.rewardKey
      )
    : grants.find(
        (g) =>
          !g.questId &&
          !g.submissionId &&
          g.playerId === entry.playerId &&
          g.rewardType === entry.rewardType &&
          g.rewardKey === entry.rewardKey
      );
  if (existing) return null;

  const newGrant: RewardGrant = {
    id: `rg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    eventId: entry.eventId,
    playerId: entry.playerId,
    questId: entry.questId,
    submissionId: entry.submissionId,
    rewardType: entry.rewardType,
    rewardKey: entry.rewardKey,
    xpAwarded: entry.xpAwarded || 0,
    drawingEntriesAwarded: entry.drawingEntriesAwarded || 0,
    createdAt: new Date().toISOString(),
  };
  setStoredItem(STORAGE_KEYS.REWARD_GRANTS, [...grants, newGrant]);
  return newGrant;
}

const THREE_LOCKS_COLLECTIBLE_IDS = ['col-founder-mark', 'col-founder-code', 'col-founder-word'];
const LOCAL_CIPHER_FRAGMENT_DISTRICT: Record<string, 'arts' | 'challenge' | 'secret'> = {
  'arts-founder-signal': 'arts',
  'arts-painted-witness': 'arts',
  'arts-palace-lantern': 'arts',
  'challenge-brass-key': 'challenge',
  'challenge-helmet-emblem': 'challenge',
  'challenge-neon-loop': 'challenge',
  'secret-stone-stair': 'secret',
  'secret-quiet-signal': 'secret',
  'secret-silent-court': 'secret',
};
const LOCAL_CIPHER_REQUIRED_BY_DISTRICT: Record<'arts' | 'challenge' | 'secret', string[]> = {
  arts: ['arts-founder-signal', 'arts-painted-witness', 'arts-palace-lantern'],
  challenge: ['challenge-brass-key', 'challenge-helmet-emblem', 'challenge-neon-loop'],
  secret: ['secret-stone-stair', 'secret-quiet-signal', 'secret-silent-court'],
};

interface LocalCipherFragmentGrant {
  eventId: string;
  playerId: string;
  questId: string;
  submissionId: string;
  fragmentKey: string;
  districtKey: 'arts' | 'challenge' | 'secret';
  grantedAt: string;
}

export function getLocalCipherFragmentGrants(playerId: string, eventId: string): LocalCipherFragmentGrant[] {
  return getStoredItem<LocalCipherFragmentGrant[]>(STORAGE_KEYS.CIPHER_FRAGMENT_GRANTS, []).filter(
    (grant) => grant.playerId === playerId && grant.eventId === eventId
  );
}

export interface LocalDistrictCipherProgress {
  eventId: string;
  playerId: string;
  districtKey: 'arts' | 'challenge' | 'secret';
  status: 'locked' | 'in_progress' | 'ready_to_decode' | 'token_unlocked';
  tokenUnlockedAt?: string;
}

export function getLocalDistrictCipherProgress(
  playerId: string,
  eventId: string,
  districtKey: 'arts' | 'challenge' | 'secret'
): LocalDistrictCipherProgress | undefined {
  return getStoredItem<LocalDistrictCipherProgress[]>(STORAGE_KEYS.CIPHER_DISTRICT_PROGRESS, []).find(
    (p) => p.playerId === playerId && p.eventId === eventId && p.districtKey === districtKey
  );
}

export function isLocalCipherDistrictTokenUnlocked(
  playerId: string,
  eventId: string,
  districtKey: 'arts' | 'challenge' | 'secret'
): boolean {
  const p = getLocalDistrictCipherProgress(playerId, eventId, districtKey);
  return p?.status === 'token_unlocked';
}

export function isLocalCipherDistrictReadyToDecode(
  playerId: string,
  eventId: string,
  districtKey: 'arts' | 'challenge' | 'secret'
): boolean {
  if (isLocalCipherDistrictTokenUnlocked(playerId, eventId, districtKey)) return false;
  const owned = new Set(getLocalCipherFragmentGrants(playerId, eventId).map((grant) => grant.fragmentKey));
  const required = LOCAL_CIPHER_REQUIRED_BY_DISTRICT[districtKey];
  return required.length > 0 && required.every((fragmentKey) => owned.has(fragmentKey));
}

export function decodeLocalCipherDistrict(params: {
  eventId: string;
  playerId: string;
  districtKey: 'arts' | 'challenge' | 'secret';
  sequence: string[];
}): {
  success: boolean;
  correct?: boolean;
  status?: 'token_unlocked';
  tokenLabel?: string;
  sigilSymbol?: string;
  decodedSentence?: string;
  unlockedSigilCount?: number;
  allSigilsUnlocked?: boolean;
  hasAllThreeLocks?: boolean;
  masterCipherAvailable?: boolean;
  error?: string;
  alreadyUnlocked?: boolean;
} {
  const district = FOUNDER_CIPHER_DISTRICTS.find((d) => d.key === params.districtKey);
  if (!district) return { success: false, error: 'Unknown district' };

  if (isLocalCipherDistrictTokenUnlocked(params.playerId, params.eventId, params.districtKey)) {
    const unlockedSigilCount = (['arts', 'challenge', 'secret'] as const).filter((k) =>
      isLocalCipherDistrictTokenUnlocked(params.playerId, params.eventId, k)
    ).length;
    const locks = getPlayerThreeLocks(params.playerId, params.eventId);
    const allSigilsUnlocked = unlockedSigilCount >= 3;
    const masterCipherAvailable = allSigilsUnlocked && locks.hasAll;

    return {
      success: true,
      correct: true,
      alreadyUnlocked: true,
      status: 'token_unlocked',
      tokenLabel: district.tokenLabel,
      sigilSymbol: district.sigilSymbol,
      decodedSentence: district.canonicalSentence,
      unlockedSigilCount,
      allSigilsUnlocked,
      hasAllThreeLocks: locks.hasAll,
      masterCipherAvailable,
    };
  }

  const owned = new Set(getLocalCipherFragmentGrants(params.playerId, params.eventId).map((grant) => grant.fragmentKey));
  const required = LOCAL_CIPHER_REQUIRED_BY_DISTRICT[params.districtKey];
  const hasAll = required.every((k) => owned.has(k));
  if (!hasAll) {
    return { success: false, error: 'District fragments are incomplete.' };
  }

  const isCorrect = verifyDistrictDecodeSequence(params.districtKey, params.sequence);
  if (!isCorrect) {
    return { success: false, correct: false, error: 'Incorrect fragment sequence. Rearrange the phrases and try again.' };
  }

  const progressList = getStoredItem<LocalDistrictCipherProgress[]>(STORAGE_KEYS.CIPHER_DISTRICT_PROGRESS, []);
  const nextProgress = progressList.filter(
    (p) => !(p.eventId === params.eventId && p.playerId === params.playerId && p.districtKey === params.districtKey)
  );
  nextProgress.push({
    eventId: params.eventId,
    playerId: params.playerId,
    districtKey: params.districtKey,
    status: 'token_unlocked',
    tokenUnlockedAt: new Date().toISOString(),
  });
  setStoredItem(STORAGE_KEYS.CIPHER_DISTRICT_PROGRESS, nextProgress);

  const unlockedSigilCount = (['arts', 'challenge', 'secret'] as const).filter((k) =>
    isLocalCipherDistrictTokenUnlocked(params.playerId, params.eventId, k)
  ).length;
  const locks = getPlayerThreeLocks(params.playerId, params.eventId);
  const allSigilsUnlocked = unlockedSigilCount >= 3;
  const masterCipherAvailable = allSigilsUnlocked && locks.hasAll;

  return {
    success: true,
    correct: true,
    status: 'token_unlocked',
    tokenLabel: district.tokenLabel,
    sigilSymbol: district.sigilSymbol,
    decodedSentence: district.canonicalSentence,
    unlockedSigilCount,
    allSigilsUnlocked,
    hasAllThreeLocks: locks.hasAll,
    masterCipherAvailable,
  };
}

function grantLocalCipherFragments(params: {
  eventId: string;
  playerId: string;
  questId: string;
  submissionId: string;
  fragmentKeys: string[];
}): {
  newlyGrantedFragmentKeys: string[];
  unlockedDistricts: Array<'arts' | 'challenge' | 'secret'>;
  readyToDecodeDistricts: Array<'arts' | 'challenge' | 'secret'>;
  isFirstCipherFragment: boolean;
} {
  const existing = getStoredItem<LocalCipherFragmentGrant[]>(STORAGE_KEYS.CIPHER_FRAGMENT_GRANTS, []);
  const priorPlayerGrants = existing.filter(
    (grant) => grant.eventId === params.eventId && grant.playerId === params.playerId
  );
  const isFirstCipherFragment = priorPlayerGrants.length === 0;

  const next = [...existing];
  const newlyGrantedFragmentKeys: string[] = [];
  const touchedDistricts = new Set<'arts' | 'challenge' | 'secret'>();

  for (const fragmentKey of [...new Set(params.fragmentKeys)]) {
    const districtKey = LOCAL_CIPHER_FRAGMENT_DISTRICT[fragmentKey];
    if (!districtKey) continue;
    touchedDistricts.add(districtKey);
    const alreadyGranted = existing.some(
      (grant) => grant.eventId === params.eventId && grant.playerId === params.playerId && grant.fragmentKey === fragmentKey
    );
    if (alreadyGranted) continue;
    next.push({
      eventId: params.eventId,
      playerId: params.playerId,
      questId: params.questId,
      submissionId: params.submissionId,
      fragmentKey,
      districtKey,
      grantedAt: new Date().toISOString(),
    });
    newlyGrantedFragmentKeys.push(fragmentKey);
  }

  setStoredItem(STORAGE_KEYS.CIPHER_FRAGMENT_GRANTS, next);

  const owned = new Set(next.filter((grant) => grant.eventId === params.eventId && grant.playerId === params.playerId).map((grant) => grant.fragmentKey));
  const progressList = getStoredItem<LocalDistrictCipherProgress[]>(STORAGE_KEYS.CIPHER_DISTRICT_PROGRESS, []);
  const nextProgress = [...progressList];
  const readyToDecodeDistricts: Array<'arts' | 'challenge' | 'secret'> = [];

  for (const districtKey of touchedDistricts) {
    const isComplete = LOCAL_CIPHER_REQUIRED_BY_DISTRICT[districtKey].every((k) => owned.has(k));
    const existingIndex = nextProgress.findIndex((p) => p.eventId === params.eventId && p.playerId === params.playerId && p.districtKey === districtKey);
    const existingStatus = existingIndex >= 0 ? nextProgress[existingIndex].status : 'locked';

    if (existingStatus !== 'token_unlocked') {
      const nextStatus = isComplete ? 'ready_to_decode' : 'in_progress';
      if (existingIndex >= 0) {
        nextProgress[existingIndex].status = nextStatus;
      } else {
        nextProgress.push({
          eventId: params.eventId,
          playerId: params.playerId,
          districtKey,
          status: nextStatus,
        });
      }
      if (isComplete && existingStatus !== 'ready_to_decode') {
        readyToDecodeDistricts.push(districtKey);
      }
    }
  }
  setStoredItem(STORAGE_KEYS.CIPHER_DISTRICT_PROGRESS, nextProgress);

  return {
    newlyGrantedFragmentKeys,
    unlockedDistricts: [],
    readyToDecodeDistricts,
    isFirstCipherFragment: isFirstCipherFragment && newlyGrantedFragmentKeys.length > 0,
  };
}

/**
 * The single reward-granting transaction for a verified/approved quest
 * completion — used by both the automated path (submitQuestProof) and the
 * GM manual-review path (reviewSubmission) so every reward type is applied
 * exactly once, from exactly one place, regardless of which path verified
 * the submission. Every reward component (QUEST_BASE, each bonus, race
 * tier, badge, collectible, ...) is individually gated by player+quest in
 * recordRewardGrant, so calling this again for the same quest — whether a
 * retried submission or a remoteCapable quest's later field/photo
 * submission — only ever grants what genuinely hasn't been granted yet.
 */
function applyQuestRewardGrants(
  quest: Quest,
  submissionId: string,
  eventId: string,
  playerId: string,
  method: ProofVerificationType,
  options: {
    usedNfc?: boolean;
    /** Applied only to the base XP portion, matching prior bonus-window behavior. */
    bonusMultiplier?: number;
    /** Additive flat XP outside the reward template (e.g. hard-mode opt-in victory bonus). */
    extraFlatXp?: number;
    /**
     * The claim ordinal for this completion, if the caller already computed
     * one (submitQuestProof always tracks this for claim_limit/"claimed_out"
     * state, independent of whether the quest defines race bonus tiers).
     * Fed into the race-bonus tier lookup; not computed here.
     */
    claimPlacement?: number;
    scoreDescription?: string;
  } = {}
): {
  awardedPoints: number;
  drawingEntriesAwarded: number;
  claimPlacement?: number;
  grantedCollectible?: Collectible;
  threeLocksFragmentAwarded?: 'mark' | 'code' | 'word';
  threeLocksOwned?: { mark: boolean; code: boolean; word: boolean };
  cipherFragmentsAwarded?: string[];
  cipherDistrictsUnlocked?: Array<'arts' | 'challenge' | 'secret'>;
  readyToDecodeDistricts?: Array<'arts' | 'challenge' | 'secret'>;
  isFirstCipherFragment?: boolean;
  newAchievements: Array<{
    id: string;
    title: string;
    description: string;
    icon?: string;
  }>;
} {
  const multiplier = options.bonusMultiplier ?? 1;
  const rawBaseXp = getEffectiveBaseXp(quest);
  const multipliedBaseXp = Math.round(rawBaseXp * multiplier);

  // QUEST_BASE is granted at most once per player+quest, ever — regardless
  // of how many submissions this quest receives. A remoteCapable quest's
  // later field/photo submission will find this already granted and simply
  // skip re-awarding it, while still evaluating this call's bonuses below.
  const baseGrant = recordRewardGrant({
    eventId,
    playerId,
    questId: quest.id,
    submissionId,
    rewardType: 'QUEST_BASE',
    rewardKey: quest.id,
    xpAwarded: multipliedBaseXp,
  });
  const isNewBase = Boolean(baseGrant);

  // Race placement/hard-mode bonus only ever apply to the completion itself,
  // never to a later supplemental bonus-only submission.
  const claimPlacement = isNewBase ? options.claimPlacement : undefined;
  const extraFlatXp = isNewBase ? options.extraFlatXp || 0 : 0;

  const bonuses = computeAwardedBonusesForSubmission(quest, { method, racePlacement: claimPlacement, usedNfc: options.usedNfc });

  const BONUS_REASON: Record<string, RewardGrantReason> = {
    fieldCheckIn: 'QUEST_FIELD_CHECKIN',
    nfc: 'QUEST_NFC',
    photoVideo: 'QUEST_PHOTO_VIDEO',
  };
  let newBonusXp = 0;
  for (const item of bonuses.lineItems) {
    const granted = recordRewardGrant({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      rewardType: BONUS_REASON[item.key],
      rewardKey: quest.id,
      xpAwarded: item.xp,
    });
    if (granted) newBonusXp += item.xp;
  }

  let newRaceBonusXp = 0;
  if (claimPlacement && bonuses.raceBonusXp > 0) {
    const granted = recordRewardGrant({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      rewardType: 'QUEST_RACE_BONUS',
      rewardKey: `${quest.id}:${claimPlacement}`,
      xpAwarded: bonuses.raceBonusXp,
    });
    if (granted) newRaceBonusXp = bonuses.raceBonusXp;
  }

  const totalXp = (isNewBase ? multipliedBaseXp : 0) + newBonusXp + newRaceBonusXp + extraFlatXp;

  if (totalXp > 0) {
    recordScoreLedger({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      points: totalXp,
      category: isNewBase ? quest.category : 'quest_bonus',
      description: options.scoreDescription || `Completed ${quest.title}`,
    });
  }

  // Entry Tokens (drawing entries): the base completion entry is due
  // exactly once (on the base grant), and each configured bonus source
  // (a quest-level drawingEntryBonus, or an NFC-cache-specific
  // nfcCacheEntryBonus when this submission actually used NFC) is its own
  // independently-gated grant — so a supplemental field/photo/NFC
  // submission never re-claims the base entry, and using NFC on one call
  // doesn't block a differently-sourced bonus from landing on another.
  // XP-only bonuses (field check-in, photo/video, race) never produce an
  // entry — computeAwardedBonusesForSubmission already enforces that.
  let newEntriesThisCall = 0;
  if (isNewBase) {
    newEntriesThisCall += bonuses.baseDrawingEntries;
  }
  if (bonuses.drawingEntryBonusAmount > 0) {
    const granted = recordRewardGrant({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      rewardType: 'QUEST_DRAWING_ENTRY_BONUS',
      rewardKey: quest.id,
      drawingEntriesAwarded: bonuses.drawingEntryBonusAmount,
    });
    if (granted) newEntriesThisCall += bonuses.drawingEntryBonusAmount;
  }
  if (bonuses.nfcCacheEntryBonusAmount > 0) {
    const granted = recordRewardGrant({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      rewardType: 'QUEST_DRAWING_ENTRY_BONUS',
      rewardKey: `${quest.id}:nfc_cache`,
      drawingEntriesAwarded: bonuses.nfcCacheEntryBonusAmount,
    });
    if (granted) newEntriesThisCall += bonuses.nfcCacheEntryBonusAmount;
  }

  let drawingEntriesAwarded = 0;
  if (newEntriesThisCall > 0 && !isDrawingLedgerLocked(eventId)) {
    incrementQuestDrawingEntries({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      addEntries: newEntriesThisCall,
      sourceType: 'quest_completion',
      reason: `Completed quest: ${quest.title}`,
    });
    drawingEntriesAwarded = newEntriesThisCall;
  }

  const unlocks = getUnlockSummary(quest);
  for (const slug of unlocks.badgeSlugs) {
    const granted = recordRewardGrant({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      rewardType: 'BADGE_UNLOCK',
      rewardKey: slug,
    });
    if (granted) awardAchievement(playerId, slug, eventId, `Quest reward: ${quest.title}`);
  }

  let grantedCollectible: Collectible | undefined;
  let threeLocksFragmentAwarded: 'mark' | 'code' | 'word' | undefined;
  let threeLocksOwned: { mark: boolean; code: boolean; word: boolean } | undefined;
  for (const collectibleId of unlocks.collectibleIds) {
    const granted = recordRewardGrant({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      rewardType: 'COLLECTIBLE_UNLOCK',
      rewardKey: collectibleId,
    });
    if (granted) {
      const col = awardCollectible(playerId, collectibleId, `Quest reward: ${quest.title}`, eventId);
      if (col && !grantedCollectible) grantedCollectible = col;
    }
  }

  if (unlocks.threeLocksFragment) {
    const { lock, collectibleId } = unlocks.threeLocksFragment;
    const granted = recordRewardGrant({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      rewardType: 'THREE_LOCKS_FRAGMENT',
      rewardKey: collectibleId,
    });
    if (granted) {
      const col = awardCollectible(playerId, collectibleId, `Founder's Lock: ${lock.toUpperCase()}`, eventId);
      if (col && !grantedCollectible) grantedCollectible = col;
      threeLocksFragmentAwarded = lock;
    }

    const locks = getPlayerThreeLocks(playerId, eventId);
    threeLocksOwned = {
      mark: locks.mark,
      code: locks.code,
      word: locks.word,
    };
    if (locks.hasAll) {
      recordRewardGrant({
        eventId,
        playerId,
        questId: quest.id,
        submissionId,
        rewardType: 'FINALE_PROGRESS',
        rewardKey: 'three_locks_complete',
      });
    }
  }

  for (const secretQuestId of unlocks.secretQuestIds) {
    recordRewardGrant({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      rewardType: 'SECRET_UNLOCK',
      rewardKey: secretQuestId,
    });
  }

  let cipherFragmentsAwarded: string[] = [];
  let cipherDistrictsUnlocked: Array<'arts' | 'challenge' | 'secret'> = [];
  let readyToDecodeDistricts: Array<'arts' | 'challenge' | 'secret'> = [];
  let isFirstCipherFragment: boolean = false;
  if (unlocks.cipherFragmentKeys.length > 0) {
    const cipherGrant = grantLocalCipherFragments({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      fragmentKeys: unlocks.cipherFragmentKeys,
    });
    cipherFragmentsAwarded = cipherGrant.newlyGrantedFragmentKeys;
    cipherDistrictsUnlocked = cipherGrant.unlockedDistricts;
    readyToDecodeDistricts = cipherGrant.readyToDecodeDistricts;
    isFirstCipherFragment = cipherGrant.isFirstCipherFragment;
  }

  if (unlocks.countsTowardFinale) {
    recordRewardGrant({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      rewardType: 'FINALE_PROGRESS',
      rewardKey: quest.id,
    });
  }

  const newlyAwarded = evaluatePlayerAchievements(playerId, eventId);
  const newAchievements = (newlyAwarded || []).map((ach) => ({
    id: ach.achievementId || ach.id,
    title: ach.achievement?.name || ach.achievementSlug || 'Achievement Unlocked',
    description: ach.achievement?.description || '',
    icon: ach.achievement?.badgeSymbol || '🏆',
  }));

  return {
    awardedPoints: totalXp,
    drawingEntriesAwarded,
    claimPlacement,
    grantedCollectible,
    threeLocksFragmentAwarded,
    threeLocksOwned,
    cipherFragmentsAwarded,
    cipherDistrictsUnlocked,
    readyToDecodeDistricts,
    isFirstCipherFragment,
    newAchievements,
  };
}

/**
 * Handles a follow-up field/photo submission against a quest that's already
 * been completed remotely, when the quest opts in via `remoteCapable`. Never
 * re-verifies or re-awards the base completion (applyQuestRewardGrants's
 * per-player-per-quest gating already guarantees that) — this only grants
 * whatever field bonus the new proof type newly qualifies for.
 */
function submitSupplementalFieldProof(
  params: SubmitProofParams,
  quest: Quest,
  existingSub: QuestSubmission
): SubmitProofResult {
  const isFieldCheckIn = params.proofType === 'checkin' || params.proofType === 'gps';
  const isPhotoVideo = params.proofType === 'photo' || params.proofType === 'video';

  if (isFieldCheckIn) {
    const locationResult = validateLocationProof(params, quest);
    if (!locationResult.ok) {
      return {
        success: false,
        submission: locationResult.submission,
        message: locationResult.message,
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
      };
    }

    const newSubmission: QuestSubmission = {
      id: `sub-${Date.now()}`,
      questId: params.questId,
      playerId: params.playerId,
      eventId: params.eventId,
      proofType: params.proofType,
      status: 'verified',
      awardedPoints: 0,
      drawingEntriesAwarded: 0,
      submittedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      userLat: params.userLat,
      userLon: params.userLon,
      distanceFromLocation: locationResult.distanceMeters,
    };
    const grant = applyQuestRewardGrants(quest, newSubmission.id, params.eventId, params.playerId, params.proofType, {
      usedNfc: params.usedNfc,
    });
    newSubmission.awardedPoints = grant.awardedPoints;
    newSubmission.drawingEntriesAwarded = grant.drawingEntriesAwarded;
    setStoredItem(STORAGE_KEYS.SUBMISSIONS, [...getAllSubmissions(), newSubmission]);

    return {
      success: true,
      submission: newSubmission,
      message:
        grant.awardedPoints > 0
          ? `Field bonus confirmed! +${grant.awardedPoints} XP.`
          : 'Field visit logged — no new field bonus configured for this quest.',
      awardedPoints: grant.awardedPoints,
      drawingEntriesAwarded: grant.drawingEntriesAwarded,
      newAchievements: grant.newAchievements,
      threeLocksFragmentAwarded: grant.threeLocksFragmentAwarded,
      threeLocksOwned: grant.threeLocksOwned,
    };
  }

  if (isPhotoVideo) {
    if (!params.proofUrl && !params.submittedContent) {
      return {
        success: false,
        submission: buildRejectedSubmission(params, 'Proof details are required before Game Master review.'),
        message: 'Proof details are required before Game Master review.',
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
      };
    }

    const newSubmission: QuestSubmission = {
      id: `sub-${Date.now()}`,
      questId: params.questId,
      playerId: params.playerId,
      eventId: params.eventId,
      proofType: params.proofType,
      submittedContent: params.submittedContent,
      proofUrl: params.proofUrl,
      status: 'pending',
      awardedPoints: 0,
      drawingEntriesAwarded: 0,
      submittedAt: new Date().toISOString(),
    };
    const allSubs = getAllSubmissions();
    setStoredItem(STORAGE_KEYS.SUBMISSIONS, [...allSubs, newSubmission]);

    return {
      success: true,
      submission: newSubmission,
      message: 'Field photo submitted for Game Master review.',
      awardedPoints: 0,
      drawingEntriesAwarded: 0,
    };
  }

  return {
    success: false,
    submission: existingSub,
    message: 'Unsupported field bonus submission type for this quest.',
    awardedPoints: 0,
    drawingEntriesAwarded: 0,
  };
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

export function awardDrawingEntries(entryData: {
  eventId: string;
  playerId: string;
  entriesCount: number;
  questId?: string;
  submissionId?: string;
  sourceType?: string;
  reason?: string;
}): DrawingEntryLedgerEntry {
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
    sourceType: entryData.sourceType || 'quest_completion',
    reason: entryData.reason || 'Quest completion drawing reward',
    id: `dw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  setStoredItem(STORAGE_KEYS.DRAWING_LEDGER, [...ledger, newEntry]);
  return newEntry;
}

/**
 * Adds `addEntries` new Entry Tokens to this player+quest's single ledger
 * row (creating it if absent), returning the row's new total. Used by
 * applyQuestRewardGrants, where `addEntries` is always an amount that
 * reward_grants has just confirmed is genuinely new — so this is always a
 * true increment, never a recompute-and-possibly-shrink.
 */
function incrementQuestDrawingEntries(entryData: {
  eventId: string;
  playerId: string;
  questId: string;
  submissionId?: string;
  addEntries: number;
  sourceType?: string;
  reason?: string;
}): DrawingEntryLedgerEntry {
  initializeGameEngine();
  if (isDrawingLedgerLocked(entryData.eventId)) {
    throw new Error(`Drawing ledger for event ${entryData.eventId} is locked. New drawing entries cannot be awarded.`);
  }

  const ledger = getStoredItem<DrawingEntryLedgerEntry[]>(STORAGE_KEYS.DRAWING_LEDGER, []);
  const existingIndex = ledger.findIndex(
    (e) => e.eventId === entryData.eventId && e.playerId === entryData.playerId && e.questId === entryData.questId
  );

  if (existingIndex !== -1) {
    const updated: DrawingEntryLedgerEntry = {
      ...ledger[existingIndex],
      entriesCount: ledger[existingIndex].entriesCount + entryData.addEntries,
      submissionId: entryData.submissionId ?? ledger[existingIndex].submissionId,
      reason: entryData.reason || ledger[existingIndex].reason,
    };
    ledger[existingIndex] = updated;
    setStoredItem(STORAGE_KEYS.DRAWING_LEDGER, ledger);
    return updated;
  }

  const newEntry: DrawingEntryLedgerEntry = {
    eventId: entryData.eventId,
    playerId: entryData.playerId,
    questId: entryData.questId,
    submissionId: entryData.submissionId,
    entriesCount: entryData.addEntries,
    sourceType: entryData.sourceType || 'quest_completion',
    reason: entryData.reason || 'Quest completion drawing reward',
    id: `dw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  setStoredItem(STORAGE_KEYS.DRAWING_LEDGER, [...ledger, newEntry]);
  return newEntry;
}

export function getDrawingEntriesForEvent(eventId: string): DrawingEntryLedgerEntry[] {
  initializeGameEngine();
  const events = getEvents();
  const event = events.find((e) => e.id === eventId || e.slug === eventId);
  const realEventId = event ? event.id : eventId;
  const ledger = getStoredItem<DrawingEntryLedgerEntry[]>(STORAGE_KEYS.DRAWING_LEDGER, []);
  return ledger.filter((e) => e.eventId === eventId || e.eventId === realEventId);
}

export function getDrawingEntriesForPlayer(playerId: string, eventId?: string): DrawingEntryLedgerEntry[] {
  initializeGameEngine();
  const ledger = getStoredItem<DrawingEntryLedgerEntry[]>(STORAGE_KEYS.DRAWING_LEDGER, []);
  if (!eventId) return ledger.filter((e) => e.playerId === playerId);
  const events = getEvents();
  const event = events.find((e) => e.id === eventId || e.slug === eventId);
  const realEventId = event ? event.id : eventId;
  return ledger.filter((e) => e.playerId === playerId && (e.eventId === eventId || e.eventId === realEventId));
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

export const PERMANENT_CANTON_QUESTS_NUMBER = '311420151417215192019';
export const PERMANENT_CANTON_QUESTS_BIGINT = 311420151417215192019n;

export function assignTicketsToSnapshot(snapshot: CanonicalSnapshot): {
  ticketRanges: FinalQuestTicketRange[];
  totalTickets: number;
} {
  let currentTicket = 1;
  const ticketRanges: FinalQuestTicketRange[] = [];

  for (const player of snapshot.players) {
    if (player.entries <= 0) continue;
    const startTicket = currentTicket;
    const endTicket = currentTicket + player.entries - 1;
    ticketRanges.push({
      publicPlayerLabel: player.publicPlayerLabel,
      publicParticipantId: player.publicParticipantId || '',
      startTicket,
      endTicket,
      ticketCount: player.entries,
    });
    currentTicket = endTicket + 1;
  }

  const totalTickets = currentTicket - 1;
  return { ticketRanges, totalTickets };
}

export function getFrozenEventMetrics(eventId: string, snapshot: CanonicalSnapshot): FinalQuestEventMetrics {
  initializeGameEngine();
  const submissions = getStoredItem<QuestSubmission[]>(STORAGE_KEYS.SUBMISSIONS, []);
  const eventSubmissions = submissions.filter((s) => s.eventId === eventId && s.status === 'verified');

  const totalCompletedQuests = eventSubmissions.length;
  const totalValidEntries = snapshot.players.reduce((sum, p) => sum + p.entries, 0);
  const totalPlayers = snapshot.players.length;

  const playerCompletionMap = new Map<string, number>();
  eventSubmissions.forEach((s) => {
    playerCompletionMap.set(s.playerId, (playerCompletionMap.get(s.playerId) || 0) + 1);
  });
  const totalFinishers = Array.from(playerCompletionMap.values()).filter((cnt) => cnt >= 3).length;

  return {
    totalPlayers,
    totalValidEntries,
    totalCompletedQuests,
    totalFinishers,
  };
}

export function computeFinalQuestNumber(metrics: FinalQuestEventMetrics): {
  finalQuestNumber: string;
  productFormula: string;
  rawProduct: bigint;
} {
  const mPlayers = BigInt(Math.max(1, metrics.totalPlayers));
  const mEntries = BigInt(Math.max(1, metrics.totalValidEntries));
  const mCompleted = BigInt(Math.max(1, metrics.totalCompletedQuests));
  const mFinishers = BigInt(Math.max(1, metrics.totalFinishers));

  const rawProduct = mPlayers * mEntries * mCompleted * mFinishers;
  const finalBigInt = rawProduct * PERMANENT_CANTON_QUESTS_BIGINT;
  const finalQuestNumber = finalBigInt.toString();
  const productFormula = `${mPlayers} × ${mEntries} × ${mCompleted} × ${mFinishers} × ${PERMANENT_CANTON_QUESTS_NUMBER} = ${finalQuestNumber}`;

  return { finalQuestNumber, productFormula, rawProduct };
}

export function followTheTrail(
  finalQuestNumberStr: string,
  totalTickets: number,
  ticketRanges: FinalQuestTicketRange[],
  excludedPlayerIds?: string[],
  playerMap?: Record<string, { label: string; isMinor?: boolean }>,
  eventId?: string
): {
  winningTicket: number;
  winningRange: FinalQuestTicketRange;
  trailSteps: FinalQuestTrailStep[];
  resolutionMethod: 'forward_trail' | 'reverse_trail' | 'deterministic_modulo_fallback';
} {
  if (totalTickets <= 0 || ticketRanges.length === 0) {
    throw new Error('Cannot follow the trail with 0 tickets or empty ticket ranges.');
  }

  const width = String(totalTickets).length;
  const allTrailSteps: FinalQuestTrailStep[] = [];

  function isPlayerExcluded(range: FinalQuestTicketRange): boolean {
    if (!excludedPlayerIds || excludedPlayerIds.length === 0) return false;
    if (!playerMap) return false;
    const internalId = Object.entries(playerMap).find(([id, pInfo]) => {
      const participantId = eventId ? getPublicParticipantId(id, eventId) : '';
      if (range.publicParticipantId && participantId === range.publicParticipantId) return true;
      return pInfo.label === range.publicPlayerLabel;
    })?.[0];
    return !!(internalId && excludedPlayerIds.includes(internalId));
  }

  function scanDigits(digits: string, phasePrefix: string): {
    found: boolean;
    winningTicket?: number;
    winningRange?: FinalQuestTicketRange;
  } {
    for (let i = 0; i <= digits.length - width; i++) {
      const windowString = digits.slice(i, i + width);
      const parsed = parseInt(windowString, 10);
      const stepIndex = allTrailSteps.length + 1;

      if (parsed === 0) {
        allTrailSteps.push({
          stepIndex,
          windowString,
          parsedTicketNumber: parsed,
          isValid: false,
          reason: `${phasePrefix} Window "${windowString}" is zero (invalid ticket)`,
        });
        continue;
      }

      if (parsed > totalTickets) {
        allTrailSteps.push({
          stepIndex,
          windowString,
          parsedTicketNumber: parsed,
          isValid: false,
          reason: `${phasePrefix} Window "${windowString}" (#${parsed}) exceeds total valid tickets (${totalTickets})`,
        });
        continue;
      }

      const matchingRange = ticketRanges.find(
        (r) => parsed >= r.startTicket && parsed <= r.endTicket
      );

      if (!matchingRange) {
        allTrailSteps.push({
          stepIndex,
          windowString,
          parsedTicketNumber: parsed,
          isValid: false,
          reason: `${phasePrefix} Ticket #${parsed} does not match any assigned ticket range`,
        });
        continue;
      }

      if (isPlayerExcluded(matchingRange)) {
        allTrailSteps.push({
          stepIndex,
          windowString,
          parsedTicketNumber: parsed,
          isValid: false,
          reason: `${phasePrefix} Ticket #${parsed} belongs to ${matchingRange.publicPlayerLabel}, who already won a primary prize`,
        });
        continue;
      }

      allTrailSteps.push({
        stepIndex,
        windowString,
        parsedTicketNumber: parsed,
        isValid: true,
        reason: `${phasePrefix} WINNER FOUND! Ticket #${parsed} held by ${matchingRange.publicPlayerLabel} (Range #${matchingRange.startTicket}–#${matchingRange.endTicket})`,
      });

      return {
        found: true,
        winningTicket: parsed,
        winningRange: matchingRange,
      };
    }

    return { found: false };
  }

  // 1. Forward scan
  const forwardResult = scanDigits(finalQuestNumberStr, '[Forward]');
  if (forwardResult.found && forwardResult.winningTicket && forwardResult.winningRange) {
    return {
      winningTicket: forwardResult.winningTicket,
      winningRange: forwardResult.winningRange,
      trailSteps: allTrailSteps,
      resolutionMethod: 'forward_trail',
    };
  }

  // 2. Reverse fallback scan
  const reversedStr = finalQuestNumberStr.split('').reverse().join('');
  const reverseResult = scanDigits(reversedStr, '[Reverse Fallback]');
  if (reverseResult.found && reverseResult.winningTicket && reverseResult.winningRange) {
    return {
      winningTicket: reverseResult.winningTicket,
      winningRange: reverseResult.winningRange,
      trailSteps: allTrailSteps,
      resolutionMethod: 'reverse_trail',
    };
  }

  // 3. Deterministic Modulo Fallback
  let fallbackTicket = Number(BigInt(finalQuestNumberStr) % BigInt(totalTickets)) + 1;
  let matchingRange = ticketRanges.find(
    (r) => fallbackTicket >= r.startTicket && fallbackTicket <= r.endTicket
  );

  // If excluded, step through modulo space to find eligible ticket
  if (matchingRange && isPlayerExcluded(matchingRange)) {
    for (let offset = 1; offset < totalTickets; offset++) {
      const candidateTicket = ((fallbackTicket - 1 + offset) % totalTickets) + 1;
      const candidateRange = ticketRanges.find(
        (r) => candidateTicket >= r.startTicket && candidateTicket <= r.endTicket
      );
      if (candidateRange && !isPlayerExcluded(candidateRange)) {
        fallbackTicket = candidateTicket;
        matchingRange = candidateRange;
        break;
      }
    }
  }

  if (!matchingRange) {
    matchingRange = ticketRanges[0];
    fallbackTicket = matchingRange.startTicket;
  }

  allTrailSteps.push({
    stepIndex: allTrailSteps.length + 1,
    windowString: 'MODULO',
    parsedTicketNumber: fallbackTicket,
    isValid: true,
    reason: `[Deterministic Modulo Fallback] (FinalQuestNumber % ${totalTickets}) + 1 = Ticket #${fallbackTicket} (${matchingRange.publicPlayerLabel})`,
  });

  return {
    winningTicket: fallbackTicket,
    winningRange: matchingRange,
    trailSteps: allTrailSteps,
    resolutionMethod: 'deterministic_modulo_fallback',
  };
}

export const FinalQuestDrawProvider: DrawProvider = {
  id: 'final_quest',
  name: 'The Final Quest Human-Readable Draw Provider',
  isIndependent: false,
  async executeDraw(params) {
    if (!params.snapshot || !params.snapshot.players || params.snapshot.players.length === 0) {
      throw new Error('Drawing pool has 0 qualified players.');
    }

    const { ticketRanges, totalTickets } = assignTicketsToSnapshot(params.snapshot);
    if (totalTickets <= 0) {
      throw new Error('Drawing pool has 0 qualified entries.');
    }

    const metrics: FinalQuestEventMetrics =
      params.auditMetadata?.eventMetrics || getFrozenEventMetrics(params.eventId, params.snapshot);
    const { finalQuestNumber, productFormula } = computeFinalQuestNumber(metrics);

    const trailResult = followTheTrail(
      finalQuestNumber,
      totalTickets,
      ticketRanges,
      params.excludedPlayerIds,
      params.playerMap,
      params.eventId
    );

    const winningRange = trailResult.winningRange;
    const winningPlayerId =
      Object.entries(params.playerMap).find(([id, pInfo]: [string, { label: string; isMinor?: boolean }]) => {
        const participantId = getPublicParticipantId(id, params.eventId);
        if (winningRange.publicParticipantId && participantId === winningRange.publicParticipantId) return true;
        return pInfo.label === winningRange.publicPlayerLabel;
      })?.[0] ||
      `plr-anon-${winningRange.publicPlayerLabel.replace(/\s+/g, '-').toLowerCase()}`;

    const selectedWeightedEntryIndex = trailResult.winningTicket - 1;

    const receipt: FinalQuestDrawReceipt = {
      eventId: params.eventId,
      eventTitle: params.prizeTitle || 'Event Drawing',
      totalTickets,
      ticketWidth: String(totalTickets).length,
      eventMetrics: metrics,
      permanentNumber: PERMANENT_CANTON_QUESTS_NUMBER,
      productFormula,
      finalQuestNumber,
      trailSteps: trailResult.trailSteps,
      winningTicket: trailResult.winningTicket,
      winningPublicPlayerLabel: winningRange.publicPlayerLabel,
      winningPublicParticipantId: winningRange.publicParticipantId || '',
      winningPlayerTicketRange: { start: winningRange.startTicket, end: winningRange.endTicket },
      allTicketRanges: ticketRanges,
      resolutionMethod: trailResult.resolutionMethod,
      lockedLedgerHash: params.snapshotHash,
      drawnAt: new Date().toISOString(),
    };

    return {
      winningPlayerId,
      winningPublicPlayerLabel: winningRange.publicPlayerLabel,
      selectedWeightedEntryIndex,
      drawMethod: 'final_quest',
      providerReference: `FINAL_QUEST_TICKET:#${trailResult.winningTicket}`,
      auditMetadata: {
        isIndependent: false,
        isSystemVerified: true,
        verificationStatus: 'final_quest_trail',
        drawMethod: 'final_quest',
        providerReference: `FINAL_QUEST_TICKET:#${trailResult.winningTicket}`,
        disclaimer: 'DETERMINISTIC HUMAN-READABLE TRAIL DRAWING (FIXED PUBLIC METHOD)',
        lockedLedgerHash: params.snapshotHash,
        winningTicket: trailResult.winningTicket,
        resolutionMethod: trailResult.resolutionMethod,
        finalQuestReceipt: receipt,
      },
    };
  },
};

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

  const drawMethod: DrawMethod = params.drawMethod || (params.testSeed ? 'internal_test' : 'final_quest');
  let provider: DrawProvider = FinalQuestDrawProvider;
  if (drawMethod === 'internal_test') {
    provider = InternalTestDrawProvider;
  } else if (drawMethod === 'manual_external') {
    provider = ManualExternalDrawProvider;
  } else if (drawMethod === 'random_org') {
    provider = RandomOrgFutureDrawProvider;
  } else {
    provider = FinalQuestDrawProvider;
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
    verificationStatus:
      d.auditMetadata?.verificationStatus ||
      (d.drawMethod === 'manual_external'
        ? 'manual_unverified'
        : d.drawMethod === 'final_quest'
        ? 'final_quest_trail'
        : 'internal_seeded'),
    isSystemVerified: d.auditMetadata?.isSystemVerified ?? (d.drawMethod === 'final_quest' || d.drawMethod === 'internal_test'),
    isIndependent: d.auditMetadata?.isIndependent ?? false,
    finalQuestReceipt: d.auditMetadata?.finalQuestReceipt,
  }));

  const submissions = getStoredItem<QuestSubmission[]>(STORAGE_KEYS.SUBMISSIONS, []);
  const totalCompletedQuests = submissions.filter((s) => s.eventId === realEventId && s.status === 'verified').length;

  const ledgerLockStatus: DrawingStatus = lock ? lock.status : 'open';
  const firstPublished = publishedDraws[0];

  const ticketRanges =
    lock && lock.canonicalSnapshot ? assignTicketsToSnapshot(lock.canonicalSnapshot).ticketRanges : undefined;

  return {
    eventId: realEventId,
    eventTitle,
    ledgerLockStatus,
    ledgerLockTimestamp: lock && lock.isLocked ? lock.lockedAt || null : null,
    snapshotHash: lock && lock.snapshotHash ? lock.snapshotHash : null,
    canonicalSnapshot: lock && lock.canonicalSnapshot ? lock.canonicalSnapshot : null,
    totalQualifiedEntries: projection.totalEntriesAcrossAllPlayers,
    totalQualifiedPlayers: projection.playerEntries.length,
    totalCompletedQuests,
    publicPlayerEntries: projection.playerEntries,
    publishedPrizes,
    publishedAt: firstPublished ? firstPublished.publishedAt || null : null,
    verificationInfo: lock && lock.snapshotHash
      ? `This drawing entry pool was finalized and cryptographically hashed (SHA-256: ${lock.snapshotHash}) on ${lock.lockedAt}. The winner selection is tied directly to the frozen canonical snapshot.`
      : undefined,
    ticketRanges,
  };
}

export function getAuthenticatedPlayerDrawingQualification(
  playerId: string,
  eventId: string
): AuthenticatedPlayerDrawingQualification | null {
  initializeGameEngine();
  const player = getPlayerById(playerId);
  if (!player) return null;

  const events = getEvents();
  const event = events.find((e) => e.id === eventId || e.slug === eventId);
  const realEventId = event ? event.id : eventId;

  const entries = getDrawingEntriesForPlayer(playerId, realEventId);
  const totalEntries = entries.reduce((sum, e) => sum + (e.entriesCount || 0), 0);

  const playerLabel = getPublicPlayerLabel(player, playerId);
  const participantId = getPublicParticipantId(playerId, realEventId);

  const locks = getStoredItem<EventDrawingLedgerLock[]>(STORAGE_KEYS.DRAWING_LOCKS, []);
  const lock = locks.find((l) => l.eventId === realEventId);

  let ticketRange: string | null = null;
  if (lock && lock.canonicalSnapshot) {
    const { ticketRanges } = assignTicketsToSnapshot(lock.canonicalSnapshot);
    const range = ticketRanges.find(
      (r) => r.publicParticipantId === participantId
    );
    if (range) {
      ticketRange = `Tickets #${range.startTicket} - #${range.endTicket}`;
    }
  }

  if (!ticketRange && totalEntries > 0) {
    ticketRange = `${totalEntries} Verified Ticket${totalEntries === 1 ? '' : 's'}`;
  }

  return {
    playerId: player.id,
    playerLabel,
    qualifiedEntries: totalEntries,
    ticketRange: totalEntries > 0 ? ticketRange : 'No verified quest completions yet',
    isQualified: totalEntries > 0,
  };
}

export function getPublicQuestView(quest: Quest): PublicQuestView {
  const { targetCode, gmNotes, acceptedAnswerVariants, placementDetails, placedAt, ...safeQuest } = quest;
  if (safeQuest.steps) {
    safeQuest.steps = safeQuest.steps.map(({ targetCode: _targetCode, acceptedAnswerVariants: _variants, ...stepRest }) => stepRest);
  }
  return safeQuest;
}

export function getLeaderboardForEvent(eventId: string): LeaderboardEntry[] {
  initializeGameEngine();
  const ledger = getStoredItem<ScoreLedgerEntry[]>(STORAGE_KEYS.SCORE_LEDGER, []);
  const players = getAllPlayers();

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

    return {
      rank: 0,
      playerId,
      displayName: playerObj.displayName,
      avatarUrl: playerObj.avatarUrl || '⚡',
      totalPoints: Math.max(0, stats.totalPoints),
      questsCompletedCount: stats.completedQuestIds.size,
      lastScoreTime: stats.lastScoreTime,
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

    if (!quest) {
      // Defensive fallback for an orphaned submission whose quest no longer exists.
      sub.awardedPoints = 100;
      sub.drawingEntriesAwarded = 1;
      recordScoreLedger({
        eventId: sub.eventId,
        playerId: sub.playerId,
        questId: sub.questId,
        submissionId: sub.id,
        points: sub.awardedPoints,
        category: 'admin_approved',
        description: 'Media submission approved for Quest',
      });
      awardDrawingEntries({
        eventId: sub.eventId,
        playerId: sub.playerId,
        questId: sub.questId,
        submissionId: sub.id,
        entriesCount: sub.drawingEntriesAwarded,
        sourceType: 'quest_completion',
        reason: 'Media submission approved for Quest',
      });
      setStoredItem(STORAGE_KEYS.SUBMISSIONS, submissions);
      return sub;
    }

    const grant = applyQuestRewardGrants(quest, sub.id, sub.eventId, sub.playerId, sub.proofType, {
      scoreDescription: `Media submission approved for ${quest.title}`,
    });

    sub.awardedPoints = grant.awardedPoints;
    sub.drawingEntriesAwarded = grant.drawingEntriesAwarded;

    setStoredItem(STORAGE_KEYS.SUBMISSIONS, submissions);
    return sub;
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
// Day 1 Leader Bonus & Three-Path District Operations
// -----------------------------------------------------------------------------

export function awardDay1XpLeaderBonus(
  eventId: string,
  isRehearsal: boolean = false
): {
  success: boolean;
  winnerPlayerId?: string;
  winningPlayerName?: string;
  topXp?: number;
  entriesAwarded: number;
  isDuplicatePrevented?: boolean;
  tieBroken?: boolean;
  message: string;
} {
  initializeGameEngine();
  const event = getEvents().find((e) => e.id === eventId);
  if (!event) {
    return { success: false, entriesAwarded: 0, message: `Event ${eventId} not found.` };
  }

  if (event.status === 'draft' || (event as any).status === 'cancelled') {
    return { success: false, entriesAwarded: 0, message: 'Cancelled or draft events cannot award Day 1 bonuses.' };
  }

  // Check if already awarded for this event
  const drawingLedger = getStoredItem<DrawingEntryLedgerEntry[]>(STORAGE_KEYS.DRAWING_LEDGER, []);
  const existingBonus = drawingLedger.find(
    (e) => e.eventId === eventId && e.sourceType === 'DAY_1_XP_LEADER_BONUS'
  );

  if (existingBonus) {
    const winner = getAllPlayers().find((p) => p.id === existingBonus.playerId);
    return {
      success: true,
      winnerPlayerId: existingBonus.playerId,
      winningPlayerName: winner?.displayName || 'Day 1 Champion',
      entriesAwarded: existingBonus.entriesCount,
      isDuplicatePrevented: true,
      message: 'Day 1 #1 XP Leader Bonus has already been awarded and recorded in the transparent ledger.',
    };
  }

  // Get authoritative leaderboard for this event
  const leaderboard = getLeaderboardForEvent(eventId);
  if (leaderboard.length === 0 || leaderboard[0].totalPoints <= 0) {
    return {
      success: false,
      entriesAwarded: 0,
      message: 'No qualifying player scores recorded for Day 1.',
    };
  }

  const topScore = leaderboard[0].totalPoints;
  const tiedLeaders = leaderboard.filter((entry) => entry.totalPoints === topScore);

  // Deterministic tie-breaker:
  // 1. If only 1 leader, they win.
  // 2. If multiple leaders are tied at the top score, the player who reached that score earliest (earliest lastScoreTime) wins.
  let winnerEntry = tiedLeaders[0];
  let tieBroken = false;
  if (tiedLeaders.length > 1) {
    tieBroken = true;
    winnerEntry = tiedLeaders.reduce((prev, curr) => {
      const prevTime = prev.lastScoreTime ? new Date(prev.lastScoreTime).getTime() : Infinity;
      const currTime = curr.lastScoreTime ? new Date(curr.lastScoreTime).getTime() : Infinity;
      return currTime < prevTime ? curr : prev;
    });
  }

  const winnerPlayer = getAllPlayers().find((p) => p.id === winnerEntry.playerId);
  if (!winnerPlayer) {
    return { success: false, entriesAwarded: 0, message: 'Winner player record not found.' };
  }

  if (isRehearsal) {
    return {
      success: true,
      winnerPlayerId: winnerEntry.playerId,
      winningPlayerName: winnerEntry.displayName,
      topXp: topScore,
      entriesAwarded: 5,
      tieBroken,
      message: `[REHEARSAL] Day 1 Bonus would be awarded to ${winnerEntry.displayName} (+5 Drawing Entries). Production data untouched.`,
    };
  }

  // Award +5 drawing entries to the verified Day 1 leader
  awardDrawingEntries({
    eventId,
    playerId: winnerEntry.playerId,
    entriesCount: 5,
    sourceType: 'DAY_1_XP_LEADER_BONUS',
    reason: `Day 1 Finalized #1 XP Leader Bonus (${topScore} XP${tieBroken ? ' - Earliest Tiebreaker' : ''})`,
  });

  // Award Day 1 City Conqueror achievement
  awardAchievement(
    winnerEntry.playerId,
    'day-one-king',
    eventId,
    `Finished Day 1 ranked #1 in XP with ${topScore} points`
  );

  logActivity({
    type: 'phase_change',
    actorName: 'Game Master',
    title: `Day 1 XP Champion Finalized: ${winnerEntry.displayName}`,
    details: `${winnerEntry.displayName} finished Day 1 at #1 with ${topScore} XP (+5 Prize Entries awarded)`,
  });

  return {
    success: true,
    winnerPlayerId: winnerEntry.playerId,
    winningPlayerName: winnerEntry.displayName,
    topXp: topScore,
    entriesAwarded: 5,
    tieBroken,
    message: `Awarded +5 prize entries and 'Day 1 City Conqueror' achievement to ${winnerEntry.displayName}.`,
  };
}

export function getDistrictContentSummary(eventId: string, district: StartingPath): DistrictContentSummary {
  initializeGameEngine();
  const quests = getQuestsForEvent(eventId).filter((q) => q.startingPath === district);
  const activeQuests = quests.filter((q) => q.status === 'active');
  const totalAvailableXp = activeQuests.reduce((sum, q) => sum + (q.xpReward || q.pointValue), 0);

  const questTypes: Record<string, number> = {};
  let gpsQuestsCount = 0;
  let qrQuestsCount = 0;
  let photoQuestsCount = 0;
  let puzzleQuestsCount = 0;
  let brokenQuestsCount = 0;

  for (const q of quests) {
    questTypes[q.verificationType] = (questTypes[q.verificationType] || 0) + 1;
    if (q.verificationType === 'gps' || q.verificationType === 'checkin' || q.requireLocationVerification) {
      gpsQuestsCount++;
    }
    if (q.verificationType === 'qr' || q.requireQrAndLocation) {
      qrQuestsCount++;
    }
    if (q.verificationType === 'photo' || q.verificationType === 'video') {
      photoQuestsCount++;
    }
    if (q.verificationType === 'passphrase' || q.category === 'puzzle' || q.category === 'secret') {
      puzzleQuestsCount++;
    }
    if (q.status !== 'active') {
      brokenQuestsCount++;
    }
  }

  const contentGaps: string[] = [];
  if (district === 'challenge') {
    if (activeQuests.length < 5) {
      contentGaps.push(
        'Challenge district needs planned 9th Street Skate Park and Mother Gooseland area scavenger drop quests configured.'
      );
    }
  } else if (district === 'secret') {
    if (activeQuests.length < 5) {
      contentGaps.push(
        'Secret district needs final West Lawn Cemetery daylight verification and additional cipher drop nodes.'
      );
    }
  } else if (district === 'family') {
    if (activeQuests.length < 3) {
      contentGaps.push('Family district has low mission count.');
    }
  }

  const metaMap: Record<StartingPath, { name: string; approximateArea: string; flavor: string }> = {
    family: {
      name: 'Arts District',
      approximateArea: 'Downtown Arts District & Centennial Plaza',
      flavor: 'Explore. Create. Discover. All-ages, murals, local coffee, landmarks.',
    },
    challenge: {
      name: 'Mother Goose Land',
      approximateArea: 'Mother Goose Land, 9th St Skate Park & Athletic Corridors',
      flavor: 'Move. Compete. Prove Yourself. Physical speed, skill, high XP.',
    },
    secret: {
      name: 'Monument Park',
      approximateArea: 'Monument Park, McKinley Monument & West Lawn Corridor',
      flavor: 'Decode. Investigate. Uncover Canton. Cryptic ciphers, historical mysteries.',
    },
  };

  return {
    district,
    name: metaMap[district].name,
    approximateArea: metaMap[district].approximateArea,
    flavor: metaMap[district].flavor,
    activeQuestsCount: activeQuests.length,
    totalAvailableXp,
    questTypes,
    gpsQuestsCount,
    qrQuestsCount,
    photoQuestsCount,
    puzzleQuestsCount,
    brokenQuestsCount,
    contentGaps,
  };
}

export function getAllDistrictsContentSummary(eventId: string): Record<StartingPath, DistrictContentSummary> {
  return {
    family: getDistrictContentSummary(eventId, 'family'),
    challenge: getDistrictContentSummary(eventId, 'challenge'),
    secret: getDistrictContentSummary(eventId, 'secret'),
  };
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
  activateAudienceEvent,
  closeAudienceVoting,
  executeAudienceEffect,
  cancelAudienceEvent,
  runAudienceVoteSimulation,
  processAudienceLifecycleCron,
  logTimelineAction,
  getLiveEventTimeline,
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

// -----------------------------------------------------------------------------
// Event Readiness & Rehearsal Re-exports (Phase 5.4)
// -----------------------------------------------------------------------------
export {
  auditEventQRQuests,
  auditEventQuestsAndLocations,
  evaluateEventLaunchGates,
  computeEventReadinessReport,
  getOperatorChecklist,
  updateOperatorChecklistItem,
  runWalkUpPlayerRehearsal,
  runFullEventRehearsal,
  executeEventClosure,
  resetRehearsalStore,
} from './event-readiness';
