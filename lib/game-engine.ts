// Canton Quests — Core Game Engine & Persistence Layer (Phase 4 Event Factory)

import {
  Player,
  QuestEvent,
  Quest,
  QuestSubmission,
  ScoreLedgerEntry,
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

const STORAGE_KEYS = {
  CURRENT_PLAYER: 'canton_quests_current_player',
  PLAYERS: 'canton_quests_players',
  EVENTS: 'canton_quests_events',
  QUESTS: 'canton_quests_quests',
  SUBMISSIONS: 'canton_quests_submissions',
  SCORE_LEDGER: 'canton_quests_score_ledger',
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
  GENERATED_QRS: 'canton_quests_generated_qrs',
  LOCATIONS: 'canton_quests_locations',
};

const inMemoryStore = new Map<string, any>();

function getStoredItem<T>(key: string, fallback: T): T {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(`Error reading ${key} from localStorage`, e);
    }
  }
  return inMemoryStore.has(key) ? inMemoryStore.get(key) : fallback;
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
    setStoredItem(STORAGE_KEYS.QUESTS, SEED_QUESTS);
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
    setStoredItem(STORAGE_KEYS.SECRET_CODES, SEED_SECRET_CODES);
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
        targetCode: 'CANTON-EMBLEM-2026',
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
  const cleanCode = codeStr.trim().toUpperCase();

  const targetCode = codes.find((c) => c.eventId === eventId && c.code === cleanCode && c.isActive);
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
    description: `Redeemed Secret Code: ${targetCode.code}`,
  });

  let grantedCol: Collectible | undefined = undefined;
  if (targetCode.grantCollectibleId) {
    grantedCol = awardCollectible(playerId, targetCode.grantCollectibleId, `Secret Code: ${targetCode.code}`);
  }

  const player = getAllPlayers().find((p) => p.id === playerId);
  logActivity({
    type: 'code_redeemed',
    actorName: player?.displayName || 'Player',
    title: `Passcode Redeemed: ${targetCode.code}`,
    details: `+${targetCode.bonusPoints} XP awarded`,
  });

  return {
    success: true,
    message: `Passcode ${targetCode.code} Cracked! +${targetCode.bonusPoints} XP awarded!`,
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

  const existingSub = existingSubmissions.find(
    (s) => s.playerId === params.playerId && s.questId === params.questId
  );

  if (existingSub) {
    if (existingSub.status === 'verified') {
      return {
        success: false,
        submission: existingSub,
        message: 'Quest already completed! Points have already been awarded.',
        awardedPoints: 0,
      };
    }
    if (existingSub.status === 'pending') {
      return {
        success: false,
        submission: existingSub,
        message: 'Your proof submission for this quest is currently under review by a Game Master.',
        awardedPoints: 0,
      };
    }
  }

  let proximityChecked = false;
  let distanceFromLoc: number | undefined = undefined;

  if (
    (quest.requireLocationVerification || quest.requireQrAndLocation || quest.verificationType === 'checkin') &&
    quest.location &&
    quest.location.latitude &&
    quest.location.longitude
  ) {
    const requiredRadius = quest.radiusMeters || quest.location.radiusMeters || 100;

    if (params.userLat !== undefined && params.userLon !== undefined) {
      const prox = checkProximity(
        { latitude: params.userLat, longitude: params.userLon },
        quest.location.latitude,
        quest.location.longitude,
        requiredRadius
      );
      distanceFromLoc = prox.distanceMeters;
      proximityChecked = true;

      if (!prox.isWithinRadius) {
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
            userLat: params.userLat,
            userLon: params.userLon,
            distanceFromLocation: prox.distanceMeters,
          },
          message: prox.message,
          awardedPoints: 0,
          flags: reviewFlags,
        };
      }
    }
  }

  let isAutoVerified = false;
  let validationMessage = '';

  if (quest.verificationType === 'checkin') {
    isAutoVerified = true;
    validationMessage = proximityChecked
      ? `Check-in verified! Location signal confirmed (${distanceFromLoc}m from target).`
      : 'Check-in verified! Field beacon active.';
  } else if (quest.verificationType === 'passphrase') {
    const input = (params.submittedContent || '').trim().toUpperCase();
    const target = (quest.targetCode || '').trim().toUpperCase();
    if (input === target) {
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
        feedback: 'Incorrect passphrase code. Inspect the location closely.',
        submittedAt: new Date().toISOString(),
      };
      setStoredItem(STORAGE_KEYS.SUBMISSIONS, [...existingSubmissions, failedSub]);
      return {
        success: false,
        submission: failedSub,
        message: 'Incorrect passcode frequency! Re-examine the location or plaque.',
        awardedPoints: 0,
        flags: reviewFlags,
      };
    }
  } else if (quest.verificationType === 'qr') {
    const input = (params.submittedContent || '').trim().toUpperCase();
    const target = (quest.targetCode || '').trim().toUpperCase();
    if (input === target) {
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
        feedback: 'Invalid QR token code.',
        submittedAt: new Date().toISOString(),
      };
      setStoredItem(STORAGE_KEYS.SUBMISSIONS, [...existingSubmissions, failedSub]);
      return {
        success: false,
        submission: failedSub,
        message: 'Invalid QR Code token! Make sure you are scanning an official Canton Quests QR emblem.',
        awardedPoints: 0,
        flags: reviewFlags,
      };
    }
  } else if (quest.verificationType === 'photo' || quest.verificationType === 'video') {
    isAutoVerified = false;
    validationMessage = 'Media proof submitted! Routed to Game Master review queue.';
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

  const newSubmission: QuestSubmission = {
    id: `sub-${Date.now()}`,
    questId: params.questId,
    playerId: params.playerId,
    teamId,
    eventId: params.eventId,
    proofType: params.proofType,
    submittedContent: params.submittedContent,
    proofUrl: params.proofUrl,
    status: isAutoVerified ? 'verified' : 'pending',
    awardedPoints: isAutoVerified ? quest.pointValue : 0,
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
  let grantedCol: Collectible | undefined = undefined;

  if (isAutoVerified) {
    let basePoints = quest.pointValue;

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

    incrementCrowdObjective(params.eventId, 1);

    if (quest.id === 'qst-centennial-discovery') {
      grantedCol = awardCollectible(params.playerId, 'col-founder-token', 'Centennial Beacon Quest');
    }

    const player = getAllPlayers().find((p) => p.id === params.playerId);
    logActivity({
      type: 'quest_completed',
      actorName: player?.displayName || 'Player',
      title: `Quest Completed: ${quest.title}`,
      details: `+${awardedPoints} XP awarded`,
    });
  }

  return {
    success: true,
    submission: newSubmission,
    message: validationMessage,
    awardedPoints,
    claimPlacement,
    collectibleAwarded: grantedCol,
    flags: reviewFlags,
  };
}

export function recordScoreLedger(entryData: Omit<ScoreLedgerEntry, 'id' | 'awardedAt'>): ScoreLedgerEntry {
  initializeGameEngine();
  const ledger = getStoredItem<ScoreLedgerEntry[]>(STORAGE_KEYS.SCORE_LEDGER, []);
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
    sub.awardedPoints = quest ? quest.pointValue : 100;
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
