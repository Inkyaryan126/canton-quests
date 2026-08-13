// Canton Quests — Supabase Database Service Layer (Phase 4 Event Factory)

import { supabase, supabaseAdmin, isSupabaseConfigured, isSupabaseAdminConfigured } from './supabase';
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
  QuestStep,
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

function getServerQuestTargetCode(questId: string): string | undefined {
  if (typeof window !== 'undefined') return undefined;
  const nodeRequire = eval('require') as (id: string) => any;
  const maps = nodeRequire(`${process.cwd()}/lib/quest-proof-secrets.server.json`) as {
    QUEST_TARGET_CODE_HASHES: Record<string, string>;
  };
  return maps.QUEST_TARGET_CODE_HASHES[questId];
}

function mapLocationFromDB(row: any): LocationInfo | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    cityId: row.city_id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    locationNotes: row.location_notes,
    isPartner: row.is_partner,
    radiusMeters: row.radius_meters,
    accessNotes: row.access_notes,
    openingHours: row.opening_hours,
  };
}

function mapQuestStepFromDB(row: any): QuestStep {
  return {
    id: row.id,
    questId: row.quest_id,
    stepOrder: row.step_order,
    title: row.title,
    instructions: row.instructions,
    verificationType: row.verification_type,
    targetCode: row.target_code,
    locationId: row.location_id,
    location: mapLocationFromDB(row.locations),
    radiusMeters: row.radius_meters,
  };
}

export function mapQuestFromDB(row: any): Quest {
  return {
    id: row.id,
    eventId: row.event_id,
    locationId: row.location_id,
    location: mapLocationFromDB(row.locations),
    title: row.title,
    slug: row.slug,
    description: row.description,
    instructions: row.instructions,
    pointValue: row.point_value,
    xpReward: row.xp_reward || row.point_value,
    drawingEntryReward: row.drawing_entry_reward ?? 1,
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
    safetyNotes: row.safety_notes,
    gmNotes: row.gm_notes,
    steps: (row.quest_steps || row.steps || [])
      .map(mapQuestStepFromDB)
      .sort((a: QuestStep, b: QuestStep) => a.stepOrder - b.stepOrder),
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
    drawingEntriesAwarded: row.drawing_entries_awarded ?? 0,
    completedStepOrder: row.completed_step_order,
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

function failedSubmissionResult(params: SubmitProofParams, message: string): SubmitProofResult {
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
      drawingEntriesAwarded: 0,
      feedback: message,
      submittedAt: new Date().toISOString(),
    },
    message,
    awardedPoints: 0,
    drawingEntriesAwarded: 0,
  };
}

async function resolveAuthenticatedPlayerId(authToken?: string): Promise<string> {
  if (!supabase || !authToken) {
    throw new Error('Authenticated player session is required.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(authToken);
  if (userError || !userData.user) {
    throw new Error('Authenticated player session is invalid.');
  }

  const db = supabaseAdmin || supabase;
  const { data: player, error: playerError } = await db
    .from('players')
    .select('id')
    .eq('user_id', userData.user.id)
    .single();

  if (playerError || !player) {
    throw new Error('Authenticated user is not linked to a Canton Quests player.');
  }

  return player.id;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function verifyAutomatedProof(
  params: SubmitProofParams,
  quest: Quest,
  completedStepOrder: number = 0
): {
  status: QuestSubmission['status'];
  message: string;
  awardedPoints: number;
  drawingEntriesAwarded: number;
  completedStepOrder?: number;
  isQuestFullyCompleted: boolean;
  distanceFromLocation?: number;
} {
  const fail = (message: string, distanceFromLocation?: number) => ({
    status: 'rejected' as const,
    message,
    awardedPoints: 0,
    drawingEntriesAwarded: 0,
    completedStepOrder,
    isQuestFullyCompleted: false,
    distanceFromLocation,
  });

  const verifyGps = (step?: QuestStep) => {
    const targetLat = step?.location?.latitude ?? quest.location?.latitude;
    const targetLon = step?.location?.longitude ?? quest.location?.longitude;
    const radius = step?.radiusMeters || quest.radiusMeters || quest.location?.radiusMeters || 100;
    if (targetLat === undefined || targetLon === undefined) {
      return { ok: false, message: 'Authoritative quest location is missing; Game Master review is required.' };
    }
    if (params.userLat === undefined || params.userLon === undefined) {
      return { ok: false, message: 'GPS location verification required. Please enable location services.' };
    }
    if (params.userAccuracyMeters !== undefined && params.userAccuracyMeters > 100) {
      return { ok: false, message: `GPS accuracy is too weak for reward verification (${Math.round(params.userAccuracyMeters)}m).` };
    }
    const distance = haversineMeters(params.userLat, params.userLon, targetLat, targetLon);
    if (distance > radius) {
      return { ok: false, message: `Too far from target location. You are ${distance} m away.`, distance };
    }
    return { ok: true, message: `GPS Location verified! Signal confirmed (${distance}m from target).`, distance };
  };

  const verifiedReward = (message: string, completedOrder?: number, distanceFromLocation?: number) => ({
    status: 'verified' as const,
    message,
    awardedPoints: quest.xpReward || quest.pointValue,
    drawingEntriesAwarded: quest.drawingEntryReward ?? 1,
    completedStepOrder: completedOrder,
    isQuestFullyCompleted: true,
    distanceFromLocation,
  });

  if (quest.verificationType === 'checkin' || quest.verificationType === 'gps' || quest.requireLocationVerification) {
    const gps = verifyGps();
    if (!gps.ok) return fail(gps.message, gps.distance);
    if (quest.verificationType === 'gps' || quest.verificationType === 'checkin') {
      return verifiedReward(gps.message, undefined, gps.distance);
    }
  }

  if (quest.verificationType === 'passphrase' || quest.verificationType === 'qr') {
    if (proofMatches(params.submittedContent, quest.targetCode)) {
      return verifiedReward(quest.verificationType === 'qr' ? 'QR Emblem Scanned! Quest completed.' : 'Cipher Cracked! Passphrase verified successfully.');
    }
    return fail(quest.verificationType === 'qr' ? 'Invalid QR Code token!' : 'Incorrect passcode frequency! Re-examine the location or plaque.');
  }

  if (quest.verificationType === 'photo' || quest.verificationType === 'video' || quest.verificationType === 'game_master') {
    if (!params.proofUrl && !params.submittedContent) {
      return fail('Proof details are required before Game Master review.');
    }
    return {
      status: 'pending',
      message: 'Proof submitted for Game Master review.',
      awardedPoints: 0,
      drawingEntriesAwarded: 0,
      isQuestFullyCompleted: false,
    };
  }

  if (quest.verificationType === 'multi_step') {
    const steps = quest.steps || [];
    const requestedStepIdx = params.stepIndex ?? completedStepOrder;
    if (requestedStepIdx !== completedStepOrder) {
      return fail(`Invalid step sequence. You must complete step ${completedStepOrder + 1} next.`);
    }
    const step = steps[requestedStepIdx];
    if (!step) return fail('Invalid step index for multi-step quest.');

    if (step.verificationType === 'passphrase' || step.verificationType === 'qr') {
      if (!proofMatches(params.submittedContent, step.targetCode)) return fail(`Step ${requestedStepIdx + 1} verification failed.`);
    } else if (step.verificationType === 'gps' || step.verificationType === 'checkin') {
      const gps = verifyGps(step);
      if (!gps.ok) return fail(gps.message, gps.distance);
    } else if (step.verificationType === 'photo' || step.verificationType === 'video' || step.verificationType === 'game_master') {
      if (!params.proofUrl && !params.submittedContent) return fail(`Step ${requestedStepIdx + 1} requires proof details before Game Master review.`);
      return {
        status: 'pending',
        message: `Step ${requestedStepIdx + 1} submitted for Game Master review.`,
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
        completedStepOrder: requestedStepIdx + 1,
        isQuestFullyCompleted: false,
      };
    } else {
      return fail(`Unsupported step verification type: ${step.verificationType}`);
    }

    const nextCompletedOrder = requestedStepIdx + 1;
    if (nextCompletedOrder < steps.length) {
      return {
        status: 'in_progress',
        message: `Step ${nextCompletedOrder} completed! Next step unlocked: ${steps[nextCompletedOrder].title}`,
        awardedPoints: 0,
        drawingEntriesAwarded: 0,
        completedStepOrder: nextCompletedOrder,
        isQuestFullyCompleted: false,
      };
    }

    return verifiedReward('All multi-step objectives completed! Quest fully verified.', nextCompletedOrder);
  }

  return fail('Unsupported quest verification type.');
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
      target_code: q.targetCode || getServerQuestTargetCode(q.id),
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
  const db = supabaseAdmin || supabase;
  const { data, error } = await db
    .from('quests')
    .select('*, locations(*), quest_steps(*, locations(*))')
    .eq('id', questId)
    .single();
  if (error || !data) return undefined;
  return mapQuestFromDB(data);
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
export async function submitQuestProofDB(params: SubmitProofParams, authToken?: string): Promise<SubmitProofResult> {
  if (!isSupabaseConfigured || !supabase) return localEngine.submitQuestProof(params);

  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return failedSubmissionResult(params, 'Server-authoritative reward verification requires Supabase service-role configuration.');
  }

  try {
    const trustedPlayerId = await resolveAuthenticatedPlayerId(authToken);
    if (params.playerId && params.playerId !== trustedPlayerId) {
      return failedSubmissionResult(
        { ...params, playerId: trustedPlayerId },
        'Authenticated player does not match requested reward claimant.'
      );
    }

    const trustedParams: SubmitProofParams = { ...params, playerId: trustedPlayerId };

    const quest = await getQuestByIdDB(trustedParams.questId);
    if (!quest) {
      return failedSubmissionResult(trustedParams, 'Quest not found.');
    }

    if (quest.eventId !== trustedParams.eventId) {
      return failedSubmissionResult(trustedParams, 'Quest does not belong to the requested event.');
    }

    const { data: existingSubmissions } = await supabaseAdmin
      .from('quest_submissions')
      .select('*')
      .eq('player_id', trustedPlayerId)
      .eq('quest_id', trustedParams.questId)
      .order('submitted_at', { ascending: false })
      .limit(5);

    const existingVerifiedSub = existingSubmissions?.find((submission) => submission.status === 'verified');
    const existingSub = existingVerifiedSub || existingSubmissions?.[0];
    if (existingSub) {
      if (existingSub.status === 'verified') {
        return {
          success: false,
          submission: mapSubmissionFromDB(existingSub),
          message: 'Quest already completed! Rewards have already been issued.',
          awardedPoints: 0,
          drawingEntriesAwarded: 0,
        };
      }
      if (existingSub.status === 'pending') {
        return {
          success: false,
          submission: mapSubmissionFromDB(existingSub),
          message: 'Your proof submission is currently under review by a Game Master.',
          awardedPoints: 0,
          drawingEntriesAwarded: 0,
        };
      }
    }

    const completedStepOrder =
      existingSub && existingSub.status === 'in_progress' ? existingSub.completed_step_order || 0 : 0;

    const verification = verifyAutomatedProof(trustedParams, quest, completedStepOrder);

    let teamId: string | undefined = undefined;
    const { data: teamMember } = await supabaseAdmin
      .from('team_members')
      .select('team_id, teams!inner(event_id)')
      .eq('player_id', trustedPlayerId)
      .eq('teams.event_id', trustedParams.eventId)
      .maybeSingle();
    if (teamMember?.team_id) {
      teamId = teamMember.team_id;
    }

    const subRecord = {
      quest_id: trustedParams.questId,
      player_id: trustedPlayerId,
      team_id: teamId,
      event_id: trustedParams.eventId,
      proof_type: trustedParams.proofType,
      submitted_content: trustedParams.submittedContent,
      proof_url: trustedParams.proofUrl,
      status: verification.status,
      awarded_points: verification.status === 'verified' ? verification.awardedPoints : 0,
      drawing_entries_awarded: verification.status === 'verified' ? verification.drawingEntriesAwarded : 0,
      completed_step_order: verification.completedStepOrder,
      user_lat: trustedParams.userLat,
      user_lon: trustedParams.userLon,
      distance_from_location: verification.distanceFromLocation,
      feedback: verification.status === 'rejected' ? verification.message : null,
      reviewed_at: verification.status === 'verified' || verification.status === 'rejected' ? new Date().toISOString() : null,
    };

    const { data: dbSub, error: subError } = await supabaseAdmin
      .from('quest_submissions')
      .insert(subRecord)
      .select()
      .single();

    if (subError || !dbSub) {
      throw new Error(subError?.message || 'Failed to persist quest submission.');
    }

    let awardedPoints = 0;
    let drawingEntriesAwarded = 0;

    if (verification.status === 'verified') {
      const scoreInsert = await supabaseAdmin.from('score_ledger').insert({
        event_id: trustedParams.eventId,
        player_id: trustedPlayerId,
        team_id: teamId,
        quest_id: trustedParams.questId,
        submission_id: dbSub.id,
        points: verification.awardedPoints,
        category: 'quest_completion',
        description: `Completed ${quest.title}`,
      });

      const isDuplicateScore = scoreInsert.error?.code === '23505';
      if (scoreInsert.error && !isDuplicateScore) {
        throw new Error(scoreInsert.error.message);
      }

      if (!isDuplicateScore) {
        awardedPoints = verification.awardedPoints;
        const { data: player } = await supabaseAdmin
          .from('players')
          .select('total_xp')
          .eq('id', trustedPlayerId)
          .single();
        const nextTotalXp = Math.max(0, (player?.total_xp || 0) + awardedPoints);
        await supabaseAdmin
          .from('players')
          .update({ total_xp: nextTotalXp, level: Math.floor(nextTotalXp / 250) + 1 })
          .eq('id', trustedPlayerId);
      }

      const drawingUpsert = await supabaseAdmin.from('drawing_entry_ledger').upsert(
        {
          event_id: trustedParams.eventId,
          player_id: trustedPlayerId,
          quest_id: trustedParams.questId,
          submission_id: dbSub.id,
          entries_count: verification.drawingEntriesAwarded,
          source_type: 'quest_completion',
          reason: `Completed quest: ${quest.title}`,
        },
        { onConflict: 'event_id,player_id,quest_id' }
      );
      if (drawingUpsert.error) {
        throw new Error(drawingUpsert.error.message);
      }
      drawingEntriesAwarded = awardedPoints > 0 ? verification.drawingEntriesAwarded : 0;
    }

    const submission = mapSubmissionFromDB({
      ...dbSub,
      awarded_points: awardedPoints,
      drawing_entries_awarded: drawingEntriesAwarded,
    });

    return {
      success: verification.status !== 'rejected',
      submission,
      message: verification.message,
      awardedPoints,
      drawingEntriesAwarded,
      currentStepCompleted: verification.completedStepOrder,
      isQuestFullyCompleted: verification.isQuestFullyCompleted,
    };
  } catch (err: any) {
    console.error('submitQuestProofDB error:', err);
    return failedSubmissionResult(params, err.message || 'Server-authoritative submission failed.');
  }
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
