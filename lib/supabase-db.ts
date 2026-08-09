// Canton Quests — Supabase Database Service Layer (Phase 2 Real-World Game Layer)

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
  Team,
  TeamMember,
  TeamLeaderboardEntry,
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
import * as localEngine from './game-engine';
import { checkProximity } from './geo';

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
          radiusMeters: row.locations.radius_meters,
          accessNotes: row.locations.access_notes,
          openingHours: row.locations.opening_hours,
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
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    radiusMeters: row.radius_meters,
    prerequisiteQuestId: row.prerequisite_quest_id,
    unlockConditionType: row.unlock_condition_type,
    requireLocationVerification: row.require_location_verification,
    requireQrAndLocation: row.require_qr_and_location,
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

function mapTeamFromDB(row: any): Team {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    joinCode: row.join_code,
    captainId: row.captain_id,
    avatarSymbol: row.avatar_symbol,
    totalPoints: row.total_points || 0,
    createdAt: row.created_at,
  };
}

function mapSubmissionFromDB(row: any): QuestSubmission {
  return {
    id: row.id,
    questId: row.quest_id,
    playerId: row.player_id,
    teamId: row.team_id,
    eventId: row.event_id,
    proofType: row.proof_type,
    submittedContent: row.submitted_content,
    proofUrl: row.proof_url,
    status: row.status,
    awardedPoints: row.awarded_points,
    feedback: row.feedback,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    userLat: row.user_lat,
    userLon: row.user_lon,
    distanceFromLocation: row.distance_from_location,
  };
}

// 1. SEED DATABASE DB
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
      radius_meters: l.radiusMeters || 100,
      access_notes: l.accessNotes,
      opening_hours: l.openingHours,
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
      starts_at: q.startsAt,
      expires_at: q.expiresAt,
      status: q.status,
      sort_order: q.sortOrder,
      radius_meters: q.radiusMeters || 100,
      prerequisite_quest_id: q.prerequisiteQuestId,
      unlock_condition_type: q.unlockConditionType || 'none',
      require_location_verification: q.requireLocationVerification || false,
      require_qr_and_location: q.requireQrAndLocation || false,
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

    // Seed Teams
    const teamRows = SEED_TEAMS.map((t) => ({
      id: t.id,
      event_id: t.eventId,
      name: t.name,
      join_code: t.joinCode,
      captain_id: t.captainId,
      avatar_symbol: t.avatarSymbol,
      total_points: t.totalPoints,
    }));
    await supabase.from('teams').upsert(teamRows);

    // Seed Team Members
    const memberRows = SEED_TEAM_MEMBERS.map((m) => ({
      id: m.id,
      team_id: m.teamId,
      player_id: m.playerId,
    }));
    await supabase.from('team_members').upsert(memberRows);

    return { success: true, message: 'Supabase database seeded successfully with Phase 2 game state!' };
  } catch (err: any) {
    console.error('Supabase seed error:', err);
    return { success: false, message: err.message || 'Seed failed.' };
  }
}

// 2. EVENTS API
export async function getEventsDB(): Promise<QuestEvent[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getEvents();
  const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
  if (error || !data || data.length === 0) return localEngine.getEvents();
  return data.map(mapEventFromDB);
}

export async function getEventBySlugDB(slug: string): Promise<QuestEvent | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getEventBySlug(slug);
  const { data, error } = await supabase.from('events').select('*').eq('slug', slug).single();
  if (error || !data) return localEngine.getEventBySlug(slug);
  return mapEventFromDB(data);
}

// 3. QUESTS API
export async function getQuestsForEventDB(eventId: string): Promise<Quest[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getQuestsForEvent(eventId);
  const { data, error } = await supabase
    .from('quests')
    .select('*, locations(*)')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });
  if (error || !data || data.length === 0) return localEngine.getQuestsForEvent(eventId);
  return data.map(mapQuestFromDB);
}

export async function getQuestByIdDB(questId: string): Promise<Quest | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getQuestById(questId);
  const { data, error } = await supabase
    .from('quests')
    .select('*, locations(*)')
    .eq('id', questId)
    .single();
  if (error || !data) return localEngine.getQuestById(questId);
  return mapQuestFromDB(data);
}

// 4. PLAYERS & TEAMS DB
export async function upsertPlayerDB(displayName: string, avatarUrl: string = '⚡'): Promise<Player> {
  if (!isSupabaseConfigured || !supabase) return localEngine.setCurrentPlayer(displayName, avatarUrl);

  const { data: existing } = await supabase
    .from('players')
    .select('*')
    .ilike('display_name', displayName.trim())
    .single();

  if (existing) return mapPlayerFromDB(existing);

  const newId = `plr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

  if (error || !data) return localEngine.setCurrentPlayer(displayName, avatarUrl);
  return mapPlayerFromDB(data);
}

export async function createTeamDB(eventId: string, name: string, captainId: string, avatarSymbol: string = '🛡️'): Promise<Team> {
  if (!isSupabaseConfigured || !supabase) return localEngine.createTeam(eventId, name, captainId, avatarSymbol);

  const joinCode = localEngine.generateJoinCode();
  const newId = `team-${Date.now()}`;

  const { data, error } = await supabase
    .from('teams')
    .insert({
      id: newId,
      event_id: eventId,
      name: name.trim(),
      join_code: joinCode,
      captain_id: captainId,
      avatar_symbol: avatarSymbol,
    })
    .select()
    .single();

  if (error || !data) return localEngine.createTeam(eventId, name, captainId, avatarSymbol);

  await supabase.from('team_members').insert({
    team_id: newId,
    player_id: captainId,
  });

  return mapTeamFromDB(data);
}

export async function joinTeamByCodeDB(joinCode: string, playerId: string, eventId: string) {
  if (!isSupabaseConfigured || !supabase) return localEngine.joinTeamByCode(joinCode, playerId, eventId);
  return localEngine.joinTeamByCode(joinCode, playerId, eventId);
}

export async function getTeamLeaderboardDB(eventId: string): Promise<TeamLeaderboardEntry[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getTeamLeaderboardForEvent(eventId);
  return localEngine.getTeamLeaderboardForEvent(eventId);
}

// 5. PROOF SUBMISSION & SCORING
export async function submitQuestProofDB(params: SubmitProofParams): Promise<SubmitProofResult> {
  if (!isSupabaseConfigured || !supabase) return localEngine.submitQuestProof(params);
  return localEngine.submitQuestProof(params);
}

// 6. LEADERBOARD API
export async function getLeaderboardDB(eventId: string): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getLeaderboardForEvent(eventId);
  return localEngine.getLeaderboardForEvent(eventId);
}

export async function getPlayerProgressDB(playerId: string, eventId: string): Promise<PlayerEventProgress> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getPlayerProgress(playerId, eventId);
  return localEngine.getPlayerProgress(playerId, eventId);
}

// 7. GAME MASTER ADMIN CONTROLS DB
export async function triggerFlashQuestDB(questId: string, durationMinutes: number = 30): Promise<Quest | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.triggerFlashQuest(questId, durationMinutes);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('quests')
    .update({
      is_flash: true,
      status: 'active',
      starts_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .eq('id', questId)
    .select('*, locations(*)')
    .single();

  if (error || !data) return localEngine.triggerFlashQuest(questId, durationMinutes);

  localEngine.logActivity({
    type: 'flash_activated',
    actorName: 'Game Master',
    title: `⚡ Flash Quest Triggered: ${data.title}`,
    details: `Active for ${durationMinutes} minutes`,
  });

  return mapQuestFromDB(data);
}

export async function getAllSubmissionsDB(): Promise<QuestSubmission[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getAllSubmissions();
  const { data, error } = await supabase.from('quest_submissions').select('*').order('submitted_at', { ascending: false });
  if (error || !data) return localEngine.getAllSubmissions();
  return data.map(mapSubmissionFromDB);
}

export async function reviewSubmissionDB(
  submissionId: string,
  newStatus: 'verified' | 'rejected',
  feedback?: string
): Promise<QuestSubmission | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.reviewSubmission(submissionId, newStatus, feedback);
  return localEngine.reviewSubmission(submissionId, newStatus, feedback);
}

export function getActivityLogDB(): EventActivityItem[] {
  return localEngine.getActivityLog();
}
