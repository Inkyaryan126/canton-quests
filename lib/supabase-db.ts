// Canton Quests — Supabase Database Service Layer (Phase 4 Event Factory)

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
  EventPhaseType,
  LiveAnnouncement,
  SecretCode,
  Collectible,
  PlayerCollectible,
  NPCCharacter,
  BusinessPartnerInfo,
  CrowdObjective,
  BonusWindow,
  FinaleQualification,
  Prize,
  EventReadiness,
  GeneratedQR,
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
import * as localEngine from './game-engine';

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
    claimLimit: row.claim_limit,
    currentClaims: row.current_claims,
    isSecret: row.is_secret,
    isFinaleQuest: row.is_finale_quest,
    raceRewards: row.race_rewards,
    hints: row.hints,
    riskReward: row.risk_reward,
    requiredCollectibleId: row.required_collectible_id,
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
    currentPhase: row.current_phase || 'day_1',
    isPaused: row.is_paused || false,
    pauseReason: row.pause_reason,
    startTime: row.start_time,
    endTime: row.end_time,
    registrationStartTime: row.registration_start_time,
    basicInstructions: row.basic_instructions,
    safetyNotes: row.safety_notes,
    mapCenterLat: row.map_center_lat,
    mapCenterLon: row.map_center_lon,
    themeColor: row.theme_color,
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
    reviewerNotes: row.reviewer_notes,
    reviewFlags: row.review_flags,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    userLat: row.user_lat,
    userLon: row.user_lon,
    distanceFromLocation: row.distance_from_location,
    claimPlacement: row.claim_placement,
  };
}

// 1. SEED DATABASE DB
export async function seedDatabaseDB(): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured || !supabase) {
    localEngine.initializeGameEngine();
    return { success: true, message: 'Seeded in-memory fallback store.' };
  }

  try {
    await supabase.from('cities').upsert({
      id: SEED_CITY.id,
      name: SEED_CITY.name,
      slug: SEED_CITY.slug,
      state: SEED_CITY.state,
      is_active: SEED_CITY.isActive,
    });

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

    await supabase.from('events').upsert({
      id: SEED_EVENT.id,
      city_id: SEED_EVENT.cityId,
      title: SEED_EVENT.title,
      slug: SEED_EVENT.slug,
      description: SEED_EVENT.description,
      status: SEED_EVENT.status,
      current_phase: SEED_EVENT.currentPhase,
      is_paused: SEED_EVENT.isPaused,
      start_time: SEED_EVENT.startTime,
      end_time: SEED_EVENT.endTime,
      basic_instructions: SEED_EVENT.basicInstructions,
    });

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
      claim_limit: q.claimLimit,
      current_claims: q.currentClaims || 0,
      is_secret: q.isSecret || false,
      is_finale_quest: q.isFinaleQuest || false,
    }));
    await supabase.from('quests').upsert(questRows);

    return { success: true, message: 'Supabase database seeded successfully!' };
  } catch (err: any) {
    console.error('Supabase seed error:', err);
    return { success: false, message: err.message || 'Seed failed.' };
  }
}

// 2. EVENT FACTORY API
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

export async function createEventWizardDB(eventData: Omit<QuestEvent, 'id' | 'createdAt'>): Promise<QuestEvent> {
  if (!isSupabaseConfigured || !supabase) return localEngine.createEventWizard(eventData);
  return localEngine.createEventWizard(eventData);
}

export async function duplicateEventDB(sourceEventId: string, newTitle: string, newSlug: string) {
  if (!isSupabaseConfigured || !supabase) return localEngine.duplicateEvent(sourceEventId, newTitle, newSlug);
  return localEngine.duplicateEvent(sourceEventId, newTitle, newSlug);
}

export function getEventReadinessCheckDB(eventId: string): EventReadiness {
  return localEngine.getEventReadinessCheck(eventId);
}

export async function setEventPhaseDB(eventId: string, phase: EventPhaseType): Promise<QuestEvent | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.setEventPhase(eventId, phase);
  return localEngine.setEventPhase(eventId, phase);
}

export async function toggleEventPauseDB(eventId: string, isPaused: boolean, reason?: string): Promise<QuestEvent | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.toggleEventPause(eventId, isPaused, reason);
  return localEngine.toggleEventPause(eventId, isPaused, reason);
}

// 3. ANNOUNCEMENTS API
export async function createAnnouncementDB(
  eventId: string,
  title: string,
  message: string,
  urgency: LiveAnnouncement['urgency'] = 'info',
  expiresAt?: string,
  linkedQuestId?: string
): Promise<LiveAnnouncement> {
  if (!isSupabaseConfigured || !supabase) return localEngine.createAnnouncement(eventId, title, message, urgency, expiresAt, linkedQuestId);
  return localEngine.createAnnouncement(eventId, title, message, urgency, expiresAt, linkedQuestId);
}

export async function getAnnouncementsDB(eventId: string): Promise<LiveAnnouncement[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getAnnouncements(eventId);
  return localEngine.getAnnouncements(eventId);
}

// 4. SECRET CODES & QR CODE STUDIO
export async function redeemSecretCodeDB(codeStr: string, playerId: string, eventId: string) {
  if (!isSupabaseConfigured || !supabase) return localEngine.redeemSecretCode(codeStr, playerId, eventId);
  return localEngine.redeemSecretCode(codeStr, playerId, eventId);
}

export async function generateQRCodeTokenDB(eventId: string, targetType: GeneratedQR['targetType'], targetId: string, label: string) {
  if (!isSupabaseConfigured || !supabase) return localEngine.generateQRCodeToken(eventId, targetType, targetId, label);
  return localEngine.generateQRCodeToken(eventId, targetType, targetId, label);
}

export async function getGeneratedQRsDB(eventId: string): Promise<GeneratedQR[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getGeneratedQRs(eventId);
  return localEngine.getGeneratedQRs(eventId);
}

export function resolveQRTokenDB(token: string): GeneratedQR | undefined {
  return localEngine.resolveQRToken(token);
}

// 5. COLLECTIBLES & PLAYER COLLECTIBLES API
export async function getCollectiblesForPlayerDB(playerId: string): Promise<PlayerCollectible[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getCollectiblesForPlayer(playerId);
  return localEngine.getCollectiblesForPlayer(playerId);
}

// 6. QUESTS & LOCATIONS API
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
  return localEngine.getQuestById(questId);
}

export async function getLocationsDB(): Promise<LocationInfo[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getLocations();
  return localEngine.getLocations();
}

export async function createLocationDB(locData: Omit<LocationInfo, 'id'>): Promise<LocationInfo> {
  if (!isSupabaseConfigured || !supabase) return localEngine.createLocation(locData);
  return localEngine.createLocation(locData);
}

// 7. PLAYERS & TEAMS DB
export async function upsertPlayerDB(displayName: string, avatarUrl: string = '⚡'): Promise<Player> {
  if (!isSupabaseConfigured || !supabase) return localEngine.setCurrentPlayer(displayName, avatarUrl);
  return localEngine.setCurrentPlayer(displayName, avatarUrl);
}

export async function createTeamDB(eventId: string, name: string, captainId: string, avatarSymbol: string = '🛡️'): Promise<Team> {
  if (!isSupabaseConfigured || !supabase) return localEngine.createTeam(eventId, name, captainId, avatarSymbol);
  return localEngine.createTeam(eventId, name, captainId, avatarSymbol);
}

export async function joinTeamByCodeDB(joinCode: string, playerId: string, eventId: string) {
  if (!isSupabaseConfigured || !supabase) return localEngine.joinTeamByCode(joinCode, playerId, eventId);
  return localEngine.joinTeamByCode(joinCode, playerId, eventId);
}

export async function getTeamLeaderboardDB(eventId: string): Promise<TeamLeaderboardEntry[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getTeamLeaderboardForEvent(eventId);
  return localEngine.getTeamLeaderboardForEvent(eventId);
}

// 8. PROOF SUBMISSION & SCORING
export async function submitQuestProofDB(params: SubmitProofParams): Promise<SubmitProofResult> {
  if (!isSupabaseConfigured || !supabase) return localEngine.submitQuestProof(params);
  return localEngine.submitQuestProof(params);
}

export async function getLeaderboardDB(eventId: string): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getLeaderboardForEvent(eventId);
  return localEngine.getLeaderboardForEvent(eventId);
}

export async function getPlayerProgressDB(playerId: string, eventId: string): Promise<PlayerEventProgress> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getPlayerProgress(playerId, eventId);
  return localEngine.getPlayerProgress(playerId, eventId);
}

// 9. GAME MASTER CONTROLS DB
export async function triggerFlashQuestDB(questId: string, durationMinutes: number = 30): Promise<Quest | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.triggerFlashQuest(questId, durationMinutes);
  return localEngine.triggerFlashQuest(questId, durationMinutes);
}

export async function getAllSubmissionsDB(): Promise<QuestSubmission[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getAllSubmissions();
  return localEngine.getAllSubmissions();
}

export async function reviewSubmissionDB(
  submissionId: string,
  newStatus: 'verified' | 'rejected' | 'retry_requested',
  feedback?: string,
  reviewerNotes?: string
): Promise<QuestSubmission | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.reviewSubmission(submissionId, newStatus, feedback, reviewerNotes);
  return localEngine.reviewSubmission(submissionId, newStatus, feedback, reviewerNotes);
}

export function getActivityLogDB(): EventActivityItem[] {
  return localEngine.getActivityLog();
}

export function adjustPlayerScoreManualDB(eventId: string, playerId: string, points: number, reason: string, adminName?: string) {
  return localEngine.adjustPlayerScoreManual(eventId, playerId, points, reason, adminName);
}

export function createBonusWindowDB(eventId: string, title: string, multiplier: number, category?: Quest['category'], durationMinutes: number = 45) {
  return localEngine.createBonusWindow(eventId, title, multiplier, category, durationMinutes);
}
