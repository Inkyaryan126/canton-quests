// Canton Quests — Core Game Engine & Persistence Layer

import {
  Player,
  QuestEvent,
  Quest,
  QuestSubmission,
  ScoreLedgerEntry,
  LeaderboardEntry,
  PlayerEventProgress,
  ProofVerificationType,
} from './types';
import { SEED_CITY, SEED_LOCATIONS, SEED_EVENT, SEED_QUESTS, SEED_DEMO_PLAYERS } from './seed-data';

const STORAGE_KEYS = {
  CURRENT_PLAYER: 'canton_quests_current_player',
  PLAYERS: 'canton_quests_players',
  EVENTS: 'canton_quests_events',
  QUESTS: 'canton_quests_quests',
  SUBMISSIONS: 'canton_quests_submissions',
  SCORE_LEDGER: 'canton_quests_score_ledger',
};

const inMemoryStore = new Map<string, any>();

// Helper for local storage access with SSR/Node fallback
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
  if (getStoredItem<Player[]>(STORAGE_KEYS.PLAYERS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.PLAYERS, SEED_DEMO_PLAYERS);
  }
  if (getStoredItem<QuestSubmission[]>(STORAGE_KEYS.SUBMISSIONS, []).length === 0) {
    // Initial demo verified submission for demo leaderboard score
    const demoSubmissions: QuestSubmission[] = [
      {
        id: 'sub-demo-1',
        questId: SEED_QUESTS[0].id,
        playerId: SEED_DEMO_PLAYERS[0].id,
        eventId: SEED_EVENT.id,
        proofType: 'checkin',
        submittedContent: 'Check-in confirmed',
        status: 'verified',
        awardedPoints: 50,
        submittedAt: '2026-08-07T19:00:00Z',
        reviewedAt: '2026-08-07T19:00:00Z',
      },
      {
        id: 'sub-demo-2',
        questId: SEED_QUESTS[1].id,
        playerId: SEED_DEMO_PLAYERS[0].id,
        eventId: SEED_EVENT.id,
        proofType: 'passphrase',
        submittedContent: '1897',
        status: 'verified',
        awardedPoints: 150,
        submittedAt: '2026-08-07T19:30:00Z',
        reviewedAt: '2026-08-07T19:30:00Z',
      },
      {
        id: 'sub-demo-3',
        questId: SEED_QUESTS[9].id,
        playerId: SEED_DEMO_PLAYERS[0].id,
        eventId: SEED_EVENT.id,
        proofType: 'passphrase',
        submittedContent: 'CYPHER-77',
        status: 'verified',
        awardedPoints: 650,
        submittedAt: '2026-08-07T20:00:00Z',
        reviewedAt: '2026-08-07T20:00:00Z',
      },
      {
        id: 'sub-demo-4',
        questId: SEED_QUESTS[0].id,
        playerId: SEED_DEMO_PLAYERS[1].id,
        eventId: SEED_EVENT.id,
        proofType: 'checkin',
        submittedContent: 'Check-in confirmed',
        status: 'verified',
        awardedPoints: 50,
        submittedAt: '2026-08-07T19:15:00Z',
        reviewedAt: '2026-08-07T19:15:00Z',
      },
      {
        id: 'sub-demo-5',
        questId: SEED_QUESTS[8].id,
        playerId: SEED_DEMO_PLAYERS[1].id,
        eventId: SEED_EVENT.id,
        proofType: 'qr',
        submittedContent: 'HOF-CANTON-LEGEND',
        status: 'verified',
        awardedPoints: 400,
        submittedAt: '2026-08-07T19:45:00Z',
        reviewedAt: '2026-08-07T19:45:00Z',
      },
      {
        id: 'sub-demo-6',
        questId: SEED_QUESTS[1].id,
        playerId: SEED_DEMO_PLAYERS[1].id,
        eventId: SEED_EVENT.id,
        proofType: 'passphrase',
        submittedContent: '1897',
        status: 'verified',
        awardedPoints: 150,
        submittedAt: '2026-08-07T20:15:00Z',
        reviewedAt: '2026-08-07T20:15:00Z',
      },
      {
        id: 'sub-demo-7',
        questId: SEED_QUESTS[4].id,
        playerId: SEED_DEMO_PLAYERS[2].id,
        eventId: SEED_EVENT.id,
        proofType: 'video',
        submittedContent: 'Video proof link',
        proofUrl: 'https://example.com/video1.mp4',
        status: 'pending',
        awardedPoints: 0,
        submittedAt: '2026-08-08T10:00:00Z',
      },
    ];
    setStoredItem(STORAGE_KEYS.SUBMISSIONS, demoSubmissions);
  }

  if (getStoredItem<ScoreLedgerEntry[]>(STORAGE_KEYS.SCORE_LEDGER, []).length === 0) {
    const demoLedger: ScoreLedgerEntry[] = [
      {
        id: 'sc-1',
        eventId: SEED_EVENT.id,
        playerId: SEED_DEMO_PLAYERS[0].id,
        questId: SEED_QUESTS[0].id,
        submissionId: 'sub-demo-1',
        points: 50,
        category: 'quest_completion',
        description: 'Completed Centennial Beacon Check-In',
        awardedAt: '2026-08-07T19:00:00Z',
      },
      {
        id: 'sc-2',
        eventId: SEED_EVENT.id,
        playerId: SEED_DEMO_PLAYERS[0].id,
        questId: SEED_QUESTS[1].id,
        submissionId: 'sub-demo-2',
        points: 150,
        category: 'quest_completion',
        description: 'Completed The McKinley Monument Year',
        awardedAt: '2026-08-07T19:30:00Z',
      },
      {
        id: 'sc-3',
        eventId: SEED_EVENT.id,
        playerId: SEED_DEMO_PLAYERS[0].id,
        questId: SEED_QUESTS[9].id,
        submissionId: 'sub-demo-3',
        points: 650,
        category: 'quest_completion',
        description: 'Completed The 4th Street Cipher',
        awardedAt: '2026-08-07T20:00:00Z',
      },
      {
        id: 'sc-4',
        eventId: SEED_EVENT.id,
        playerId: SEED_DEMO_PLAYERS[1].id,
        questId: SEED_QUESTS[0].id,
        submissionId: 'sub-demo-4',
        points: 50,
        category: 'quest_completion',
        description: 'Completed Centennial Beacon Check-In',
        awardedAt: '2026-08-07T19:15:00Z',
      },
      {
        id: 'sc-5',
        eventId: SEED_EVENT.id,
        playerId: SEED_DEMO_PLAYERS[1].id,
        questId: SEED_QUESTS[8].id,
        submissionId: 'sub-demo-5',
        points: 400,
        category: 'quest_completion',
        description: 'Completed Hall of Fame Trail Emblem',
        awardedAt: '2026-08-07T19:45:00Z',
      },
      {
        id: 'sc-6',
        eventId: SEED_EVENT.id,
        playerId: SEED_DEMO_PLAYERS[1].id,
        questId: SEED_QUESTS[1].id,
        submissionId: 'sub-demo-6',
        points: 150,
        category: 'quest_completion',
        description: 'Completed The McKinley Monument Year',
        awardedAt: '2026-08-07T20:15:00Z',
      },
    ];
    setStoredItem(STORAGE_KEYS.SCORE_LEDGER, demoLedger);
  }
}

// PLAYER MANAGEMENT
export function getCurrentPlayer(): Player {
  initializeGameEngine();
  const player = getStoredItem<Player | null>(STORAGE_KEYS.CURRENT_PLAYER, null);
  if (player) return player;

  // Default active player if none selected
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
    id: `plr-${Date.now()}`,
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
  return newPlayer;
}

export function getAllPlayers(): Player[] {
  initializeGameEngine();
  return getStoredItem<Player[]>(STORAGE_KEYS.PLAYERS, SEED_DEMO_PLAYERS);
}

// EVENTS MANAGEMENT
export function getEvents(): QuestEvent[] {
  initializeGameEngine();
  return getStoredItem<QuestEvent[]>(STORAGE_KEYS.EVENTS, [SEED_EVENT]);
}

export function getEventBySlug(slug: string): QuestEvent | undefined {
  const events = getEvents();
  return events.find((e) => e.slug === slug);
}

export function createEvent(eventData: Omit<QuestEvent, 'id' | 'createdAt'>): QuestEvent {
  const events = getEvents();
  const newEvent: QuestEvent = {
    ...eventData,
    id: `evt-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  setStoredItem(STORAGE_KEYS.EVENTS, [...events, newEvent]);
  return newEvent;
}

export function updateEventStatus(eventId: string, status: QuestEvent['status']): QuestEvent | undefined {
  const events = getEvents();
  const event = events.find((e) => e.id === eventId);
  if (!event) return undefined;

  event.status = status;
  setStoredItem(STORAGE_KEYS.EVENTS, events);
  return event;
}

// QUESTS MANAGEMENT
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
    id: `qst-${Date.now()}`,
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

// SUBMISSION & PROOF ENGINE
export interface SubmitProofParams {
  playerId: string;
  questId: string;
  eventId: string;
  proofType: ProofVerificationType;
  submittedContent?: string;
  proofUrl?: string;
}

export interface SubmitProofResult {
  success: boolean;
  submission: QuestSubmission;
  message: string;
  awardedPoints: number;
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
  const quest = getQuestById(params.questId);
  if (!quest) {
    throw new Error('Quest not found');
  }

  const submissions = getStoredItem<QuestSubmission[]>(STORAGE_KEYS.SUBMISSIONS, []);

  // Check for duplicate submission by this player for this quest
  const existingSub = submissions.find(
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

  // Determine verification status
  let isAutoVerified = false;
  let validationMessage = '';

  if (quest.verificationType === 'checkin') {
    isAutoVerified = true;
    validationMessage = 'Check-in verified! Location signal confirmed.';
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
      setStoredItem(STORAGE_KEYS.SUBMISSIONS, [...submissions, failedSub]);
      return {
        success: false,
        submission: failedSub,
        message: 'Incorrect passcode frequency! Re-examine the location or plaque.',
        awardedPoints: 0,
      };
    }
  } else if (quest.verificationType === 'qr') {
    const input = (params.submittedContent || '').trim().toUpperCase();
    const target = (quest.targetCode || '').trim().toUpperCase();
    if (input === target) {
      isAutoVerified = true;
      validationMessage = 'QR Emblem Scanned! Quest completed.';
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
        feedback: 'Invalid QR token hash.',
        submittedAt: new Date().toISOString(),
      };
      setStoredItem(STORAGE_KEYS.SUBMISSIONS, [...submissions, failedSub]);
      return {
        success: false,
        submission: failedSub,
        message: 'Invalid QR Code token! Make sure you are scanning an official Canton Quests QR code.',
        awardedPoints: 0,
      };
    }
  } else if (quest.verificationType === 'photo' || quest.verificationType === 'video') {
    isAutoVerified = false;
    validationMessage = 'Media proof submitted! Routed to Game Master review queue.';
  }

  const newSubmission: QuestSubmission = {
    id: `sub-${Date.now()}`,
    questId: params.questId,
    playerId: params.playerId,
    eventId: params.eventId,
    proofType: params.proofType,
    submittedContent: params.submittedContent,
    proofUrl: params.proofUrl,
    status: isAutoVerified ? 'verified' : 'pending',
    awardedPoints: isAutoVerified ? quest.pointValue : 0,
    submittedAt: new Date().toISOString(),
    reviewedAt: isAutoVerified ? new Date().toISOString() : undefined,
  };

  const updatedSubmissions = [...submissions, newSubmission];
  setStoredItem(STORAGE_KEYS.SUBMISSIONS, updatedSubmissions);

  let awardedPoints = 0;
  if (isAutoVerified) {
    awardedPoints = quest.pointValue;
    recordScoreLedger({
      eventId: params.eventId,
      playerId: params.playerId,
      questId: params.questId,
      submissionId: newSubmission.id,
      points: quest.pointValue,
      category: quest.category,
      description: `Completed ${quest.title}`,
    });
  }

  return {
    success: true,
    submission: newSubmission,
    message: validationMessage,
    awardedPoints,
  };
}

// SCORE LEDGER & LEADERBOARD
export function recordScoreLedger(entryData: Omit<ScoreLedgerEntry, 'id' | 'awardedAt'>): ScoreLedgerEntry {
  initializeGameEngine();
  const ledger = getStoredItem<ScoreLedgerEntry[]>(STORAGE_KEYS.SCORE_LEDGER, []);
  const newEntry: ScoreLedgerEntry = {
    ...entryData,
    id: `sc-${Date.now()}`,
    awardedAt: new Date().toISOString(),
  };

  const updatedLedger = [...ledger, newEntry];
  setStoredItem(STORAGE_KEYS.SCORE_LEDGER, updatedLedger);

  // Update player total XP
  const players = getAllPlayers();
  const player = players.find((p) => p.id === entryData.playerId);
  if (player) {
    player.totalXp += entryData.points;
    player.level = Math.floor(player.totalXp / 250) + 1;
    setStoredItem(STORAGE_KEYS.PLAYERS, players);
  }

  return newEntry;
}

export function getLeaderboardForEvent(eventId: string): LeaderboardEntry[] {
  initializeGameEngine();
  const ledger = getStoredItem<ScoreLedgerEntry[]>(STORAGE_KEYS.SCORE_LEDGER, []);
  const submissions = getStoredItem<QuestSubmission[]>(STORAGE_KEYS.SUBMISSIONS, []);
  const players = getAllPlayers();

  const playerStats: Record<
    string,
    { totalPoints: number; completedQuestIds: Set<string>; lastScoreTime: string }
  > = {};

  // Group ledger entries by player
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

  // Ensure current active player appears on leaderboard even with 0 points
  const currentPlayer = getCurrentPlayer();
  if (!playerStats[currentPlayer.id]) {
    playerStats[currentPlayer.id] = {
      totalPoints: 0,
      completedQuestIds: new Set<string>(),
      lastScoreTime: new Date().toISOString(),
    };
  }

  // Convert to LeaderboardEntry array
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
      totalPoints: stats.totalPoints,
      questsCompletedCount: stats.completedQuestIds.size,
      lastScoreTime: stats.lastScoreTime,
    };
  });

  // Sort descending by points, then ascending by last score time
  leaderboard.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    return new Date(a.lastScoreTime || 0).getTime() - new Date(b.lastScoreTime || 0).getTime();
  });

  // Assign 1-indexed ranks
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
  };
}

// ADMIN REVIEW CONTROLS
export function reviewSubmission(
  submissionId: string,
  newStatus: 'verified' | 'rejected',
  feedback?: string
): QuestSubmission | undefined {
  initializeGameEngine();
  const submissions = getAllSubmissions();
  const sub = submissions.find((s) => s.id === submissionId);
  if (!sub) return undefined;

  sub.status = newStatus;
  sub.feedback = feedback;
  sub.reviewedAt = new Date().toISOString();

  if (newStatus === 'verified') {
    const quest = getQuestById(sub.questId);
    sub.awardedPoints = quest ? quest.pointValue : 100;
    recordScoreLedger({
      eventId: sub.eventId,
      playerId: sub.playerId,
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
