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
  DrawingStatus,
  CanonicalSnapshotPlayer,
  CanonicalSnapshot,
  EventDrawingLedgerLock,
  DrawMethod,
  PrizeDrawRecord,
  PublicPlayerDrawingEntry,
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
import * as localEngine from './game-engine';

const DRAWABLE_LEDGER_STATUSES: DrawingStatus[] = ['locked', 'drawn'];
const PUBLISHABLE_LEDGER_STATUSES: DrawingStatus[] = ['drawn'];

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

function getServerQuestStepTargetCode(stepId: string): string | undefined {
  if (typeof window !== 'undefined') return undefined;
  const nodeRequire = eval('require') as (id: string) => any;
  const maps = nodeRequire(`${process.cwd()}/lib/quest-proof-secrets.server.json`) as {
    STEP_TARGET_CODE_HASHES?: Record<string, string>;
  };
  return maps.STEP_TARGET_CODE_HASHES?.[stepId];
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

function mapPrizeDrawRecordFromDB(row: any, fallbackPrizeId: string = ''): PrizeDrawRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    prizeId: row.prize_id || fallbackPrizeId,
    prizeTitle: row.prize_title,
    status: row.status as 'drawn' | 'published' | 'cancelled',
    lockedLedgerHash: row.locked_ledger_hash,
    lockedAt: row.locked_at,
    drawMethod: row.draw_method as DrawMethod,
    providerReference: row.provider_reference,
    drawnAt: row.drawn_at,
    winningPlayerId: row.winning_player_id,
    winningPublicPlayerLabel: row.winning_public_player_label,
    selectedWeightedEntryIndex: row.selected_weighted_entry_index,
    auditMetadata: row.audit_metadata,
    publishedAt: row.published_at,
    cancellationReason: row.cancellation_reason,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    createdAt: row.created_at,
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

    const stepRows = SEED_QUESTS.flatMap((q) =>
      (q.steps || []).map((step) => ({
        id: step.id,
        quest_id: q.id,
        step_order: step.stepOrder,
        title: step.title,
        instructions: step.instructions,
        verification_type: step.verificationType,
        target_code: step.targetCode || getServerQuestStepTargetCode(step.id),
        location_id: step.locationId,
        radius_meters: step.radiusMeters,
      }))
    );
    if (stepRows.length > 0) {
      await supabase.from('quest_steps').upsert(stepRows);
    }

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

    if (quest.prerequisiteQuestId) {
      const { data: prerequisiteSubmission, error: prerequisiteError } = await supabaseAdmin
        .from('quest_submissions')
        .select('id')
        .eq('player_id', trustedPlayerId)
        .eq('event_id', trustedParams.eventId)
        .eq('quest_id', quest.prerequisiteQuestId)
        .eq('status', 'verified')
        .maybeSingle();

      if (prerequisiteError || !prerequisiteSubmission) {
        return failedSubmissionResult(
          trustedParams,
          'Quest prerequisite is locked. Complete the previous mission in this chain first.'
        );
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

    // Pre-check: Reject submission immediately if event drawing ledger is locked
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const { data: lockRow } = await supabaseAdmin
        .from('drawing_ledger_locks')
        .select('is_locked, status')
        .eq('event_id', trustedParams.eventId)
        .maybeSingle();

      if (lockRow && (lockRow.is_locked || ['locked', 'drawn', 'published', 'cancelled'].includes(lockRow.status))) {
        return failedSubmissionResult(
          params,
          `Drawing ledger for event ${trustedParams.eventId} is locked. Submissions and reward issuance are prohibited.`
        );
      }
    } else if (localEngine.isDrawingLedgerLocked(trustedParams.eventId)) {
      return failedSubmissionResult(
        params,
        `Drawing ledger for event ${trustedParams.eventId} is locked. Submissions and reward issuance are prohibited.`
      );
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
        // Cleanup on score failure
        await supabaseAdmin.from('quest_submissions').delete().eq('id', dbSub.id);
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
        // Transactional rollback on failed drawing ledger upsert (e.g. database lock trigger)
        await supabaseAdmin.from('score_ledger').delete().eq('submission_id', dbSub.id);
        await supabaseAdmin.from('quest_submissions').delete().eq('id', dbSub.id);
        throw new Error(`Drawing entry rejected: ${drawingUpsert.error.message}`);
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
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.reviewSubmission(submissionId, newStatus, feedback, reviewerNotes);
  }

  const { data: sub } = await supabaseAdmin
    .from('quest_submissions')
    .select('*, quest:quests(*)')
    .eq('id', submissionId)
    .maybeSingle();

  if (!sub) return undefined;

  if (newStatus === 'verified') {
    const { data: lockRow } = await supabaseAdmin
      .from('drawing_ledger_locks')
      .select('is_locked, status')
      .eq('event_id', sub.event_id)
      .maybeSingle();

    if (lockRow && (lockRow.is_locked || ['locked', 'drawn', 'published', 'cancelled'].includes(lockRow.status))) {
      throw new Error(
        `Drawing entry ledger is locked for event ${sub.event_id}. Submissions cannot be verified to alter drawing entries while locked.`
      );
    }
  }

  const reviewedAt = new Date().toISOString();
  const updateData: any = {
    status: newStatus,
    feedback,
    reviewer_notes: reviewerNotes,
    reviewed_at: reviewedAt,
  };

  if (newStatus === 'retry_requested') {
    updateData.retry_requested = true;
  }

  const { data: updatedSub, error } = await supabaseAdmin
    .from('quest_submissions')
    .update(updateData)
    .eq('id', submissionId)
    .select()
    .single();

  if (error || !updatedSub) {
    throw new Error(error?.message || 'Failed to update submission review status.');
  }

  if (newStatus === 'verified') {
    const quest = Array.isArray(sub.quest) ? sub.quest[0] : sub.quest;
    const xp = quest ? (quest.xp_reward || quest.point_value) : 100;
    const entries = quest ? (quest.drawing_entry_reward ?? 1) : 1;

    await supabaseAdmin.from('score_ledger').upsert(
      {
        event_id: sub.event_id,
        player_id: sub.player_id,
        team_id: sub.team_id,
        quest_id: sub.quest_id,
        submission_id: sub.id,
        points: xp,
        category: quest ? quest.category : 'admin_approved',
        description: `Media submission approved for ${quest ? quest.title : 'Quest'}`,
      },
      { onConflict: 'event_id,player_id,quest_id' }
    );

    await supabaseAdmin.from('drawing_entry_ledger').upsert(
      {
        event_id: sub.event_id,
        player_id: sub.player_id,
        quest_id: sub.quest_id,
        submission_id: sub.id,
        entries_count: entries,
        source_type: 'quest_completion',
        reason: `Media submission approved for ${quest ? quest.title : 'Quest'}`,
      },
      { onConflict: 'event_id,player_id,quest_id' }
    );
  }

  return mapSubmissionFromDB(updatedSub);
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

// 10. TRANSPARENT PRIZE DRAWING SYSTEM DB
export async function getDrawingLedgerReviewDB(eventId: string): Promise<DrawingLedgerReview> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.getDrawingLedgerReview(eventId);
  }

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, title')
    .or(`id.eq.${eventId},slug.eq.${eventId}`)
    .maybeSingle();
  const realEventId = event ? event.id : eventId;
  const eventTitle = event ? event.title : 'Canton Quests Event';

  const { data: entries } = await supabaseAdmin
    .from('drawing_entry_ledger')
    .select('player_id, entries_count, players(id, display_name, is_minor)')
    .eq('event_id', realEventId);

  const playerTotals: Record<string, { label: string; entries: number; isMinor?: boolean }> = {};
  let totalQualifiedEntries = 0;

  (entries || []).forEach((e: any) => {
    const count = e.entries_count || 0;
    if (count > 0) {
      totalQualifiedEntries += count;
      const pId = e.player_id;
      if (!playerTotals[pId]) {
        const pObj = Array.isArray(e.players) ? e.players[0] : e.players;
        const isMinor = pObj?.is_minor === true;
        const label = localEngine.getPublicPlayerLabel(
          pObj ? { displayName: pObj.display_name, isMinor } as any : undefined,
          pId
        );
        playerTotals[pId] = { label, entries: 0, isMinor };
      }
      playerTotals[pId].entries += count;
    }
  });

  const playerEntries = Object.entries(playerTotals).map(([playerId, data]) => ({
    playerId,
    publicPlayerLabel: data.label,
    entries: data.entries,
    isMinor: data.isMinor,
  }));

  const { count: pendingCount } = await supabaseAdmin
    .from('quest_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', realEventId)
    .eq('status', 'pending');

  const pendingSubmissionsCount = pendingCount || 0;

  const { data: lockRow } = await supabaseAdmin
    .from('drawing_ledger_locks')
    .select('status, is_locked')
    .eq('event_id', realEventId)
    .maybeSingle();

  const ledgerStatus: DrawingStatus = (lockRow?.status as DrawingStatus) || 'open';

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

export async function lockDrawingLedgerDB(
  eventId: string,
  options?: { lockReason?: string; lockedBy?: string; confirmPendingBypass?: boolean }
): Promise<EventDrawingLedgerLock> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.lockDrawingLedger(eventId, options);
  }

  const review = await getDrawingLedgerReviewDB(eventId);

  // Reject re-locking if ledger is already locked, drawn, published, or cancelled
  if (review.ledgerStatus !== 'open' && review.ledgerStatus !== 'review') {
    const { data: existingLock } = await supabaseAdmin
      .from('drawing_ledger_locks')
      .select('*')
      .eq('event_id', review.eventId)
      .maybeSingle();

    if (existingLock) {
      return {
        eventId: existingLock.event_id,
        isLocked: existingLock.is_locked,
        status: existingLock.status as DrawingStatus,
        lockedAt: existingLock.locked_at,
        lockReason: existingLock.lock_reason,
        lockedBy: existingLock.locked_by,
        snapshotHash: existingLock.snapshot_hash,
        canonicalSnapshot: existingLock.canonical_snapshot as CanonicalSnapshot,
        totalQualifiedEntries: existingLock.total_qualified_entries,
        totalQualifiedPlayers: existingLock.total_qualified_players,
        updatedAt: existingLock.updated_at,
      };
    }
    throw new Error(`Cannot lock drawing ledger: Ledger status is currently '${review.ledgerStatus}'.`);
  }

  if (review.hasPendingSubmissionsWarning && !options?.confirmPendingBypass) {
    throw new Error(
      `Cannot lock drawing ledger: ${review.pendingSubmissionsCount} unresolved submission(s) remain pending. Admin confirmation required.`
    );
  }

  const { data: entries } = await supabaseAdmin
    .from('drawing_entry_ledger')
    .select('player_id, entries_count, players(id, display_name, is_minor)')
    .eq('event_id', review.eventId);

  const playerTotals: Record<string, { label: string; publicParticipantId: string; entries: number }> = {};
  (entries || []).forEach((e: any) => {
    const count = e.entries_count || 0;
    if (count > 0) {
      const pId = e.player_id;
      if (!playerTotals[pId]) {
        const pObj = Array.isArray(e.players) ? e.players[0] : e.players;
        const isMinor = pObj?.is_minor === true;
        const label = localEngine.getPublicPlayerLabel(
          pObj ? { displayName: pObj.display_name, isMinor } as any : undefined,
          pId
        );
        const publicParticipantId = localEngine.getPublicParticipantId(pId, review.eventId);
        playerTotals[pId] = { label, publicParticipantId, entries: 0 };
      }
      playerTotals[pId].entries += count;
    }
  });

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
    eventId: review.eventId,
    players: canonicalPlayers,
  };

  const jsonString = JSON.stringify(canonicalSnapshot);
  const crypto = typeof require === 'function' ? require('crypto') : null;
  if (!crypto) {
    throw new Error('SHA-256 hashing requires Node.js runtime');
  }
  const rawHash = crypto.createHash('sha256').update(jsonString, 'utf8').digest('hex');
  const snapshotHash = `SHA256-${rawHash}`;

  const lockData = {
    event_id: review.eventId,
    is_locked: true,
    status: 'locked',
    locked_at: new Date().toISOString(),
    lock_reason: options?.lockReason || 'Administrative Ledger Freeze',
    locked_by: options?.lockedBy || 'GM Admin',
    snapshot_hash: snapshotHash,
    canonical_snapshot: canonicalSnapshot,
    total_qualified_entries: canonicalPlayers.reduce((sum, p) => sum + p.entries, 0),
    total_qualified_players: canonicalPlayers.length,
    updated_at: new Date().toISOString(),
  };

  const { data: lockRow, error } = await supabaseAdmin
    .from('drawing_ledger_locks')
    .upsert(lockData, { onConflict: 'event_id' })
    .select()
    .single();

  if (error || !lockRow) {
    throw new Error(error?.message || 'Failed to persist drawing ledger lock.');
  }

  return {
    eventId: lockRow.event_id,
    isLocked: lockRow.is_locked,
    status: lockRow.status as DrawingStatus,
    lockedAt: lockRow.locked_at,
    lockReason: lockRow.lock_reason,
    lockedBy: lockRow.locked_by,
    snapshotHash: lockRow.snapshot_hash,
    canonicalSnapshot: lockRow.canonical_snapshot as CanonicalSnapshot,
    totalQualifiedEntries: lockRow.total_qualified_entries,
    totalQualifiedPlayers: lockRow.total_qualified_players,
    updatedAt: lockRow.updated_at,
  };
}

export async function executePrizeDrawDB(params: {
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
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.executePrizeDraw(params);
  }

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id')
    .or(`id.eq.${params.eventId},slug.eq.${params.eventId}`)
    .maybeSingle();
  if (!event) throw new Error(`Event not found: ${params.eventId}`);
  const realEventId = event.id;

  const { data: lockRow } = await supabaseAdmin
    .from('drawing_ledger_locks')
    .select('*')
    .eq('event_id', realEventId)
    .maybeSingle();

  if (!lockRow || !lockRow.is_locked || !lockRow.snapshot_hash || !lockRow.canonical_snapshot) {
    throw new Error('Drawing ledger must be locked before executing a draw.');
  }

  if (lockRow.status === 'cancelled') {
    throw new Error(`Cannot execute prize draw: Drawing ledger for event ${realEventId} is cancelled.`);
  }

  if (!DRAWABLE_LEDGER_STATUSES.includes(lockRow.status as DrawingStatus)) {
    throw new Error(
      `Cannot execute prize draw: Drawing ledger status is "${lockRow.status}". Prize draws are only allowed from a locked or drawn ledger state.`
    );
  }

  const prizeTitle = params.prizeTitle || 'Grand Prize';
  const prizeId = params.prizeId || undefined;

  // Prevent duplicate active draw
  const { data: existingActiveDraw } = await supabaseAdmin
    .from('prize_draw_records')
    .select('id')
    .eq('event_id', realEventId)
    .neq('status', 'cancelled')
    .eq('locked_ledger_hash', lockRow.snapshot_hash)
    .or(`prize_id.eq.${prizeId || '00000000-0000-0000-0000-000000000000'},prize_title.eq.${prizeTitle}`)
    .maybeSingle();

  if (existingActiveDraw) {
    throw new Error(
      `An active draw record already exists for prize "${prizeTitle}" under locked ledger hash ${lockRow.snapshot_hash}. Void/cancel the existing draw record before drawing again.`
    );
  }

  const drawMethod: DrawMethod = params.drawMethod || 'internal_test';
  if (drawMethod === 'internal_test') {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_INTERNAL_TEST_DRAW !== 'true') {
      throw new Error(
        'Internal deterministic test draws are restricted to development and testing environments.'
      );
    }
  }

  const { data: existingDraws } = await supabaseAdmin
    .from('prize_draw_records')
    .select('winning_player_id')
    .eq('event_id', realEventId)
    .neq('status', 'cancelled');

  const excludedPlayerIds = (existingDraws || []).map((d: any) => d.winning_player_id);

  const { data: ledgerEntries } = await supabaseAdmin
    .from('drawing_entry_ledger')
    .select('player_id, players(id, display_name, is_minor)')
    .eq('event_id', realEventId);

  const playerMap: Record<string, { label: string; isMinor?: boolean }> = {};
  (ledgerEntries || []).forEach((e: any) => {
    const pId = e.player_id;
    if (!playerMap[pId]) {
      const pObj = Array.isArray(e.players) ? e.players[0] : e.players;
      const isMinor = pObj?.is_minor === true;
      const label = localEngine.getPublicPlayerLabel(
        pObj ? { displayName: pObj.display_name, isMinor } as any : undefined,
        pId
      );
      playerMap[pId] = { label, isMinor };
    }
  });

  let provider: DrawProvider = localEngine.InternalTestDrawProvider;
  if (drawMethod === 'manual_external') {
    provider = localEngine.ManualExternalDrawProvider;
  } else if (drawMethod === 'random_org') {
    provider = localEngine.RandomOrgFutureDrawProvider;
  }

  const drawResult = await provider.executeDraw({
    eventId: realEventId,
    prizeId: prizeId || `prz-default-${realEventId}`,
    prizeTitle,
    snapshot: lockRow.canonical_snapshot as CanonicalSnapshot,
    playerMap,
    snapshotHash: lockRow.snapshot_hash,
    testSeed: params.testSeed,
    excludedPlayerIds,
    manualWinnerPublicLabel: params.manualWinnerPublicLabel,
    manualWinnerPublicParticipantId: params.manualWinnerPublicParticipantId,
    manualWinnerPlayerId: params.manualWinnerPlayerId,
    providerReference: params.providerReference,
    auditMetadata: params.auditMetadata,
  });

  const drawRecordPayload = {
    event_id: realEventId,
    prize_id: prizeId,
    prize_title: prizeTitle,
    status: 'drawn',
    locked_ledger_hash: lockRow.snapshot_hash,
    locked_at: lockRow.locked_at || new Date().toISOString(),
    draw_method: drawResult.drawMethod,
    provider_reference: drawResult.providerReference,
    drawn_at: new Date().toISOString(),
    winning_player_id: drawResult.winningPlayerId,
    winning_public_player_label: drawResult.winningPublicPlayerLabel,
    selected_weighted_entry_index: drawResult.selectedWeightedEntryIndex,
    audit_metadata: drawResult.auditMetadata,
    created_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabaseAdmin.rpc('execute_prize_draw_if_drawable', {
    p_event_id: realEventId,
    p_allowed_statuses: DRAWABLE_LEDGER_STATUSES,
    p_draw_record: drawRecordPayload,
  });

  if (error || !inserted) {
    throw new Error(error?.message || 'Failed to insert prize draw record.');
  }

  const insertedRow = Array.isArray(inserted) ? inserted[0] : inserted;

  return mapPrizeDrawRecordFromDB(insertedRow, prizeId || '');
}

export async function cancelDrawingLedgerDB(
  eventId: string,
  reason?: string,
  adminIdentity?: string
): Promise<EventDrawingLedgerLock> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.cancelDrawingLedger(eventId, reason, adminIdentity);
  }

  const { data: lockRow, error } = await supabaseAdmin
    .from('drawing_ledger_locks')
    .update({
      status: 'cancelled',
      is_locked: true,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .select()
    .single();

  if (error || !lockRow) {
    throw new Error(error?.message || `Failed to cancel drawing ledger for event ${eventId}`);
  }

  return {
    eventId: lockRow.event_id,
    isLocked: lockRow.is_locked,
    status: lockRow.status as DrawingStatus,
    lockedAt: lockRow.locked_at,
    lockReason: lockRow.lock_reason,
    lockedBy: lockRow.locked_by,
    snapshotHash: lockRow.snapshot_hash,
    canonicalSnapshot: lockRow.canonical_snapshot as CanonicalSnapshot,
    totalQualifiedEntries: lockRow.total_qualified_entries,
    totalQualifiedPlayers: lockRow.total_qualified_players,
    updatedAt: lockRow.updated_at,
  };
}

export async function publishDrawingResultsDB(eventId: string, adminIdentity?: string): Promise<PrizeDrawRecord[]> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.publishDrawingResults(eventId, adminIdentity);
  }

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id')
    .or(`id.eq.${eventId},slug.eq.${eventId}`)
    .maybeSingle();
  if (!event) throw new Error(`Event not found: ${eventId}`);
  const realEventId = event.id;

  const { data: lockRow } = await supabaseAdmin
    .from('drawing_ledger_locks')
    .select('*')
    .eq('event_id', realEventId)
    .maybeSingle();

  if (!lockRow || !lockRow.is_locked) {
    throw new Error(`Cannot publish drawing results: Drawing ledger for event ${eventId} is not locked.`);
  }
  if (lockRow.status === 'cancelled') {
    throw new Error(`Cannot publish drawing results: Drawing ledger for event ${eventId} is cancelled.`);
  }
  if (!PUBLISHABLE_LEDGER_STATUSES.includes(lockRow.status as DrawingStatus)) {
    throw new Error(
      `Cannot publish drawing results: Drawing ledger status is "${lockRow.status}". Publishing is only allowed from a drawn ledger state.`
    );
  }

  const now = new Date().toISOString();

  const { data: publishedDraws, error } = await supabaseAdmin.rpc('publish_prize_draws_if_publishable', {
    p_event_id: realEventId,
    p_allowed_statuses: PUBLISHABLE_LEDGER_STATUSES,
    p_published_at: now,
  });

  if (error) {
    throw new Error(error.message || 'Failed to publish drawing results.');
  }

  if (!publishedDraws || publishedDraws.length === 0) {
    const { data: existingPublished } = await supabaseAdmin
      .from('prize_draw_records')
      .select('*')
      .eq('event_id', realEventId)
      .eq('status', 'published');
    if (existingPublished && existingPublished.length > 0) {
      return existingPublished.map((d: any) => mapPrizeDrawRecordFromDB(d));
    }
    throw new Error('No completed draws found to publish.');
  }
  return publishedDraws.map((d: any) => mapPrizeDrawRecordFromDB(d));
}

export async function voidPrizeDrawRecordDB(
  eventId: string,
  drawRecordId: string,
  cancellationReason: string,
  adminIdentity?: string
): Promise<PrizeDrawRecord> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.voidPrizeDrawRecord(eventId, drawRecordId, cancellationReason, adminIdentity);
  }

  if (!cancellationReason || cancellationReason.trim().length < 5) {
    throw new Error('An explicit audit reason is required to void or cancel a prize drawing record.');
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('prize_draw_records')
    .update({
      status: 'cancelled',
      cancellation_reason: cancellationReason.trim(),
      cancelled_at: now,
      cancelled_by: adminIdentity || 'GM Admin',
    })
    .eq('id', drawRecordId)
    .select()
    .single();

  if (error || !updated) {
    throw new Error(`Draw record not found or void failed: ${drawRecordId}`);
  }

  const { count: activeCount } = await supabaseAdmin
    .from('prize_draw_records')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', updated.event_id)
    .neq('status', 'cancelled');

  if (activeCount === 0) {
    await supabaseAdmin
      .from('drawing_ledger_locks')
      .update({ status: 'locked', updated_at: now })
      .eq('event_id', updated.event_id);
  }

  return {
    id: updated.id,
    eventId: updated.event_id,
    prizeId: updated.prize_id || '',
    prizeTitle: updated.prize_title,
    status: updated.status as 'drawn' | 'published' | 'cancelled',
    lockedLedgerHash: updated.locked_ledger_hash,
    lockedAt: updated.locked_at,
    drawMethod: updated.draw_method as DrawMethod,
    providerReference: updated.provider_reference,
    drawnAt: updated.drawn_at,
    winningPlayerId: updated.winning_player_id,
    winningPublicPlayerLabel: updated.winning_public_player_label,
    selectedWeightedEntryIndex: updated.selected_weighted_entry_index,
    auditMetadata: updated.audit_metadata,
    publishedAt: updated.published_at,
    cancellationReason: updated.cancellation_reason,
    cancelledAt: updated.cancelled_at,
    cancelledBy: updated.cancelled_by,
    createdAt: updated.created_at,
  };
}

export async function getPublicDrawingPageDataDB(eventId: string): Promise<PublicDrawingPageData> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.getPublicDrawingPageData(eventId);
  }

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, title')
    .or(`id.eq.${eventId},slug.eq.${eventId}`)
    .maybeSingle();
  const realEventId = event ? event.id : eventId;
  const eventTitle = event ? event.title : 'Canton Quests Event';

  const { data: lockRow } = await supabaseAdmin
    .from('drawing_ledger_locks')
    .select('*')
    .eq('event_id', realEventId)
    .maybeSingle();

  const { data: projectionRows } = await supabaseAdmin
    .from('public_drawing_ledger_projection')
    .select('player_public_label, total_qualified_entries')
    .eq('event_id', realEventId);

  const publicPlayerEntries: PublicPlayerDrawingEntry[] = (projectionRows || []).map((row: any) => ({
    playerPublicLabel: row.player_public_label,
    totalQualifiedEntries: row.total_qualified_entries,
  }));

  const totalQualifiedEntries = publicPlayerEntries.reduce((sum, p) => sum + p.totalQualifiedEntries, 0);

  const { data: publishedRows } = await supabaseAdmin
    .from('public_published_drawings_projection')
    .select('*')
    .eq('event_id', realEventId);

  const publishedPrizes: PublicPrizeDrawResult[] = (publishedRows || []).map((row: any) => ({
    drawRecordId: row.draw_record_id,
    prizeId: row.prize_id || '',
    prizeTitle: row.prize_title,
    winnerPublicLabel: row.winner_public_label,
    drawMethod: row.draw_method,
    providerReference: row.provider_reference,
    drawnAt: row.drawn_at,
    verificationStatus: row.verification_status || row.audit_metadata?.verificationStatus || (row.draw_method === 'manual_external' ? 'manual_unverified' : 'internal_seeded'),
    isSystemVerified: row.is_system_verified ?? row.audit_metadata?.isSystemVerified ?? false,
    isIndependent: row.is_independent ?? row.audit_metadata?.isIndependent ?? false,
  }));

  const ledgerLockStatus: DrawingStatus = (lockRow?.status as DrawingStatus) || 'open';
  const firstPublished = publishedRows && publishedRows.length > 0 ? publishedRows[0] : null;

  return {
    eventId: realEventId,
    eventTitle,
    ledgerLockStatus,
    ledgerLockTimestamp: lockRow?.is_locked ? lockRow.locked_at || null : null,
    snapshotHash: lockRow?.snapshot_hash || null,
    canonicalSnapshot: lockRow?.canonical_snapshot || null,
    totalQualifiedEntries,
    totalQualifiedPlayers: publicPlayerEntries.length,
    publicPlayerEntries,
    publishedPrizes,
    publishedAt: firstPublished ? firstPublished.published_at || null : null,
    verificationInfo: lockRow?.snapshot_hash
      ? `This drawing entry pool was finalized and cryptographically hashed (SHA-256: ${lockRow.snapshot_hash}) on ${lockRow.locked_at}. The winner selection is tied directly to the frozen canonical snapshot.`
      : undefined,
  };
}
