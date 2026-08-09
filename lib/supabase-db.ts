// Canton Quests — Supabase Database Service Layer

import { supabase, isSupabaseConfigured } from './supabase';
import {
  City,
  QuestEvent,
  LocationInfo,
  Quest,
  Player,
  QuestSubmission,
  ScoreLedgerEntry,
  LeaderboardEntry,
  PlayerEventProgress,
  SubmitProofParams,
  SubmitProofResult,
} from './types';
import { SEED_CITY, SEED_LOCATIONS, SEED_EVENT, SEED_QUESTS, SEED_DEMO_PLAYERS } from './seed-data';
import * as localEngine from './game-engine';

// Helper to convert snake_case DB rows to camelCase domain models
function mapQuestFromDB(row: any): Quest {
  return {
    id: row.id,
    eventId: row.event_id,
    locationId: row.location_id,
    location: row.locations
      ? {
          id: row.locations.id,
          cityId: row.locations.city_id,
          name: row.locations.name,
          address: row.locations.address,
          latitude: row.locations.latitude,
          longitude: row.locations.longitude,
          locationNotes: row.locations.location_notes,
          isPartner: row.locations.is_partner,
        }
      : undefined,
    title: row.title,
    slug: row.slug,
    description: row.description,
    instructions: row.instructions,
    pointValue: row.point_value,
    difficulty: row.difficulty,
    category: row.category,
    verificationType: row.verification_type,
    targetCode: row.target_code,
    proofRequirement: row.proof_requirement,
    isFlash: row.is_flash,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mapEventFromDB(row: any): QuestEvent {
  return {
    id: row.id,
    cityId: row.city_id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    basicInstructions: row.basic_instructions,
    createdAt: row.created_at,
  };
}

function mapPlayerFromDB(row: any): Player {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    totalXp: row.total_xp,
    level: row.level,
    createdAt: row.created_at,
  };
}

function mapSubmissionFromDB(row: any): QuestSubmission {
  return {
    id: row.id,
    questId: row.quest_id,
    playerId: row.player_id,
    eventId: row.event_id,
    proofType: row.proof_type,
    submittedContent: row.submitted_content,
    proofUrl: row.proof_url,
    status: row.status,
    awardedPoints: row.awarded_points,
    feedback: row.feedback,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  };
}

// 1. SEED DATABASE
export async function seedDatabaseDB(): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured || !supabase) {
    localEngine.initializeGameEngine();
    return { success: true, message: 'Seeded in-memory fallback store.' };
  }

  try {
    // Seed City
    await supabase.from('cities').upsert({
      id: SEED_CITY.id,
      name: SEED_CITY.name,
      slug: SEED_CITY.slug,
      state: SEED_CITY.state,
      is_active: SEED_CITY.isActive,
    });

    // Seed Locations
    const locRows = SEED_LOCATIONS.map((l) => ({
      id: l.id,
      city_id: l.cityId,
      name: l.name,
      address: l.address,
      latitude: l.latitude,
      longitude: l.longitude,
      location_notes: l.locationNotes,
      is_partner: l.isPartner,
    }));
    await supabase.from('locations').upsert(locRows);

    // Seed Event
    await supabase.from('events').upsert({
      id: SEED_EVENT.id,
      city_id: SEED_EVENT.cityId,
      title: SEED_EVENT.title,
      slug: SEED_EVENT.slug,
      description: SEED_EVENT.description,
      status: SEED_EVENT.status,
      start_time: SEED_EVENT.startTime,
      end_time: SEED_EVENT.endTime,
      basic_instructions: SEED_EVENT.basicInstructions,
    });

    // Seed Quests
    const questRows = SEED_QUESTS.map((q) => ({
      id: q.id,
      event_id: q.eventId,
      location_id: q.locationId,
      title: q.title,
      slug: q.slug,
      description: q.description,
      instructions: q.instructions,
      point_value: q.pointValue,
      difficulty: q.difficulty,
      category: q.category,
      verification_type: q.verificationType,
      target_code: q.targetCode,
      proof_requirement: q.proofRequirement,
      is_flash: q.isFlash,
      status: q.status,
      sort_order: q.sortOrder,
    }));
    await supabase.from('quests').upsert(questRows);

    // Seed Players
    const playerRows = SEED_DEMO_PLAYERS.map((p) => ({
      id: p.id,
      display_name: p.displayName,
      avatar_url: p.avatarUrl,
      role: p.role,
      total_xp: p.totalXp,
      level: p.level,
    }));
    await supabase.from('players').upsert(playerRows);

    return { success: true, message: 'Supabase database seeded successfully with Canton Ohio event & 12 quests!' };
  } catch (err: any) {
    console.error('Supabase seed error:', err);
    return { success: false, message: err.message || 'Seed failed.' };
  }
}

// 2. EVENTS API
export async function getEventsDB(): Promise<QuestEvent[]> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.getEvents();
  }

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return localEngine.getEvents();
  }

  return data.map(mapEventFromDB);
}

export async function getEventBySlugDB(slug: string): Promise<QuestEvent | undefined> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.getEventBySlug(slug);
  }

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return localEngine.getEventBySlug(slug);
  }

  return mapEventFromDB(data);
}

// 3. QUESTS API
export async function getQuestsForEventDB(eventId: string): Promise<Quest[]> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.getQuestsForEvent(eventId);
  }

  const { data, error } = await supabase
    .from('quests')
    .select('*, locations(*)')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });

  if (error || !data || data.length === 0) {
    return localEngine.getQuestsForEvent(eventId);
  }

  return data.map(mapQuestFromDB);
}

export async function getQuestByIdDB(questId: string): Promise<Quest | undefined> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.getQuestById(questId);
  }

  const { data, error } = await supabase
    .from('quests')
    .select('*, locations(*)')
    .eq('id', questId)
    .single();

  if (error || !data) {
    return localEngine.getQuestById(questId);
  }

  return mapQuestFromDB(data);
}

// 4. PLAYERS & IDENTITY
export async function upsertPlayerDB(displayName: string, avatarUrl: string = '⚡'): Promise<Player> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.setCurrentPlayer(displayName, avatarUrl);
  }

  // Check if player exists by display name
  const { data: existing } = await supabase
    .from('players')
    .select('*')
    .ilike('display_name', displayName.trim())
    .single();

  if (existing) {
    return mapPlayerFromDB(existing);
  }

  const newId = `plr-${Date.now()}`;
  const { data, error } = await supabase
    .from('players')
    .insert({
      id: newId,
      display_name: displayName.trim(),
      avatar_url: avatarUrl,
      role: 'player',
      total_xp: 0,
      level: 1,
    })
    .select()
    .single();

  if (error || !data) {
    return localEngine.setCurrentPlayer(displayName, avatarUrl);
  }

  return mapPlayerFromDB(data);
}

export async function getAllPlayersDB(): Promise<Player[]> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.getAllPlayers();
  }

  const { data, error } = await supabase.from('players').select('*').order('total_xp', { ascending: false });
  if (error || !data) return localEngine.getAllPlayers();
  return data.map(mapPlayerFromDB);
}

// 5. PROOF SUBMISSION & SCORING LEDGER
export async function submitQuestProofDB(params: SubmitProofParams): Promise<SubmitProofResult> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.submitQuestProof(params);
  }

  const quest = await getQuestByIdDB(params.questId);
  if (!quest) {
    throw new Error('Quest not found');
  }

  // Ensure player exists in Supabase
  await supabase.from('players').upsert({
    id: params.playerId,
    display_name: params.playerId.replace('plr-', 'Agent_'),
    avatar_url: '⚡',
    role: 'player',
  }, { onConflict: 'id' });

  // Anti-cheat check: Prevent duplicate submissions
  const { data: existing } = await supabase
    .from('quest_submissions')
    .select('*')
    .eq('player_id', params.playerId)
    .eq('quest_id', params.questId)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'verified') {
      return {
        success: false,
        submission: mapSubmissionFromDB(existing),
        message: 'Quest already completed! Points have already been awarded.',
        awardedPoints: 0,
      };
    }
    if (existing.status === 'pending') {
      return {
        success: false,
        submission: mapSubmissionFromDB(existing),
        message: 'Your proof submission for this quest is currently under review by a Game Master.',
        awardedPoints: 0,
      };
    }
  }

  // Verification Logic
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
      return {
        success: false,
        submission: {
          id: `sub-rejected-${Date.now()}`,
          questId: params.questId,
          playerId: params.playerId,
          eventId: params.eventId,
          proofType: params.proofType,
          submittedContent: params.submittedContent,
          status: 'rejected',
          awardedPoints: 0,
          submittedAt: new Date().toISOString(),
        },
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
      return {
        success: false,
        submission: {
          id: `sub-rejected-${Date.now()}`,
          questId: params.questId,
          playerId: params.playerId,
          eventId: params.eventId,
          proofType: params.proofType,
          submittedContent: params.submittedContent,
          status: 'rejected',
          awardedPoints: 0,
          submittedAt: new Date().toISOString(),
        },
        message: 'Invalid QR Code token! Make sure you are scanning an official Canton Quests QR code.',
        awardedPoints: 0,
      };
    }
  } else if (quest.verificationType === 'photo' || quest.verificationType === 'video') {
    isAutoVerified = false;
    validationMessage = 'Media proof submitted! Routed to Game Master review queue.';
  }

  const subId = `sub-${Date.now()}`;
  const status = isAutoVerified ? 'verified' : 'pending';
  const awardedPoints = isAutoVerified ? quest.pointValue : 0;

  const { data: subData, error: subErr } = await supabase
    .from('quest_submissions')
    .insert({
      id: subId,
      quest_id: params.questId,
      player_id: params.playerId,
      event_id: params.eventId,
      proof_type: params.proofType,
      submitted_content: params.submittedContent,
      proof_url: params.proofUrl,
      status,
      awarded_points: awardedPoints,
      submitted_at: new Date().toISOString(),
      reviewed_at: isAutoVerified ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (subErr || !subData) {
    // Fall back if DB insert fails
    return localEngine.submitQuestProof(params);
  }

  if (isAutoVerified) {
    // Insert into score_ledger
    await supabase.from('score_ledger').insert({
      id: `sc-${Date.now()}`,
      event_id: params.eventId,
      player_id: params.playerId,
      quest_id: params.questId,
      submission_id: subId,
      points: quest.pointValue,
      category: quest.category,
      description: `Completed ${quest.title}`,
    });

    // Update player total XP in DB
    const { data: playerObj } = await supabase.from('players').select('total_xp').eq('id', params.playerId).single();
    const currentXp = playerObj ? playerObj.total_xp : 0;
    const newXp = currentXp + quest.pointValue;
    const newLevel = Math.floor(newXp / 250) + 1;
    await supabase.from('players').update({ total_xp: newXp, level: newLevel }).eq('id', params.playerId);
  }

  return {
    success: true,
    submission: mapSubmissionFromDB(subData),
    message: validationMessage,
    awardedPoints,
  };
}

// 6. LEADERBOARD API
export async function getLeaderboardDB(eventId: string): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.getLeaderboardForEvent(eventId);
  }

  // Fetch score_ledger and players
  const { data: ledger, error: lErr } = await supabase
    .from('score_ledger')
    .select('*')
    .eq('event_id', eventId);

  const { data: players, error: pErr } = await supabase.from('players').select('*');

  if (lErr || pErr || !ledger) {
    return localEngine.getLeaderboardForEvent(eventId);
  }

  const playerMap: Record<string, { totalPoints: number; questIds: Set<string>; lastTime: string }> = {};

  ledger.forEach((row) => {
    if (!playerMap[row.player_id]) {
      playerMap[row.player_id] = { totalPoints: 0, questIds: new Set(), lastTime: row.awarded_at };
    }
    playerMap[row.player_id].totalPoints += row.points;
    if (row.quest_id) playerMap[row.player_id].questIds.add(row.quest_id);
    if (new Date(row.awarded_at) > new Date(playerMap[row.player_id].lastTime)) {
      playerMap[row.player_id].lastTime = row.awarded_at;
    }
  });

  const leaderboard: LeaderboardEntry[] = Object.entries(playerMap).map(([playerId, stats]) => {
    const pObj = (players || []).find((p) => p.id === playerId);
    return {
      rank: 0,
      playerId,
      displayName: pObj ? pObj.display_name : 'Agent_' + playerId.slice(-4),
      avatarUrl: pObj ? pObj.avatar_url : '⚡',
      totalPoints: stats.totalPoints,
      questsCompletedCount: stats.questIds.size,
      lastScoreTime: stats.lastTime,
    };
  });

  leaderboard.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return new Date(a.lastScoreTime || 0).getTime() - new Date(b.lastScoreTime || 0).getTime();
  });

  return leaderboard.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function getPlayerProgressDB(playerId: string, eventId: string): Promise<PlayerEventProgress> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.getPlayerProgress(playerId, eventId);
  }

  const { data: subs } = await supabase
    .from('quest_submissions')
    .select('*')
    .eq('player_id', playerId)
    .eq('event_id', eventId);

  const { data: quests } = await supabase.from('quests').select('id').eq('event_id', eventId);
  const leaderboard = await getLeaderboardDB(eventId);

  const verified = (subs || []).filter((s) => s.status === 'verified');
  const pending = (subs || []).filter((s) => s.status === 'pending');

  const completedQuestIds = verified.map((s) => s.quest_id);
  const pendingSubmissionQuestIds = pending.map((s) => s.quest_id);
  const totalPoints = verified.reduce((sum, s) => sum + s.awarded_points, 0);
  const lbEntry = leaderboard.find((l) => l.playerId === playerId);

  return {
    totalPoints,
    completedQuestIds,
    pendingSubmissionQuestIds,
    completedCount: completedQuestIds.length,
    availableCount: (quests || []).length,
    rank: lbEntry ? lbEntry.rank : leaderboard.length + 1,
  };
}

// 7. ADMIN GAME MASTER API
export async function getAllSubmissionsDB(): Promise<QuestSubmission[]> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.getAllSubmissions();
  }

  const { data, error } = await supabase
    .from('quest_submissions')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error || !data) return localEngine.getAllSubmissions();
  return data.map(mapSubmissionFromDB);
}

export async function reviewSubmissionDB(
  submissionId: string,
  newStatus: 'verified' | 'rejected',
  feedback?: string
): Promise<QuestSubmission | undefined> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.reviewSubmission(submissionId, newStatus, feedback);
  }

  const { data: sub } = await supabase
    .from('quest_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (!sub) return undefined;

  let awardedPoints = 0;
  if (newStatus === 'verified') {
    const quest = await getQuestByIdDB(sub.quest_id);
    awardedPoints = quest ? quest.pointValue : 100;
  }

  const { data: updated, error } = await supabase
    .from('quest_submissions')
    .update({
      status: newStatus,
      feedback,
      awarded_points: awardedPoints,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (error || !updated) return undefined;

  if (newStatus === 'verified') {
    await supabase.from('score_ledger').insert({
      id: `sc-${Date.now()}`,
      event_id: sub.event_id,
      player_id: sub.player_id,
      quest_id: sub.quest_id,
      submission_id: sub.id,
      points: awardedPoints,
      category: 'admin_approved',
      description: 'Media submission approved by Game Master',
    });
  }

  return mapSubmissionFromDB(updated);
}
