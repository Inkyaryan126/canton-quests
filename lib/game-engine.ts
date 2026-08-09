// Canton Quests — Core Game Engine & Persistence Layer (Phase 2 Real-World Game Engine)

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
} from './types';
import {
  SEED_CITY,
  SEED_LOCATIONS,
  SEED_EVENT,
  SEED_QUESTS,
  SEED_DEMO_PLAYERS,
  SEED_TEAMS,
  SEED_TEAM_MEMBERS,
} from './seed-data';
import { checkProximity, formatDistance } from './geo';

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

// Ensure default seed data is initialized
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
  if (getStoredItem<Team[]>(STORAGE_KEYS.TEAMS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.TEAMS, SEED_TEAMS);
  }
  if (getStoredItem<TeamMember[]>(STORAGE_KEYS.TEAM_MEMBERS, []).length === 0) {
    setStoredItem(STORAGE_KEYS.TEAM_MEMBERS, SEED_TEAM_MEMBERS);
  }
  if (getStoredItem<QuestSubmission[]>(STORAGE_KEYS.SUBMISSIONS, []).length === 0) {
    const demoSubmissions: QuestSubmission[] = [
      {
        id: 'sub-demo-1',
        questId: SEED_QUESTS[0].id,
        playerId: SEED_DEMO_PLAYERS[0].id,
        teamId: SEED_TEAMS[0].id,
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
        questId: SEED_QUESTS[3].id,
        playerId: SEED_DEMO_PLAYERS[0].id,
        teamId: SEED_TEAMS[0].id,
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
        questId: SEED_QUESTS[2].id,
        playerId: SEED_DEMO_PLAYERS[0].id,
        teamId: SEED_TEAMS[0].id,
        eventId: SEED_EVENT.id,
        proofType: 'passphrase',
        submittedContent: 'CYPHER-77',
        status: 'verified',
        awardedPoints: 750,
        submittedAt: '2026-08-07T20:00:00Z',
        reviewedAt: '2026-08-07T20:00:00Z',
      },
      {
        id: 'sub-demo-4',
        questId: SEED_QUESTS[0].id,
        playerId: SEED_DEMO_PLAYERS[1].id,
        teamId: SEED_TEAMS[1].id,
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
        questId: SEED_QUESTS[11].id,
        playerId: SEED_DEMO_PLAYERS[1].id,
        teamId: SEED_TEAMS[1].id,
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
        questId: SEED_QUESTS[3].id,
        playerId: SEED_DEMO_PLAYERS[1].id,
        teamId: SEED_TEAMS[1].id,
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
        questId: SEED_QUESTS[7].id,
        playerId: SEED_DEMO_PLAYERS[2].id,
        teamId: SEED_TEAMS[0].id,
        eventId: SEED_EVENT.id,
        proofType: 'photo',
        submittedContent: 'Photo proof link',
        proofUrl: 'https://example.com/photo1.jpg',
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
        teamId: SEED_TEAMS[0].id,
        questId: SEED_QUESTS[0].id,
        submissionId: 'sub-demo-1',
        points: 50,
        category: 'exploration',
        description: 'Completed Centennial Beacon Check-In',
        awardedAt: '2026-08-07T19:00:00Z',
      },
      {
        id: 'sc-2',
        eventId: SEED_EVENT.id,
        playerId: SEED_DEMO_PLAYERS[0].id,
        teamId: SEED_TEAMS[0].id,
        questId: SEED_QUESTS[3].id,
        submissionId: 'sub-demo-2',
        points: 150,
        category: 'puzzle',
        description: 'Completed The McKinley Monument Year',
        awardedAt: '2026-08-07T19:30:00Z',
      },
      {
        id: 'sc-3',
        eventId: SEED_EVENT.id,
        playerId: SEED_DEMO_PLAYERS[0].id,
        teamId: SEED_TEAMS[0].id,
        questId: SEED_QUESTS[2].id,
        submissionId: 'sub-demo-3',
        points: 750,
        category: 'secret',
        description: 'Completed The 4th Street Master Cipher',
        awardedAt: '2026-08-07T20:00:00Z',
      },
      {
        id: 'sc-4',
        eventId: SEED_EVENT.id,
        playerId: SEED_DEMO_PLAYERS[1].id,
        teamId: SEED_TEAMS[1].id,
        questId: SEED_QUESTS[0].id,
        submissionId: 'sub-demo-4',
        points: 50,
        category: 'exploration',
        description: 'Completed Centennial Beacon Check-In',
        awardedAt: '2026-08-07T19:15:00Z',
      },
      {
        id: 'sc-5',
        eventId: SEED_EVENT.id,
        playerId: SEED_DEMO_PLAYERS[1].id,
        teamId: SEED_TEAMS[1].id,
        questId: SEED_QUESTS[11].id,
        submissionId: 'sub-demo-5',
        points: 400,
        category: 'trivia',
        description: 'Completed Hall of Fame Trail Emblem',
        awardedAt: '2026-08-07T19:45:00Z',
      },
      {
        id: 'sc-6',
        eventId: SEED_EVENT.id,
        playerId: SEED_DEMO_PLAYERS[1].id,
        teamId: SEED_TEAMS[1].id,
        questId: SEED_QUESTS[3].id,
        submissionId: 'sub-demo-6',
        points: 150,
        category: 'puzzle',
        description: 'Completed The McKinley Monument Year',
        awardedAt: '2026-08-07T20:15:00Z',
      },
    ];
    setStoredItem(STORAGE_KEYS.SCORE_LEDGER, demoLedger);
  }

  if (getStoredItem<EventActivityItem[]>(STORAGE_KEYS.ACTIVITY_LOG, []).length === 0) {
    const initialActivity: EventActivityItem[] = [
      {
        id: 'act-1',
        type: 'team_created',
        actorName: 'ApexHunter_330',
        title: 'Team Created: Canton Cipher Syndicate',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        details: 'Code: CQ-7X9K',
      },
      {
        id: 'act-2',
        type: 'flash_activated',
        actorName: 'Game Master',
        title: '⚡ Flash Quest Activated',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        details: 'Market Square Signal Surge (+250 XP)',
      },
      {
        id: 'act-3',
        type: 'quest_completed',
        actorName: 'ApexHunter_330',
        title: 'Quest Completed: Centennial Beacon',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        details: '+50 XP awarded',
      },
    ];
    setStoredItem(STORAGE_KEYS.ACTIVITY_LOG, initialActivity);
  }
}

// 1. QUEST UNLOCK & STATE CALCULATION ENGINE
export function calculateQuestState(
  quest: Quest,
  completedQuestIds: string[],
  pendingQuestIds: string[],
  nowMs: number = Date.now()
): QuestState {
  if (completedQuestIds.includes(quest.id)) return 'completed';
  if (pendingQuestIds.includes(quest.id)) return 'pending';
  if (quest.status === 'inactive' || quest.status === 'draft') return 'hidden';

  // Prerequisite Quest Check
  if (quest.prerequisiteQuestId && !completedQuestIds.includes(quest.prerequisiteQuestId)) {
    return 'locked';
  }

  // Scheduled unlock time check
  if (quest.startsAt && new Date(quest.startsAt).getTime() > nowMs) {
    return 'locked';
  }

  // Flash Quest expiration check
  if (quest.isFlash) {
    if (quest.expiresAt && new Date(quest.expiresAt).getTime() <= nowMs) {
      return 'expired';
    }
    return 'flash';
  }

  return 'available';
}

// 2. PLAYER MANAGEMENT
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

// 3. EVENTS MANAGEMENT
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

// 4. QUESTS MANAGEMENT
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

// Trigger / Activate a Flash Quest
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
    logActivity({
      type: 'flash_activated',
      actorName: 'Game Master',
      title: `⚡ Flash Quest Triggered: ${updated.title}`,
      details: `Active for ${durationMinutes} minutes (+${updated.pointValue} XP)`,
    });
  }

  return updated;
}

// 5. TEAMS ENGINE
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
    id: `team-${Date.now()}`,
    eventId,
    name: name.trim(),
    joinCode,
    captainId,
    avatarSymbol,
    totalPoints: 0,
    createdAt: new Date().toISOString(),
  };

  const newMember: TeamMember = {
    id: `tm-${Date.now()}`,
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

  // Remove player from existing team in this event if any
  const otherTeamIds = teams.filter((t) => t.eventId === eventId).map((t) => t.id);
  const filteredMembers = members.filter((m) => !(m.playerId === playerId && otherTeamIds.includes(m.teamId)));

  const newMember: TeamMember = {
    id: `tm-${Date.now()}`,
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

  // Calculate team scores from ledger
  ledger
    .filter((entry) => entry.eventId === eventId)
    .forEach((entry) => {
      // Find which team this player belonged to or entry.teamId
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

// 6. SUBMISSION & PROOF ENGINE WITH GEOLOCATION & COMBINED QR PROXIMITY
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

  // Anti-duplicate submission check
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

  // 1. GEOLOCATION PROXIMITY VERIFICATION (if required or location checkin)
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
        };
      }
    }
  }

  // 2. VERIFICATION LOGIC BY TYPE
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
      setStoredItem(STORAGE_KEYS.SUBMISSIONS, [...submissions, failedSub]);
      return {
        success: false,
        submission: failedSub,
        message: 'Invalid QR Code token! Make sure you are scanning an official Canton Quests QR emblem.',
        awardedPoints: 0,
      };
    }
  } else if (quest.verificationType === 'photo' || quest.verificationType === 'video') {
    isAutoVerified = false;
    validationMessage = 'Media proof submitted! Routed to Game Master review queue.';
  }

  // Get player team if any
  const playerTeamInfo = getTeamForPlayer(params.playerId, params.eventId);
  const teamId = params.teamId || playerTeamInfo.team?.id;

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
    submittedAt: new Date().toISOString(),
    reviewedAt: isAutoVerified ? new Date().toISOString() : undefined,
    userLat: params.userLat,
    userLon: params.userLon,
    distanceFromLocation: distanceFromLoc,
  };

  const updatedSubmissions = [...submissions, newSubmission];
  setStoredItem(STORAGE_KEYS.SUBMISSIONS, updatedSubmissions);

  let awardedPoints = 0;
  if (isAutoVerified) {
    awardedPoints = quest.pointValue;
    recordScoreLedger({
      eventId: params.eventId,
      playerId: params.playerId,
      teamId,
      questId: params.questId,
      submissionId: newSubmission.id,
      points: quest.pointValue,
      category: quest.category,
      description: `Completed ${quest.title}`,
    });

    const player = getAllPlayers().find((p) => p.id === params.playerId);
    logActivity({
      type: 'quest_completed',
      actorName: player?.displayName || 'Player',
      title: `Quest Completed: ${quest.title}`,
      details: `+${quest.pointValue} XP awarded`,
    });
  } else {
    const player = getAllPlayers().find((p) => p.id === params.playerId);
    logActivity({
      type: 'submission_pending',
      actorName: player?.displayName || 'Player',
      title: `Proof Submitted: ${quest.title}`,
      details: 'Media proof pending Game Master review',
    });
  }

  return {
    success: true,
    submission: newSubmission,
    message: validationMessage,
    awardedPoints,
  };
}

// 7. SCORE LEDGER & LEADERBOARD
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
      totalPoints: stats.totalPoints,
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
  };
}

// 8. ADMIN REVIEW & RECENT ACTIVITY CONTROLS
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
