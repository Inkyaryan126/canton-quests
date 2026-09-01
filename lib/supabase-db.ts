// Canton Quests — Supabase Database Service Layer (Phase 4 Event Factory)

import { supabase, supabaseAdmin, isSupabaseConfigured, isSupabaseAdminConfigured } from './supabase';
import {
  City,
  QuestEvent,
  LocationInfo,
  Quest,
  Player,
  QuestSubmission,
  DrawingEntryLedgerEntry,
  ScoreLedgerEntry,
  LeaderboardEntry,
  PlayerEventProgress,
  EventParticipation,
  SubmitProofParams,
  SubmitProofResult,
  EventActivityItem,
  EventPhaseType,
  LiveAnnouncement,
  SecretCode,
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
  PublicRosterEntry,
  PublicDrawingPageData,
  AuthenticatedPlayerDrawingQualification,
  DrawingLedgerReview,
  DrawProvider,
  ProofVerificationType,
  RewardGrantReason,
  QuestPlacementDetails,
} from './types';
import {
  computeAwardedBonusesForSubmission,
  getEffectiveBaseXp,
  getQuestAvailability,
  getRaceBonusTiers,
  getUnlockSummary,
} from './quest-rewards';
import {
  SEED_CITY,
  SEED_LOCATIONS,
  SEED_EVENT,
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
} from './seed-data';
import * as localEngine from './game-engine';
import {
  resolveAuthenticatedPlayerId as resolveAuthPlayerIdHelper,
  resolveAuthenticatedPlayer as resolveAuthPlayerHelper,
  resolveAuthenticatedSupabaseUser,
  sanitizePlayerForPublic,
} from './supabase-auth';
import { grantCipherFragmentsForQuestRewardDB } from './founders-cipher';
import { getActiveLiveEventMultiplierDB, getActiveLiveEventsDB, incrementLiveEventProgressDB } from './live-events-db';
import { isKnownCantonLaunchSlug } from './launch-status';

const DRAWABLE_LEDGER_STATUSES: DrawingStatus[] = ['locked', 'drawn'];
const PUBLISHABLE_LEDGER_STATUSES: DrawingStatus[] = ['drawn'];

import {
  getServerQuestTargetCode,
  getServerQuestStepTargetCode,
  proofDigest,
  proofMatches,
  proofMatchesAny,
} from './quest-proof-secrets';
import { isProfileIdentityComplete, resolveAvatarUrl } from './player-command-center';


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
    acceptedAnswerVariants: row.accepted_answer_variants || undefined,
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
    placementDetails: row.placement_details || undefined,
    placedAt: row.placed_at || undefined,
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
    startingPath: (row.starting_path as QuestPath) || 'family',
    rewardConfig: row.reward_config || undefined,
    acceptedAnswerVariants: row.accepted_answer_variants || undefined,
    remoteCapable: row.remote_capable || undefined,
    commanderTransmission: row.commander_transmission || undefined,
    sectorIntroTransmission: row.sector_intro_transmission || undefined,
    milestoneTransmission: row.milestone_transmission || undefined,
    completionTransmission: row.completion_transmission || undefined,
    discoveryTransmission: row.discovery_transmission || undefined,
  };
}

export function mapPlayerFromDB(row: any): Player {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || '⚡',
    avatarPresetKey: row.avatar_preset_key,
    profileImagePath: row.profile_image_path,
    profileImageCropZoom: row.profile_image_crop_zoom,
    profileImageCropX: row.profile_image_crop_x,
    profileImageCropY: row.profile_image_crop_y,
    // Profile and player-image privacy toggles have been retired — every
    // player is always public regardless of what's still stored in these
    // legacy columns (kept for schema compatibility, not consulted for
    // any access-control decision).
    profileVisibility: 'public',
    playerImageVisibility: 'public',
    role: row.role || 'player',
    totalXp: row.total_xp || 0,
    level: row.level || 1,
    selectedStartingPath: (row.selected_starting_path as StartingPath) || undefined,
    acquisitionSource: row.acquisition_source || 'main_site',
    bio: row.bio,
    tagline: row.tagline,
    hometown: row.hometown,
    themeColor: row.theme_color,
    favoriteStyle: row.favorite_style,
    selectedFlair: row.selected_flair,
    showcaseBadges: row.showcase_badges,
    featuredBadgeSlugs: row.featured_badge_slugs,
    isMinor: row.is_minor,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    requiresPath: row.requires_path || false,
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

async function resolveAuthenticatedPlayerId(
  requestOrToken?: Request | string | { request?: Request; accessToken?: string; refreshToken?: string } | null
): Promise<string> {
  return resolveAuthPlayerIdHelper(requestOrToken);
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

  const availability = getQuestAvailability(quest);
  if (!availability.ok) {
    return fail(availability.message);
  }

  if (quest.verificationType === 'checkin' || quest.verificationType === 'gps' || quest.requireLocationVerification) {
    const gps = verifyGps();
    if (!gps.ok) return fail(gps.message, gps.distance);
    if (quest.verificationType === 'gps' || quest.verificationType === 'checkin') {
      return verifiedReward(gps.message, undefined, gps.distance);
    }
  }

  if (quest.verificationType === 'passphrase' || quest.verificationType === 'qr') {
    if (proofMatchesAny(params.submittedContent, quest.targetCode, quest.acceptedAnswerVariants)) {
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
      if (!proofMatchesAny(params.submittedContent, step.targetCode, step.acceptedAnswerVariants)) return fail(`Step ${requestedStepIdx + 1} verification failed.`);
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
      reward_config: q.rewardConfig || null,
      accepted_answer_variants: q.acceptedAnswerVariants || null,
      remote_capable: q.remoteCapable || false,
      commander_transmission: q.commanderTransmission || null,
      sector_intro_transmission: q.sectorIntroTransmission || null,
      milestone_transmission: q.milestoneTransmission || null,
      completion_transmission: q.completionTransmission || null,
      discovery_transmission: q.discoveryTransmission || null,
    }));
    await supabase.from('quests').upsert(questRows);

    const collectibleRows = SEED_COLLECTIBLES.map((c) => ({
      name: c.name,
      slug: c.slug,
      description: c.description,
      badge_symbol: c.badgeSymbol,
      rarity: c.rarity,
    }));
    await supabase.from('collectibles').upsert(collectibleRows, { onConflict: 'slug' });

    const stepRows = SEED_QUESTS.flatMap((q) =>
      (q.steps || []).map((step) => ({
        id: step.id,
        quest_id: q.id,
        step_order: step.stepOrder,
        title: step.title,
        instructions: step.instructions,
        verification_type: step.verificationType,
        target_code: step.targetCode || getServerQuestStepTargetCode(step.id),
        accepted_answer_variants: step.acceptedAnswerVariants || null,
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
  // Ascending (oldest first) so the flagship Sept 11 Main Operation — the
  // earliest-created event — reliably sorts first and remains
  // getActiveEvent()'s pick whenever more than one Operation has
  // status='active' simultaneously (e.g. once the Fair QR Hunt is live
  // alongside it), matching local/offline seed ordering.
  const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: true });
  if (error || !data || data.length === 0) return localEngine.getEvents();
  return data.map(mapEventFromDB);
}

export async function getEventBySlugDB(slug: string): Promise<QuestEvent | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getEventBySlug(slug);
  const { data, error } = await supabase.from('events').select('*').eq('slug', slug).single();
  if (error || !data) return localEngine.getEventBySlug(slug);
  return mapEventFromDB(data);
}

export async function getEventByIdDB(eventId: string): Promise<QuestEvent | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getEvents().find((e) => e.id === eventId);
  const { data, error } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
  if (error || !data) return undefined;
  return mapEventFromDB(data);
}

function mapEventParticipationFromDB(row: any): EventParticipation {
  return {
    id: row.id,
    eventId: row.event_id,
    playerId: row.player_id,
    path: row.path || null,
    registeredAt: row.registered_at,
  };
}

// -----------------------------------------------------------------------------
// Operation Participation (event_players) — the canonical "this player
// entered this Operation" record. Distinct from the player's permanent
// identity (players table). event_players.path is a LEGACY field from an
// earlier architecture that scoped path to one Operation — it is still
// written for backward compatibility (existing rows are never destroyed)
// but is no longer read as the source of truth anywhere in the app.
// players.selected_starting_path is the canonical, universal path: it
// belongs to the player, not to any one Operation, and is what everything
// outside this file should read.
// -----------------------------------------------------------------------------

export async function getEventParticipationDB(eventId: string, playerId: string): Promise<EventParticipation | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getEventParticipation(eventId, playerId);
  const db = supabaseAdmin || supabase;
  const { data, error } = await db
    .from('event_players')
    .select('*')
    .eq('event_id', eventId)
    .eq('player_id', playerId)
    .maybeSingle();
  if (error || !data) return undefined;
  return mapEventParticipationFromDB(data);
}

/**
 * Finds or creates the (event_id, player_id) participation record.
 * Relies on event_players' real UNIQUE(event_id, player_id) constraint via
 * upsert-with-ignoreDuplicates, so a duplicate-entry race can never create a
 * second row — the loser of the race simply re-reads the winner's row. An
 * existing non-null path is never overwritten; a supplied path only fills a
 * previously-empty one (a player choosing their path after already
 * entering the Operation).
 */
export async function getOrCreateEventParticipationDB(
  eventId: string,
  playerId: string,
  path?: StartingPath | null
): Promise<EventParticipation> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.getOrCreateEventParticipation(eventId, playerId, path);
  }
  const db = supabaseAdmin;

  const existing = await getEventParticipationDB(eventId, playerId);
  if (existing) {
    if (path && !existing.path) {
      const { data, error } = await db
        .from('event_players')
        .update({ path })
        .eq('id', existing.id)
        .select()
        .single();
      if (!error && data) return mapEventParticipationFromDB(data);
    }
    return existing;
  }

  const { data, error } = await db
    .from('event_players')
    .upsert(
      { event_id: eventId, player_id: playerId, path: path || null },
      { onConflict: 'event_id,player_id', ignoreDuplicates: false }
    )
    .select()
    .single();
  if (error || !data) {
    // Lost a create race against a concurrent request — read back the winner's row.
    const winner = await getEventParticipationDB(eventId, playerId);
    if (winner) return winner;
    throw new Error(`Failed to create Operation participation: ${error?.message}`);
  }
  return mapEventParticipationFromDB(data);
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
function mapCollectibleFromDB(row: any): Collectible {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    badgeSymbol: row.badge_symbol,
    rarity: row.rarity,
  };
}

export async function getCollectiblesForPlayerDB(playerId: string): Promise<PlayerCollectible[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getCollectiblesForPlayer(playerId);
  const db = supabaseAdmin || supabase;
  const { data, error } = await db
    .from('player_collectibles')
    .select('*, collectibles(*)')
    .eq('player_id', playerId);
  if (error || !data) return localEngine.getCollectiblesForPlayer(playerId);
  return data.map((row: any) => ({
    id: row.id,
    playerId: row.player_id,
    eventId: row.event_id,
    collectibleId: row.collectible_id,
    earnedAt: row.earned_at,
    source: row.source,
    collectible: row.collectibles ? mapCollectibleFromDB(row.collectibles) : undefined,
  }));
}

/**
 * Resolves the seed-catalog string id used in QuestRewardConfig (e.g.
 * 'col-founder-word') to the collectible's real slug, since Supabase's
 * collectibles.id is a generated UUID that never matches the seed id.
 * Falls back to treating the input as a slug already, so real ops content
 * can set collectibleUnlockIds directly to a slug without going through
 * the demo catalog.
 */
function resolveCollectibleSlug(collectibleIdOrSlug: string): string {
  const seedMatch = SEED_COLLECTIBLES.find((c) => c.id === collectibleIdOrSlug);
  return seedMatch ? seedMatch.slug : collectibleIdOrSlug;
}

/** Idempotent collectible grant — safe to call repeatedly for an already-owned collectible. */
export async function awardCollectibleDB(
  playerId: string,
  collectibleIdOrSlug: string,
  source: string = 'quest',
  eventId?: string
): Promise<Collectible | undefined> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.awardCollectible(playerId, collectibleIdOrSlug, source, eventId);
  }
  const slug = resolveCollectibleSlug(collectibleIdOrSlug);

  const { data: item } = await supabaseAdmin.from('collectibles').select('*').eq('slug', slug).maybeSingle();
  if (!item) return localEngine.awardCollectible(playerId, collectibleIdOrSlug, source, eventId);

  const { data: existing } = await supabaseAdmin
    .from('player_collectibles')
    .select('id')
    .eq('player_id', playerId)
    .eq('collectible_id', item.id)
    .maybeSingle();

  if (!existing) {
    await supabaseAdmin.from('player_collectibles').insert({
      player_id: playerId,
      collectible_id: item.id,
      source,
      ...(eventId ? { event_id: eventId } : {}),
    });
  }

  return mapCollectibleFromDB(item);
}

/** Idempotent finale-qualification grant, backed by finale_qualifications' UNIQUE(event_id, player_id). */
export async function grantFinaleQualificationDB(
  eventId: string,
  playerId: string,
  reason: string,
  isWildcard: boolean = false
): Promise<FinaleQualification | undefined> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.grantFinaleQualification(eventId, playerId, reason, isWildcard);
  }

  const { data: existing } = await supabaseAdmin
    .from('finale_qualifications')
    .select('*')
    .eq('event_id', eventId)
    .eq('player_id', playerId)
    .maybeSingle();
  if (existing) {
    return {
      id: existing.id,
      eventId: existing.event_id,
      playerId: existing.player_id,
      qualifiedAt: existing.qualified_at,
      qualificationReason: existing.qualification_reason,
      isWildcard: existing.is_wildcard,
    };
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('finale_qualifications')
    .insert({
      event_id: eventId,
      player_id: playerId,
      qualification_reason: reason,
      is_wildcard: isWildcard,
    })
    .select()
    .single();

  if (error || !inserted) return localEngine.grantFinaleQualification(eventId, playerId, reason, isWildcard);

  return {
    id: inserted.id,
    eventId: inserted.event_id,
    playerId: inserted.player_id,
    qualifiedAt: inserted.qualified_at,
    qualificationReason: inserted.qualification_reason,
    isWildcard: inserted.is_wildcard,
  };
}

/**
 * Inserts one reward_grants audit row, or returns null if this exact
 * (submissionId, rewardType, rewardKey) grant already exists — the core
 * idempotency gate for the shared reward-granting transaction below.
 */
export async function insertRewardGrantDB(entry: {
  eventId: string;
  playerId: string;
  questId?: string;
  submissionId?: string;
  rewardType: RewardGrantReason;
  rewardKey: string;
  xpAwarded?: number;
  drawingEntriesAwarded?: number;
}): Promise<boolean> {
  if (!supabaseAdmin) return true;
  const { error } = await supabaseAdmin.from('reward_grants').insert({
    event_id: entry.eventId,
    player_id: entry.playerId,
    quest_id: entry.questId,
    submission_id: entry.submissionId,
    reward_type: entry.rewardType,
    reward_key: entry.rewardKey,
    xp_awarded: entry.xpAwarded || 0,
    drawing_entries_awarded: entry.drawingEntriesAwarded || 0,
  });
  if (error) {
    if (error.code === '23505') return false; // duplicate — already granted
    throw new Error(`Failed to record reward grant (${entry.rewardType}/${entry.rewardKey}): ${error.message}`);
  }
  return true;
}

/**
 * The one-time Player Identity onboarding reward: +100 XP, no Entry Token,
 * no drawing_entry_ledger write. Call this after any profile mutation
 * capable of satisfying either requirement (starting path change, avatar
 * preset selection, custom photo upload/delete) — it always re-loads the
 * player's current authoritative row and is a safe no-op if the player
 * isn't (yet, or any longer relevantly) qualified, or if this exact grant
 * (player_id + PROFILE_COMPLETION + profile_identity_complete) already
 * exists. Idempotency is enforced by reward_grants' partial unique index
 * on quest_id IS NULL rows (see migration
 * 20260825000000_profile_completion_reward.sql) — a duplicate insert from
 * a race between two concurrent qualifying requests hits Postgres error
 * 23505 and this returns newlyGranted: false, never double-awarding XP.
 */
export async function evaluateAndGrantProfileCompletionRewardDB(
  playerId: string
): Promise<{ newlyGranted: boolean; xpAwarded: number; newAchievement?: PlayerAchievement }> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.evaluateAndGrantProfileCompletionReward(playerId);
  }
  const db = supabaseAdmin;

  const { data: playerRow, error: playerError } = await db
    .from('players')
    .select('id, selected_starting_path, avatar_preset_key, profile_image_path')
    .eq('id', playerId)
    .maybeSingle();
  if (playerError || !playerRow) return { newlyGranted: false, xpAwarded: 0 };

  const qualifies = isProfileIdentityComplete({
    avatarPresetKey: playerRow.avatar_preset_key || undefined,
    profileImagePath: playerRow.profile_image_path || undefined,
  });
  if (!qualifies) return { newlyGranted: false, xpAwarded: 0 };

  const event = await getEventBySlugDB(SEED_EVENT.slug);
  if (!event) return { newlyGranted: false, xpAwarded: 0 };

  const xpAwarded = 100;
  const isNewGrant = await insertRewardGrantDB({
    eventId: event.id,
    playerId,
    rewardType: 'PROFILE_COMPLETION',
    rewardKey: 'profile_identity_complete',
    xpAwarded,
  });
  if (!isNewGrant) return { newlyGranted: false, xpAwarded: 0 };

  const scoreInsert = await db.from('score_ledger').insert({
    event_id: event.id,
    player_id: playerId,
    points: xpAwarded,
    category: 'profile_completion',
    description: 'Player identity complete — avatar selected',
  });
  if (scoreInsert.error) {
    throw new Error(`Failed to record profile completion score ledger entry: ${scoreInsert.error.message}`);
  }

  const { data: currentPlayer, error: fetchError } = await db
    .from('players')
    .select('total_xp')
    .eq('id', playerId)
    .single();
  if (fetchError) throw new Error(`Failed to read player profile: ${fetchError.message}`);

  const nextTotalXp = Math.max(0, (currentPlayer?.total_xp || 0) + xpAwarded);
  const { error: updateError } = await db
    .from('players')
    .update({ total_xp: nextTotalXp, level: Math.floor(nextTotalXp / 250) + 1 })
    .eq('id', playerId);
  if (updateError) throw new Error(`Failed to update player XP: ${updateError.message}`);

  // "Field Ready" pre-launch badge — piggybacks on this same identity-
  // complete moment. Idempotent on its own via player_achievements'
  // UNIQUE(player_id, achievement_slug), so this is safe even though the
  // XP grant above already gates on isNewGrant.
  const newAchievement = await awardAchievementDB(playerId, 'field-ready', event.id, 'Player identity complete — avatar selected');

  return { newlyGranted: true, xpAwarded, newAchievement };
}

const THREE_LOCKS_COLLECTIBLE_IDS = ['col-founder-mark', 'col-founder-code', 'col-founder-word'];

/**
 * The single reward-granting transaction for a verified/GM-approved quest
 * completion — called by both submitQuestProofDB and reviewSubmissionDB so
 * every reward type is applied exactly once, from exactly one place,
 * regardless of which path verified the submission. Guarded by a
 * reward_grants QUEST_BASE row keyed on submissionId: a retried/duplicated
 * call for the same submission is a no-op beyond that first insert.
 *
 * score_ledger still receives exactly one combined-points row per quest
 * completion (base + eligible bonuses + race bonus), preserving today's
 * leaderboard math and the partial unique index on score_ledger untouched.
 * reward_grants is the new per-component audit trail.
 */
export async function awardQuestRewardsDB(params: {
  quest: Quest;
  eventId: string;
  playerId: string;
  teamId?: string;
  submissionId: string;
  method: ProofVerificationType;
  usedNfc?: boolean;
  bonusMultiplier?: number;
  extraFlatXp?: number;
  scoreDescription?: string;
}): Promise<{
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
  newAchievements: Array<{ id: string; title: string; description: string; icon?: string }>;
}> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    throw new Error('awardQuestRewardsDB requires Supabase service-role configuration.');
  }
  const { quest, eventId, playerId, submissionId, method } = params;
  const db = supabaseAdmin;

  // Live-event XP multiplier (lib/live-events.ts) — callers essentially
  // never pass bonusMultiplier explicitly today, so this is where an active
  // XP_MULTIPLIER live event actually reaches real reward math. A caller
  // that does pass one explicitly is trusted over the live-event lookup.
  const questSectorScope: StartingPath | undefined =
    quest.startingPath === 'family' || quest.startingPath === 'challenge' || quest.startingPath === 'secret'
      ? quest.startingPath
      : undefined;
  const multiplier = params.bonusMultiplier ?? (await getActiveLiveEventMultiplierDB(eventId, questSectorScope));
  const rawBaseXp = getEffectiveBaseXp(quest);
  const multipliedBaseXp = Math.round(rawBaseXp * multiplier);

  // QUEST_BASE is granted at most once per player+quest, ever (reward_grants'
  // unique index is player+quest scoped, not submission scoped) — regardless
  // of how many submissions this quest receives. A remoteCapable quest's
  // later field/photo submission finds this already granted and simply
  // skips re-awarding it, while this call still evaluates its own bonuses.
  const isNewBase = await insertRewardGrantDB({
    eventId,
    playerId,
    questId: quest.id,
    submissionId,
    rewardType: 'QUEST_BASE',
    rewardKey: quest.id,
    xpAwarded: multipliedBaseXp,
  });

  // Race placement/hard-mode bonus only ever apply to the completion itself,
  // never to a later supplemental bonus-only submission.
  let claimPlacement: number | undefined;
  if (isNewBase && getRaceBonusTiers(quest).length > 0) {
    const { data: claimResult, error: claimError } = await db.rpc('claim_quest_placement', { p_quest_id: quest.id });
    if (claimError) throw new Error(`Failed to determine race placement: ${claimError.message}`);
    claimPlacement = claimResult as number;
  }
  const extraFlatXp = isNewBase ? params.extraFlatXp || 0 : 0;

  // Community milestones (lib/live-events.ts) advance on a genuine new quest
  // completion only — never on a supplemental field/photo submission for a
  // quest already completed, matching the same isNewBase gate used for the
  // race-placement claim and base XP above. Multiple simultaneous milestones
  // (e.g. a 100-completions and a 500-completions live event both active at
  // once) each advance independently; the RPC's row lock makes each
  // increment concurrency-safe and each threshold-cross reported at most once.
  if (isNewBase) {
    try {
      const activeMilestones = (await getActiveLiveEventsDB(eventId)).filter((le) => le.eventType === 'COMMUNITY_MILESTONE');
      for (const milestone of activeMilestones) {
        await incrementLiveEventProgressDB(milestone.id, eventId, 1);
      }
    } catch {
      // Milestone progress is observability/celebration on top of a real
      // completion that has already been recorded — never fail the reward
      // grant transaction over it.
    }
  }

  const bonuses = computeAwardedBonusesForSubmission(quest, { method, racePlacement: claimPlacement, usedNfc: params.usedNfc });

  const BONUS_REASON: Record<string, RewardGrantReason> = {
    fieldCheckIn: 'QUEST_FIELD_CHECKIN',
    nfc: 'QUEST_NFC',
    photoVideo: 'QUEST_PHOTO_VIDEO',
  };
  let newBonusXp = 0;
  for (const item of bonuses.lineItems) {
    const granted = await insertRewardGrantDB({
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
    const granted = await insertRewardGrantDB({
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
    const scoreInsert = await db.from('score_ledger').insert({
      event_id: eventId,
      player_id: playerId,
      team_id: params.teamId,
      quest_id: quest.id,
      submission_id: submissionId,
      points: totalXp,
      category: isNewBase ? 'quest_completion' : 'quest_bonus',
      description: params.scoreDescription || `Completed ${quest.title}`,
    });
    const isDuplicateScore = scoreInsert.error?.code === '23505';
    if (scoreInsert.error && !isDuplicateScore) {
      throw new Error(`Failed to record score ledger entry: ${scoreInsert.error.message}`);
    }

    // Only mutate the player's running total when the score_ledger insert
    // actually landed a new row — a concurrent duplicate base-completion
    // insert hitting score_ledger's partial unique index must not also
    // double-add XP to the player's total.
    if (!isDuplicateScore) {
      const { data: player, error: playerFetchError } = await db
        .from('players')
        .select('total_xp')
        .eq('id', playerId)
        .single();
      if (playerFetchError) throw new Error(`Failed to read player profile: ${playerFetchError.message}`);

      const nextTotalXp = Math.max(0, (player?.total_xp || 0) + totalXp);
      const { error: playerUpdateError } = await db
        .from('players')
        .update({ total_xp: nextTotalXp, level: Math.floor(nextTotalXp / 250) + 1 })
        .eq('id', playerId);
      if (playerUpdateError) throw new Error(`Failed to update player XP: ${playerUpdateError.message}`);
    }
  }

  const { data: lockRow } = await db
    .from('drawing_ledger_locks')
    .select('is_locked, status')
    .eq('event_id', eventId)
    .maybeSingle();
  const drawingLocked = !!(lockRow && (lockRow.is_locked || ['locked', 'drawn', 'published', 'cancelled'].includes(lockRow.status)));

  // Entry Tokens: the base completion entry is due exactly once (the base
  // grant), and each configured bonus source (rewardConfig.drawingEntryBonus,
  // unconditional; an NFC cache's nfcCacheEntryBonus, only when this
  // submission's usedNfc is true) is independently gated — so a
  // supplemental field/photo/NFC submission never re-claims the base
  // entry, and using NFC on one call doesn't block a differently-sourced
  // bonus from landing on another. XP-only bonuses never produce an entry.
  let newEntriesThisCall = 0;
  if (isNewBase) {
    newEntriesThisCall += bonuses.baseDrawingEntries;
  }
  if (bonuses.drawingEntryBonusAmount > 0) {
    const granted = await insertRewardGrantDB({
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
    const granted = await insertRewardGrantDB({
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
  if (newEntriesThisCall > 0 && !drawingLocked) {
    const { error: incrementError } = await db.rpc('increment_drawing_entries', {
      p_event_id: eventId,
      p_player_id: playerId,
      p_quest_id: quest.id,
      p_add_entries: newEntriesThisCall,
      p_submission_id: submissionId,
      p_source_type: 'quest_completion',
      p_reason: params.scoreDescription || `Completed quest: ${quest.title}`,
    });
    if (incrementError) throw new Error(`Drawing entry rejected: ${incrementError.message}`);
    drawingEntriesAwarded = newEntriesThisCall;
  }

  const unlocks = getUnlockSummary(quest);
  for (const slug of unlocks.badgeSlugs) {
    const granted = await insertRewardGrantDB({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      rewardType: 'BADGE_UNLOCK',
      rewardKey: slug,
    });
    if (granted) await awardAchievementDB(playerId, slug, eventId, `Quest reward: ${quest.title}`);
  }

  let grantedCollectible: Collectible | undefined;
  let threeLocksFragmentAwarded: 'mark' | 'code' | 'word' | undefined;
  let threeLocksOwned: { mark: boolean; code: boolean; word: boolean } | undefined;
  for (const collectibleId of unlocks.collectibleIds) {
    const granted = await insertRewardGrantDB({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      rewardType: 'COLLECTIBLE_UNLOCK',
      rewardKey: collectibleId,
    });
    if (granted) {
      const col = await awardCollectibleDB(playerId, collectibleId, `Quest reward: ${quest.title}`, eventId);
      if (col && !grantedCollectible) grantedCollectible = col;
    }
  }

  if (unlocks.threeLocksFragment) {
    const { lock, collectibleId } = unlocks.threeLocksFragment;
    const granted = await insertRewardGrantDB({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      rewardType: 'THREE_LOCKS_FRAGMENT',
      rewardKey: collectibleId,
    });
    if (granted) {
      const col = await awardCollectibleDB(playerId, collectibleId, `Founder's Lock: ${lock.toUpperCase()}`, eventId);
      if (col && !grantedCollectible) grantedCollectible = col;
      threeLocksFragmentAwarded = lock;
    }

    const { data: lockGrants } = await db
      .from('reward_grants')
      .select('reward_key')
      .eq('event_id', eventId)
      .eq('player_id', playerId)
      .in('reward_type', ['THREE_LOCKS_FRAGMENT', 'COLLECTIBLE_UNLOCK']);
    const lockKeys = new Set((lockGrants || []).map((g: any) => (g.reward_key || '').toLowerCase()));
    const playerCols = await getCollectiblesForPlayerDB(playerId);
    for (const row of playerCols) {
      if (row.eventId === eventId) {
        if (row.collectible?.slug) lockKeys.add(row.collectible.slug.toLowerCase());
        if (row.collectibleId) lockKeys.add(row.collectibleId.toLowerCase());
      }
    }
    const mark = lockKeys.has('col-founder-mark') || lockKeys.has('founder-mark');
    const code = lockKeys.has('col-founder-code') || lockKeys.has('founder-code');
    const word = lockKeys.has('col-founder-word') || lockKeys.has('founder-word');
    threeLocksOwned = { mark, code, word };
    const hasAllThreeLocks = mark && code && word;
    if (hasAllThreeLocks) {
      await insertRewardGrantDB({
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
    await insertRewardGrantDB({
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
    const cipherGrant = await grantCipherFragmentsForQuestRewardDB({
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
    await insertRewardGrantDB({
      eventId,
      playerId,
      questId: quest.id,
      submissionId,
      rewardType: 'FINALE_PROGRESS',
      rewardKey: quest.id,
    });
  }

  let newAchievements: Array<{ id: string; title: string; description: string; icon?: string }> = [];
  try {
    const newlyAwarded = await evaluatePlayerAchievementsDB(playerId, eventId);
    if (newlyAwarded && newlyAwarded.length > 0) {
      newAchievements = newlyAwarded.map((ach) => ({
        id: ach.achievementId || ach.id,
        title: ach.achievement?.name || ach.achievementSlug || 'Achievement Unlocked',
        description: ach.achievement?.description || '',
        icon: ach.achievement?.badgeSymbol || '🏆',
      }));
    }
  } catch {
    // Fallback — do not fail the whole grant transaction over achievement evaluation.
  }

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
 * re-verifies or re-awards the base completion (awardQuestRewardsDB's
 * per-player-per-quest reward_grants gating already guarantees that) — this
 * only grants whatever field bonus the new proof type newly qualifies for.
 */
async function submitSupplementalFieldProofDB(
  trustedParams: SubmitProofParams,
  quest: Quest,
  existingSub: any
): Promise<SubmitProofResult> {
  if (!supabaseAdmin) {
    return failedSubmissionResult(trustedParams, 'Server-authoritative reward verification requires Supabase service-role configuration.');
  }

  const isFieldCheckIn = trustedParams.proofType === 'checkin' || trustedParams.proofType === 'gps';
  const isPhotoVideo = trustedParams.proofType === 'photo' || trustedParams.proofType === 'video';

  if (isFieldCheckIn) {
    const targetLat = quest.location?.latitude;
    const targetLon = quest.location?.longitude;
    const radius = quest.radiusMeters || quest.location?.radiusMeters || 100;
    if (targetLat === undefined || targetLon === undefined) {
      return failedSubmissionResult(trustedParams, 'Authoritative quest location is missing; Game Master review is required.');
    }
    if (trustedParams.userLat === undefined || trustedParams.userLon === undefined) {
      return failedSubmissionResult(trustedParams, 'GPS location verification required. Please enable location services.');
    }
    const distance = haversineMeters(trustedParams.userLat, trustedParams.userLon, targetLat, targetLon);
    if (distance > radius) {
      return failedSubmissionResult(trustedParams, `Too far from target location. You are ${distance} m away.`);
    }

    const { data: dbSub, error: subError } = await supabaseAdmin
      .from('quest_submissions')
      .insert({
        quest_id: trustedParams.questId,
        player_id: trustedParams.playerId,
        event_id: trustedParams.eventId,
        proof_type: trustedParams.proofType,
        status: 'verified',
        awarded_points: 0,
        drawing_entries_awarded: 0,
        user_lat: trustedParams.userLat,
        user_lon: trustedParams.userLon,
        distance_from_location: distance,
        reviewed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (subError || !dbSub) {
      throw new Error(subError?.message || 'Failed to persist field bonus submission.');
    }

    try {
      const grant = await awardQuestRewardsDB({
        quest,
        eventId: trustedParams.eventId,
        playerId: trustedParams.playerId,
        submissionId: dbSub.id,
        method: trustedParams.proofType,
        usedNfc: trustedParams.usedNfc,
      });
      return {
        success: true,
        submission: mapSubmissionFromDB({ ...dbSub, awarded_points: grant.awardedPoints, drawing_entries_awarded: grant.drawingEntriesAwarded }),
        message:
          grant.awardedPoints > 0
            ? `Field bonus confirmed! +${grant.awardedPoints} XP.`
            : 'Field visit logged — no new field bonus configured for this quest.',
        awardedPoints: grant.awardedPoints,
        drawingEntriesAwarded: grant.drawingEntriesAwarded,
        newAchievements: grant.newAchievements,
        threeLocksFragmentAwarded: grant.threeLocksFragmentAwarded,
        threeLocksOwned: grant.threeLocksOwned,
        cipherFragmentsAwarded: grant.cipherFragmentsAwarded,
        cipherDistrictsUnlocked: grant.cipherDistrictsUnlocked,
      };
    } catch (grantErr: any) {
      await supabaseAdmin.from('reward_grants').delete().eq('submission_id', dbSub.id);
      await supabaseAdmin.from('drawing_entry_ledger').delete().eq('submission_id', dbSub.id);
      await supabaseAdmin.from('score_ledger').delete().eq('submission_id', dbSub.id);
      await supabaseAdmin.from('quest_submissions').delete().eq('id', dbSub.id);
      throw new Error(grantErr?.message || 'Field bonus reward grant failed.');
    }
  }

  if (isPhotoVideo) {
    if (!trustedParams.proofUrl && !trustedParams.submittedContent) {
      return failedSubmissionResult(trustedParams, 'Proof details are required before Game Master review.');
    }

    const { data: dbSub, error: subError } = await supabaseAdmin
      .from('quest_submissions')
      .insert({
        quest_id: trustedParams.questId,
        player_id: trustedParams.playerId,
        event_id: trustedParams.eventId,
        proof_type: trustedParams.proofType,
        submitted_content: trustedParams.submittedContent,
        proof_url: trustedParams.proofUrl,
        status: 'pending',
        awarded_points: 0,
        drawing_entries_awarded: 0,
      })
      .select()
      .single();
    if (subError || !dbSub) {
      throw new Error(subError?.message || 'Failed to persist field bonus submission.');
    }

    return {
      success: true,
      submission: mapSubmissionFromDB(dbSub),
      message: 'Field photo submitted for Game Master review.',
      awardedPoints: 0,
      drawingEntriesAwarded: 0,
    };
  }

  return failedSubmissionResult(trustedParams, 'Unsupported field bonus submission type for this quest.');
}

// 5b. ACHIEVEMENTS DB
export async function getAchievementsDB(): Promise<Achievement[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getAchievements();
  const { data, error } = await supabase.from('achievements').select('*');
  if (error || !data || data.length === 0) return localEngine.getAchievements();
  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    badgeSymbol: row.badge_symbol,
    category: row.category,
    rarity: row.rarity,
    district: row.district,
  }));
}

export async function getAchievementsForPlayerDB(playerId: string): Promise<PlayerAchievement[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getAchievementsForPlayer(playerId);
  const db = supabaseAdmin || supabase;
  const { data, error } = await db
    .from('player_achievements')
    .select('*, achievements(*)')
    .eq('player_id', playerId)
    .order('earned_at', { ascending: false });
  if (error || !data || data.length === 0) return localEngine.getAchievementsForPlayer(playerId);
  return data.map((row) => ({
    id: row.id,
    playerId: row.player_id,
    achievementId: row.achievement_id,
    achievementSlug: row.achievement_slug,
    eventId: row.event_id,
    earnedAt: row.earned_at,
    provenance: row.provenance,
    achievement: row.achievements
      ? {
          id: row.achievements.id,
          slug: row.achievements.slug,
          name: row.achievements.name,
          description: row.achievements.description,
          badgeSymbol: row.achievements.badge_symbol,
          category: row.achievements.category,
          rarity: row.achievements.rarity,
          district: row.achievements.district,
        }
      : undefined,
  }));
}

export async function awardAchievementDB(
  playerId: string,
  achievementSlug: string,
  eventId?: string,
  provenance?: string
): Promise<PlayerAchievement | undefined> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.awardAchievement(playerId, achievementSlug, eventId, provenance);
  }
  const { data: achievement } = await supabaseAdmin
    .from('achievements')
    .select('*')
    .eq('slug', achievementSlug)
    .maybeSingle();

  if (!achievement) return localEngine.awardAchievement(playerId, achievementSlug, eventId, provenance);

  const { data: existing } = await supabaseAdmin
    .from('player_achievements')
    .select('*')
    .eq('player_id', playerId)
    .eq('achievement_slug', achievementSlug)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      playerId: existing.player_id,
      achievementId: existing.achievement_id,
      achievementSlug: existing.achievement_slug,
      eventId: existing.event_id,
      earnedAt: existing.earned_at,
      provenance: existing.provenance,
      achievement: {
        id: achievement.id,
        slug: achievement.slug,
        name: achievement.name,
        description: achievement.description,
        badgeSymbol: achievement.badge_symbol,
        category: achievement.category,
        rarity: achievement.rarity,
        district: achievement.district,
      },
    };
  }

  const { data: inserted } = await supabaseAdmin
    .from('player_achievements')
    .insert({
      player_id: playerId,
      achievement_id: achievement.id,
      achievement_slug: achievement.slug,
      event_id: eventId,
      provenance: provenance || 'Server verified accomplishment',
    })
    .select()
    .single();

  if (!inserted) return localEngine.awardAchievement(playerId, achievementSlug, eventId, provenance);

  return {
    id: inserted.id,
    playerId: inserted.player_id,
    achievementId: inserted.achievement_id,
    achievementSlug: inserted.achievement_slug,
    eventId: inserted.event_id,
    earnedAt: inserted.earned_at,
    provenance: inserted.provenance,
    achievement: {
      id: achievement.id,
      slug: achievement.slug,
      name: achievement.name,
      description: achievement.description,
      badgeSymbol: achievement.badge_symbol,
      category: achievement.category,
      rarity: achievement.rarity,
      district: achievement.district,
    },
  };
}

export async function awardDay1XpLeaderBonusDB(eventId: string, isRehearsal: boolean = false) {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.awardDay1XpLeaderBonus(eventId, isRehearsal);
  }
  return localEngine.awardDay1XpLeaderBonus(eventId, isRehearsal);
}

export async function evaluatePlayerAchievementsDB(
  playerId: string,
  eventId: string
): Promise<PlayerAchievement[]> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.evaluatePlayerAchievements(playerId, eventId);
  }

  try {
    const db = supabaseAdmin;

    // 1. Fetch player info
    const { data: player, error: playerErr } = await db
      .from('players')
      .select('id, selected_starting_path')
      .eq('id', playerId)
      .maybeSingle();

    if (playerErr || !player) {
      return localEngine.evaluatePlayerAchievements(playerId, eventId);
    }

    // 2. Fetch all verified submissions for this player and event
    const { data: submissions, error: subErr } = await db
      .from('quest_submissions')
      .select('quest_id, submitted_at, status')
      .eq('player_id', playerId)
      .eq('event_id', eventId)
      .eq('status', 'verified');

    if (subErr || !submissions) {
      return localEngine.evaluatePlayerAchievements(playerId, eventId);
    }

    const completedQuestIds = new Set<string>(submissions.map((s) => s.quest_id));

    // 3. Fetch all active quests for this event
    const { data: quests, error: questErr } = await db
      .from('quests')
      .select('id, starting_path, status')
      .eq('event_id', eventId);

    if (questErr || !quests) {
      return localEngine.evaluatePlayerAchievements(playerId, eventId);
    }

    const completedQuests = quests.filter((q) => completedQuestIds.has(q.id));
    const completedPaths = new Set(completedQuests.map((q) => q.starting_path).filter(Boolean));

    // 4. Fetch existing achievements for this player to know what's already awarded
    const { data: existingAchievements } = await db
      .from('player_achievements')
      .select('achievement_slug')
      .eq('player_id', playerId);

    const existingSlugs = new Set<string>((existingAchievements || []).map((a) => a.achievement_slug));
    const newlyAwarded: PlayerAchievement[] = [];

    const checkAndAward = async (slug: string, provenance: string) => {
      if (!existingSlugs.has(slug)) {
        const res = await awardAchievementDB(playerId, slug, eventId, provenance);
        if (res) {
          existingSlugs.add(slug);
          newlyAwarded.push(res);
        }
      }
    };

    // 1. Pathfinder for chosen starting path
    const chosenPath = player.selected_starting_path as StartingPath | undefined;
    if (chosenPath) {
      const hasCompletedChosenPath = completedQuests.some((q) => q.starting_path === chosenPath);
      if (hasCompletedChosenPath) {
        await checkAndAward(`pathfinder-${chosenPath}`, `Completed first ${chosenPath} mission`);
      }
    }

    // 2. Triple Threat (Family, Challenge, Secret)
    if (completedPaths.has('family') && completedPaths.has('challenge') && completedPaths.has('secret')) {
      await checkAndAward('triple-threat', 'Completed missions across all 3 starting paths');
    }

    // 3. District Sweeps
    for (const path of ['family', 'challenge', 'secret'] as StartingPath[]) {
      const activeDistrictQuests = quests.filter((q) => q.starting_path === path && q.status === 'active');
      if (activeDistrictQuests.length > 0 && activeDistrictQuests.every((q) => completedQuestIds.has(q.id))) {
        await checkAndAward(`district-sweep-${path}`, `Swept all active missions in ${path} district`);
      }
    }

    // 4. Nomad: Completed missions across all 3 districts within same day
    const submissionsByDay = new Map<string, Set<string>>();
    for (const sub of submissions) {
      const day = (sub.submitted_at || '').slice(0, 10);
      const q = quests.find((item) => item.id === sub.quest_id);
      if (day && q?.starting_path && q.starting_path !== 'cross_city') {
        if (!submissionsByDay.has(day)) submissionsByDay.set(day, new Set());
        submissionsByDay.get(day)!.add(q.starting_path);
      }
    }
    for (const [, paths] of submissionsByDay) {
      if (paths.has('family') && paths.has('challenge') && paths.has('secret')) {
        await checkAndAward('nomad', 'Completed all 3 districts in a single day');
        break;
      }
    }

    return newlyAwarded;
  } catch (err) {
    console.error('evaluatePlayerAchievementsDB error:', err);
    return localEngine.evaluatePlayerAchievements(playerId, eventId);
  }
}

export async function getDistrictContentSummaryDB(
  eventId: string,
  district: StartingPath
): Promise<DistrictContentSummary> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.getDistrictContentSummary(eventId, district);
  }
  return localEngine.getDistrictContentSummary(eventId, district);
}

export async function getAllDistrictsContentSummaryDB(
  eventId: string
): Promise<Record<StartingPath, DistrictContentSummary>> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.getAllDistrictsContentSummary(eventId);
  }
  return localEngine.getAllDistrictsContentSummary(eventId);
}

// 6. QUESTS & LOCATIONS API
export async function getQuestsForEventDB(eventId: string): Promise<Quest[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getQuestsForEvent(eventId);
  // Reads through supabaseAdmin (service role) — the quests table's RLS is
  // admin-only (see supabase/migrations/20260825130000_narrow_public_quest_steps_view.sql,
  // which documents the public_quests/public_quest_steps views that exist
  // specifically because the base tables aren't anon-readable). The plain
  // anon `supabase` client used here previously returned zero rows for
  // every event, silently falling through to the (stale, offline-only)
  // local engine fixture data in production. Safe to read the full row
  // (including target_code/gm_notes) through admin here — every caller
  // sanitizes via getPublicQuestView before this ever reaches a client.
  const db = supabaseAdmin || supabase;
  const { data, error } = await db
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

/**
 * Updates a quest's `status` (active/inactive/draft) in production —
 * currently the only field the admin surface needs to change post-seed
 * (e.g. deactivating a Fair QR). Deliberately narrow: it never touches
 * points, target_code, or the startsAt/expiresAt window, so it can't be
 * used to accidentally change what a quest is worth or when it's valid.
 */
export interface AdminQuestUpdate {
  status?: Quest['status'];
  gmNotes?: string;
  placementDetails?: QuestPlacementDetails;
  /** Pass a value to set placed_at; pass null to clear it (mark unplaced). */
  placedAt?: string | null;
}

/**
 * Updates the small set of fields the admin surface is allowed to touch —
 * status, the internal placement note, structured placement details, and
 * the "physically placed" timestamp. Deliberately narrow: it never accepts
 * points, target_code, or the startsAt/expiresAt window, so it can't be
 * used to accidentally change what a quest is worth, its scan secret, or
 * when it's valid (e.g. a daily bonus's scheduled day).
 */
export async function updateQuestDB(questId: string, updates: AdminQuestUpdate): Promise<Quest | undefined> {
  if (!isSupabaseConfigured || !supabase) {
    return localEngine.updateQuest(questId, { ...updates, placedAt: updates.placedAt ?? undefined });
  }
  const db = supabaseAdmin || supabase;

  const patch: Record<string, unknown> = {};
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.gmNotes !== undefined) patch.gm_notes = updates.gmNotes;
  if (updates.placementDetails !== undefined) patch.placement_details = updates.placementDetails;
  if (updates.placedAt !== undefined) patch.placed_at = updates.placedAt;

  const { data, error } = await db
    .from('quests')
    .update(patch)
    .eq('id', questId)
    .select('*, locations(*), quest_steps(*, locations(*))')
    .single();
  if (error || !data) return undefined;
  return mapQuestFromDB(data);
}

/**
 * Resolves a quest purely by its scan-only target_code (the value encoded
 * in a physical QR graphic) — never by slug/id, which are never printed
 * anywhere. Used by /api/qr/claim so a scanned code alone (no client-
 * supplied questId or eventId) can find the exact quest it belongs to,
 * whichever event owns it. A quest's target_code is never exposed via any
 * public API response (see PublicQuestView), so this lookup can only
 * succeed for someone who actually has the physical code.
 */
export async function getQuestByTargetCodeDB(code: string): Promise<Quest | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getQuestByTargetCode(code);
  const db = supabaseAdmin || supabase;
  const { data, error } = await db
    .from('quests')
    .select('*, locations(*), quest_steps(*, locations(*))')
    .eq('verification_type', 'qr')
    .eq('target_code', code)
    .maybeSingle();
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

// 7. PLAYERS DB & PROFILE
export async function getPlayerByIdDB(playerId: string): Promise<Player | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getPlayerById(playerId);
  const db = supabaseAdmin || supabase;
  const { data, error } = await db.from('players').select('*').eq('id', playerId).maybeSingle();
  if (error || !data) return localEngine.getPlayerById(playerId);
  return mapPlayerFromDB(data);
}

export async function getPlayerByUserIdDB(userId: string): Promise<Player | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getPlayerByUserId(userId);
  const db = supabaseAdmin || supabase;
  const { data, error } = await db.from('players').select('*').eq('user_id', userId).maybeSingle();
  if (error || !data) return undefined;
  return mapPlayerFromDB(data);
}

export async function claimLegacyPlayerByEmailDB(userId: string, email: string): Promise<Player | undefined> {
  if (!isSupabaseConfigured || !supabase) return localEngine.claimLegacyPlayerByEmail(userId, email);
  const db = supabaseAdmin || supabase;
  const { data: legacy, error: findErr } = await db
    .from('players')
    .select('*')
    .ilike('email', email)
    .is('user_id', null)
    .maybeSingle();

  if (findErr || !legacy) return undefined;

  const { data: updated, error: updateErr } = await db
    .from('players')
    .update({
      user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', legacy.id)
    .select()
    .single();

  if (updateErr || !updated) return undefined;
  return mapPlayerFromDB(updated);
}

export async function upsertPlayerDB(
  params:
    | {
        id?: string;
        userId?: string;
        displayName: string;
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
        bio?: string;
        tagline?: string;
        hometown?: string;
        themeColor?: string;
        favoriteStyle?: string;
        selectedFlair?: string;
        showcaseBadges?: string[];
        featuredBadgeSlugs?: string[];
        isMinor?: boolean;
        email?: string;
      }
    | string,
  avatarUrlFallback: string = '⚡'
): Promise<Player> {
  const p =
    typeof params === 'string'
      ? { displayName: params, avatarUrl: avatarUrlFallback }
      : params;

  if (!isSupabaseConfigured || !supabase) {
    return localEngine.registerPlayer(p);
  }

  const db = supabaseAdmin || supabase;
  const cleanName = (p.displayName || 'Canton Explorer').trim();

  // If player ID is provided, update
  if (p.id) {
    const updatePayload: any = {
      display_name: cleanName,
      avatar_url: p.avatarUrl || '⚡',
      avatar_preset_key: p.avatarPresetKey,
      profile_image_path: p.profileImagePath,
      profile_image_crop_zoom: p.profileImageCropZoom,
      profile_image_crop_x: p.profileImageCropX,
      profile_image_crop_y: p.profileImageCropY,
      // Privacy toggles are retired — every write is unconditionally public,
      // regardless of any (now nonexistent) client-provided value.
      profile_visibility: 'public',
      player_image_visibility: 'public',
      selected_starting_path: p.selectedStartingPath || null,
      bio: p.bio,
      tagline: p.tagline,
      hometown: p.hometown,
      theme_color: p.themeColor,
      favorite_style: p.favoriteStyle,
      selected_flair: p.selectedFlair,
      showcase_badges: p.showcaseBadges,
      featured_badge_slugs: p.featuredBadgeSlugs,
      updated_at: new Date().toISOString(),
    };
    if (p.userId) updatePayload.user_id = p.userId;
    if (p.email) updatePayload.email = p.email;

    const { data, error } = await db
      .from('players')
      .update(updatePayload)
      .eq('id', p.id)
      .select()
      .single();

    if (!error && data) return mapPlayerFromDB(data);
  }

  // Otherwise insert or fetch
  const { data: inserted, error: insertErr } = await db
    .from('players')
    .insert({
      user_id: p.userId,
      email: p.email,
      display_name: cleanName,
      avatar_url: p.avatarUrl || '⚡',
      avatar_preset_key: p.avatarPresetKey,
      profile_image_path: p.profileImagePath,
      profile_image_crop_zoom: p.profileImageCropZoom,
      profile_image_crop_x: p.profileImageCropX,
      profile_image_crop_y: p.profileImageCropY,
      // Privacy toggles are retired — every write is unconditionally public,
      // regardless of any (now nonexistent) client-provided value.
      profile_visibility: 'public',
      player_image_visibility: 'public',
      selected_starting_path: p.selectedStartingPath || null,
      acquisition_source: p.acquisitionSource || 'main_site',
      bio: p.bio,
      tagline: p.tagline,
      hometown: p.hometown,
      theme_color: p.themeColor,
      favorite_style: p.favoriteStyle,
      selected_flair: p.selectedFlair,
      showcase_badges: p.showcaseBadges,
      featured_badge_slugs: p.featuredBadgeSlugs,
      is_minor: p.isMinor || false,
    })
    .select()
    .single();

  if (!insertErr && inserted) return mapPlayerFromDB(inserted);

  return localEngine.registerPlayer(p);
}

export {
  resolveAuthenticatedPlayerId,
  resolveAuthenticatedPlayer,
  resolveAuthenticatedSupabaseUser,
  resolveOrCreatePlayerForAuthUser,
  signUpWithPassword,
  signInWithPassword,
  sendPasswordResetEmail,
  updateUserPassword,
  sendEmailOtp,
  verifyEmailOtp,
  sanitizePlayerForPublic,
} from './supabase-auth';

// 8. PROOF SUBMISSION & SCORING
export async function submitQuestProofDB(
  params: SubmitProofParams,
  requestOrToken?: Request | string | { request?: Request; accessToken?: string; refreshToken?: string } | null
): Promise<SubmitProofResult> {
  if (!isSupabaseConfigured || !supabase) return localEngine.submitQuestProof(params);

  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return failedSubmissionResult(params, 'Server-authoritative reward verification requires Supabase service-role configuration.');
  }

  try {
    const trustedPlayerId = await resolveAuthenticatedPlayerId(requestOrToken);
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

    // Emergency pause: real in local-engine play since day one, but never
    // enforced against this, the actual production submission path — see
    // lib/live-events.ts's module doc comment. A paused event must reject
    // new submissions the same way the offline engine already does.
    const event = await getEventByIdDB(trustedParams.eventId);
    if (event?.isPaused) {
      return failedSubmissionResult(
        trustedParams,
        `Event is currently paused by Game Master${event.pauseReason ? ` (${event.pauseReason})` : ''}. Submissions held.`
      );
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
        if (
          quest.remoteCapable &&
          trustedParams.proofType &&
          trustedParams.proofType !== existingSub.proof_type &&
          (trustedParams.proofType === 'checkin' ||
            trustedParams.proofType === 'gps' ||
            trustedParams.proofType === 'photo' ||
            trustedParams.proofType === 'video')
        ) {
          return submitSupplementalFieldProofDB(trustedParams, quest, existingSub);
        }
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
      event_id: trustedParams.eventId,
      proof_type: trustedParams.proofType || quest.verificationType || 'checkin',
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

    if (subError?.code === '23505' && verification.status === 'verified') {
      // Lost a genuine race against a near-simultaneous duplicate claim for
      // this exact (player, quest) — two rapid taps, a retried request after
      // an apparent timeout, etc. The other request's insert already won
      // and is verified (uq_quest_submissions_player_quest_verified is the
      // only unique constraint this insert could hit). Re-read it and
      // return the SAME "already completed" response the upfront check
      // gives — a retry or accidental double-submit must never look like a
      // failure to the player, even though this request itself inserted
      // nothing and awarded nothing.
      const { data: winner } = await supabaseAdmin
        .from('quest_submissions')
        .select('*')
        .eq('player_id', trustedPlayerId)
        .eq('quest_id', trustedParams.questId)
        .eq('status', 'verified')
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (winner) {
        return {
          success: false,
          submission: mapSubmissionFromDB(winner),
          message: 'Quest already completed! Rewards have already been issued.',
          awardedPoints: 0,
          drawingEntriesAwarded: 0,
        };
      }
    }

    if (subError || !dbSub) {
      throw new Error(subError?.message || 'Failed to persist quest submission.');
    }

    let awardedPoints = 0;
    let drawingEntriesAwarded = 0;
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
    let threeLocksFragmentAwarded: 'mark' | 'code' | 'word' | undefined;
    let threeLocksOwned: { mark: boolean; code: boolean; word: boolean } | undefined;
    let cipherFragmentsAwarded: string[] | undefined;
    let cipherDistrictsUnlocked: Array<'arts' | 'challenge' | 'secret'> | undefined;
    let readyToDecodeDistricts: Array<'arts' | 'challenge' | 'secret'> | undefined;
    let isFirstCipherFragment: boolean | undefined;

    if (verification.status === 'verified') {
      try {
        const oldLeaderboard = await getLeaderboardDB(trustedParams.eventId);
        oldRank = oldLeaderboard.find((e) => e.playerId === trustedPlayerId)?.rank;
      } catch {
        // Fallback
      }

      try {
        const grant = await awardQuestRewardsDB({
          quest,
          eventId: trustedParams.eventId,
          playerId: trustedPlayerId,
          submissionId: dbSub.id,
          method: trustedParams.proofType,
          usedNfc: trustedParams.usedNfc,
        });
        awardedPoints = grant.awardedPoints;
        drawingEntriesAwarded = grant.drawingEntriesAwarded;
        if (grant.newAchievements.length > 0) newAchievements = grant.newAchievements;
        threeLocksFragmentAwarded = grant.threeLocksFragmentAwarded;
        threeLocksOwned = grant.threeLocksOwned;
        cipherFragmentsAwarded = grant.cipherFragmentsAwarded;
        cipherDistrictsUnlocked = grant.cipherDistrictsUnlocked;
        readyToDecodeDistricts = grant.readyToDecodeDistricts;
        isFirstCipherFragment = grant.isFirstCipherFragment;
      } catch (grantErr: any) {
        // Reward granting failed partway through — unwind every row keyed to
        // this submission (score/drawing/audit ledger + the submission
        // itself) so a retry starts genuinely clean under a fresh submission
        // id. Collectible/badge/finale grants already committed before the
        // failure are left in place: they're keyed by player, not
        // submission, and are themselves idempotent, so a retry safely
        // no-ops on them rather than duplicating.
        await supabaseAdmin.from('reward_grants').delete().eq('submission_id', dbSub.id);
        await supabaseAdmin.from('drawing_entry_ledger').delete().eq('submission_id', dbSub.id);
        await supabaseAdmin.from('score_ledger').delete().eq('submission_id', dbSub.id);
        await supabaseAdmin.from('quest_submissions').delete().eq('id', dbSub.id);
        throw new Error(grantErr?.message || 'Reward grant transaction failed.');
      }

      try {
        const newLeaderboard = await getLeaderboardDB(trustedParams.eventId);
        newRank = newLeaderboard.find((e) => e.playerId === trustedPlayerId)?.rank;
      } catch {
        // Fallback
      }
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
      oldRank,
      newRank,
      newAchievements,
      threeLocksFragmentAwarded,
      threeLocksOwned,
      cipherFragmentsAwarded,
      cipherDistrictsUnlocked,
      readyToDecodeDistricts,
      isFirstCipherFragment,
    };
  } catch (err: any) {
    console.error('submitQuestProofDB error:', err);
    return failedSubmissionResult(params, err.message || 'Server-authoritative submission failed.');
  }
}

/**
 * Public Player Roster — every registered permanent player identity,
 * regardless of any Operation's score (never gated on having earned any
 * points). Distinct from an Operation leaderboard. Selects only public-safe
 * columns directly (never selects email/user_id at all, rather than
 * fetching-then-stripping) and resolves each avatar server-side so a raw
 * storage path is never sent to the client.
 */
export async function getPlayerRosterDB(search?: string): Promise<PublicRosterEntry[]> {
  if (!isSupabaseConfigured || !supabase) {
    const needle = search?.trim().toLowerCase();
    return localEngine
      .getAllPlayers()
      .filter((p) => !needle || p.displayName.toLowerCase().includes(needle))
      .map((p) => ({
        id: p.id,
        displayName: p.displayName,
        avatarUrl: resolveAvatarUrl(p),
        profileImageCropZoom: p.profileImageCropZoom,
        profileImageCropX: p.profileImageCropX,
        profileImageCropY: p.profileImageCropY,
        selectedStartingPath: p.selectedStartingPath,
        level: p.level,
        createdAt: p.createdAt,
      }));
  }

  const db = supabaseAdmin || supabase;
  let query = db
    .from('players')
    .select(
      'id, display_name, avatar_preset_key, profile_image_path, avatar_url, acquisition_source, profile_image_crop_zoom, profile_image_crop_x, profile_image_crop_y, selected_starting_path, level, created_at'
    )
    .order('created_at', { ascending: true });

  if (search && search.trim()) {
    query = query.ilike('display_name', `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    displayName: row.display_name,
    avatarUrl: resolveAvatarUrl({
      id: row.id,
      avatarPresetKey: row.avatar_preset_key,
      profileImagePath: row.profile_image_path,
      avatarUrl: row.avatar_url,
      acquisitionSource: row.acquisition_source,
    }),
    profileImageCropZoom: row.profile_image_crop_zoom,
    profileImageCropX: row.profile_image_crop_x,
    profileImageCropY: row.profile_image_crop_y,
    selectedStartingPath: row.selected_starting_path || undefined,
    level: row.level,
    createdAt: row.created_at,
  }));
}

export async function getLeaderboardDB(eventId: string): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getLeaderboardForEvent(eventId);
  const db = supabaseAdmin || supabase;

  try {
    const { data: scoreRows, error: scoreErr } = await db
      .from('score_ledger')
      .select('player_id, quest_id, points, awarded_at')
      .eq('event_id', eventId);

    if (scoreErr || !scoreRows) {
      return localEngine.getLeaderboardForEvent(eventId);
    }

    // Collect all player IDs
    const playerIds = Array.from(new Set(scoreRows.map((r: any) => r.player_id).filter(Boolean)));
    type LeaderboardPlayerInfo = {
      displayName: string;
      avatarUrl?: string;
      profileImageCropZoom?: number;
      profileImageCropX?: number;
      profileImageCropY?: number;
    };
    const playersMap: Record<string, LeaderboardPlayerInfo> = {};

    if (playerIds.length > 0) {
      const { data: playersData } = await db
        .from('players')
        .select('id, display_name, avatar_url, profile_image_crop_zoom, profile_image_crop_x, profile_image_crop_y')
        .in('id', playerIds);

      if (playersData) {
        for (const p of playersData) {
          playersMap[p.id] = {
            displayName: p.display_name,
            avatarUrl: p.avatar_url,
            profileImageCropZoom: p.profile_image_crop_zoom,
            profileImageCropX: p.profile_image_crop_x,
            profileImageCropY: p.profile_image_crop_y,
          };
        }
      }
    }

    // Also include event_players registered for event even if 0 points
    const { data: eventPlayers } = await db
      .from('event_players')
      .select('player_id, players(id, display_name, avatar_url, profile_image_crop_zoom, profile_image_crop_x, profile_image_crop_y)')
      .eq('event_id', eventId);

    if (eventPlayers) {
      for (const ep of eventPlayers) {
        if (ep.player_id && !playersMap[ep.player_id] && (ep as any).players) {
          const epPlayer = (ep as any).players;
          playersMap[ep.player_id] = {
            displayName: epPlayer.display_name || 'Agent',
            avatarUrl: epPlayer.avatar_url || '⚡',
            profileImageCropZoom: epPlayer.profile_image_crop_zoom,
            profileImageCropX: epPlayer.profile_image_crop_x,
            profileImageCropY: epPlayer.profile_image_crop_y,
          };
        }
      }
    }

    const playerStats: Record<
      string,
      { totalPoints: number; completedQuestIds: Set<string>; lastScoreTime: string } & LeaderboardPlayerInfo
    > = {};

    for (const [pId, pInfo] of Object.entries(playersMap)) {
      playerStats[pId] = {
        totalPoints: 0,
        completedQuestIds: new Set<string>(),
        lastScoreTime: '',
        ...pInfo,
      };
    }

    for (const row of scoreRows) {
      if (!playerStats[row.player_id]) {
        playerStats[row.player_id] = {
          totalPoints: 0,
          completedQuestIds: new Set<string>(),
          lastScoreTime: row.awarded_at || '',
          displayName: playersMap[row.player_id]?.displayName || 'Anonymous Agent',
          avatarUrl: playersMap[row.player_id]?.avatarUrl || '⚡',
          profileImageCropZoom: playersMap[row.player_id]?.profileImageCropZoom,
          profileImageCropX: playersMap[row.player_id]?.profileImageCropX,
          profileImageCropY: playersMap[row.player_id]?.profileImageCropY,
        };
      }
      playerStats[row.player_id].totalPoints += row.points || 0;
      if (row.quest_id) {
        playerStats[row.player_id].completedQuestIds.add(row.quest_id);
      }
      const time = row.awarded_at || '';
      if (
        time &&
        (!playerStats[row.player_id].lastScoreTime ||
          new Date(time) > new Date(playerStats[row.player_id].lastScoreTime))
      ) {
        playerStats[row.player_id].lastScoreTime = time;
      }
    }

    const leaderboard: LeaderboardEntry[] = Object.entries(playerStats).map(([playerId, stats]) => ({
      rank: 0,
      playerId,
      displayName: stats.displayName || 'Anonymous Agent',
      avatarUrl: stats.avatarUrl || '⚡',
      profileImageCropZoom: stats.profileImageCropZoom,
      profileImageCropX: stats.profileImageCropX,
      profileImageCropY: stats.profileImageCropY,
      totalPoints: Math.max(0, stats.totalPoints),
      questsCompletedCount: stats.completedQuestIds.size,
      lastScoreTime: stats.lastScoreTime,
    }));

    leaderboard.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return new Date(a.lastScoreTime || 0).getTime() - new Date(b.lastScoreTime || 0).getTime();
    });

    leaderboard.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    return leaderboard;
  } catch (err) {
    console.error('getLeaderboardDB error:', err);
    return localEngine.getLeaderboardForEvent(eventId);
  }
}

export async function getPlayerProgressDB(playerId: string, eventId: string): Promise<PlayerEventProgress> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getPlayerProgress(playerId, eventId);
  const db = supabaseAdmin || supabase;

  try {
    const leaderboard = await getLeaderboardDB(eventId);
    const playerEntry = leaderboard.find((e) => e.playerId === playerId);
    const rank = playerEntry?.rank || leaderboard.length + 1;
    const totalPoints = playerEntry?.totalPoints || 0;

    const { data: subs } = await db
      .from('quest_submissions')
      .select('quest_id, status')
      .eq('player_id', playerId)
      .eq('event_id', eventId);

    const completedQuestIds = Array.from(
      new Set((subs || []).filter((s) => s.status === 'verified').map((s) => s.quest_id))
    );
    const pendingSubmissionQuestIds = Array.from(
      new Set((subs || []).filter((s) => s.status === 'pending').map((s) => s.quest_id))
    );

    const { data: eventQuests } = await db
      .from('quests')
      .select('id')
      .eq('event_id', eventId)
      .eq('status', 'active');

    const availableCount = eventQuests ? eventQuests.length : 0;

    return {
      totalPoints,
      completedQuestIds,
      pendingSubmissionQuestIds,
      completedCount: completedQuestIds.length,
      availableCount,
      rank,
      isQualifiedForFinale: completedQuestIds.length > 0,
    };
  } catch {
    return localEngine.getPlayerProgress(playerId, eventId);
  }
}

/**
 * Distinct quests a player has ever submitted for, across all Missions
 * (lifetime scope, any submission status — a rejected or pending submission
 * still required the player to actually engage, unlike a merely-available
 * quest which never produces a quest_submissions row). Powers the Player
 * Card's PLAYER LEVEL segments.
 */
export async function getParticipatedQuestCountDB(playerId: string): Promise<number> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getParticipatedQuestCount(playerId);
  const db = supabaseAdmin || supabase;

  try {
    const { data, error } = await db
      .from('quest_submissions')
      .select('quest_id')
      .eq('player_id', playerId);

    if (error || !data) return 0;
    return new Set(data.map((row) => row.quest_id)).size;
  } catch {
    return localEngine.getParticipatedQuestCount(playerId);
  }
}

/**
 * Whether a player has any quest_submissions row (any status — verified,
 * pending, or rejected) for one specific Mission. Powers the Player Card's
 * PLAYER SIGNAL status (ON MISSION vs ACTIVE) — same "any status counts as
 * engagement" definition as getParticipatedQuestCountDB, just scoped to a
 * single event instead of lifetime.
 */
export async function hasEventSubmissionDB(playerId: string, eventId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return localEngine.hasEventSubmission(playerId, eventId);
  const db = supabaseAdmin || supabase;

  try {
    const { data, error } = await db
      .from('quest_submissions')
      .select('id')
      .eq('player_id', playerId)
      .eq('event_id', eventId)
      .limit(1);

    if (error) return false;
    return Boolean(data && data.length > 0);
  } catch {
    return localEngine.hasEventSubmission(playerId, eventId);
  }
}

export async function getDrawingEntriesForPlayerDB(
  playerId: string,
  eventId?: string
): Promise<DrawingEntryLedgerEntry[]> {
  if (!isSupabaseConfigured || !supabase) return localEngine.getDrawingEntriesForPlayer(playerId, eventId);
  const db = supabaseAdmin || supabase;
  let query = db.from('drawing_entry_ledger').select('*').eq('player_id', playerId);
  if (eventId) query = query.eq('event_id', eventId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    playerId: row.player_id,
    questId: row.quest_id,
    submissionId: row.submission_id,
    entriesCount: row.entries_count || 0,
    sourceType: row.source_type,
    reason: row.reason,
    createdAt: row.created_at,
  }));
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
    .select('*')
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
    const rawQuest = Array.isArray(sub.quest) ? sub.quest[0] : sub.quest;
    const quest = rawQuest ? mapQuestFromDB(rawQuest) : (sub.quest_id ? await getQuestByIdDB(sub.quest_id) : null);

    try {
      if (quest) {
        const grant = await awardQuestRewardsDB({
          quest,
          eventId: sub.event_id,
          playerId: sub.player_id,
          teamId: sub.team_id,
          submissionId: sub.id,
          method: sub.proof_type,
          scoreDescription: `Media submission approved for ${quest.title}`,
        });
        updatedSub.awarded_points = grant.awardedPoints;
        updatedSub.drawing_entries_awarded = grant.drawingEntriesAwarded;
      } else {
        // Defensive fallback for an orphaned submission whose quest no longer exists.
        await supabaseAdmin.from('score_ledger').insert({
          event_id: sub.event_id,
          player_id: sub.player_id,
          team_id: sub.team_id,
          quest_id: sub.quest_id,
          submission_id: sub.id,
          points: 100,
          category: 'admin_approved',
          description: 'Media submission approved for Quest',
        });
        updatedSub.awarded_points = 100;
        updatedSub.drawing_entries_awarded = 1;
      }
    } catch (grantErr: any) {
      // Reward granting failed after status was already flipped to
      // 'verified' — unwind everything keyed to this submission and revert
      // the status so a GM retry can cleanly re-run the whole transaction,
      // rather than leaving a "verified" submission with no rewards.
      await supabaseAdmin.from('reward_grants').delete().eq('submission_id', sub.id);
      await supabaseAdmin.from('drawing_entry_ledger').delete().eq('submission_id', sub.id);
      await supabaseAdmin.from('score_ledger').delete().eq('submission_id', sub.id);
      await supabaseAdmin
        .from('quest_submissions')
        .update({ status: sub.status, reviewed_at: sub.reviewed_at, feedback: sub.feedback, reviewer_notes: sub.reviewer_notes })
        .eq('id', sub.id);
      throw new Error(grantErr?.message || 'Reward grant transaction failed.');
    }
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

  const drawMethod: DrawMethod = params.drawMethod || (params.testSeed ? 'internal_test' : 'final_quest');
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

  let provider: DrawProvider = localEngine.FinalQuestDrawProvider;
  if (drawMethod === 'internal_test') {
    provider = localEngine.InternalTestDrawProvider;
  } else if (drawMethod === 'manual_external') {
    provider = localEngine.ManualExternalDrawProvider;
  } else if (drawMethod === 'random_org') {
    provider = localEngine.RandomOrgFutureDrawProvider;
  } else {
    provider = localEngine.FinalQuestDrawProvider;
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

  const isInputUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
  let eventQuery = supabaseAdmin.from('events').select('id, title');
  if (isInputUUID) {
    eventQuery = eventQuery.or(`id.eq.${eventId},slug.eq.${eventId}`);
  } else {
    eventQuery = eventQuery.eq('slug', eventId);
  }
  let { data: event } = await eventQuery.maybeSingle();

  if (!event && isKnownCantonLaunchSlug(eventId)) {
    const { data: launchEvent } = await supabaseAdmin
      .from('events')
      .select('id, title')
      .or('id.eq.b0000001-0000-4000-8000-000000000001,slug.eq.canton-weekend-1')
      .maybeSingle();
    if (launchEvent) event = launchEvent;
  }

  const realEventId = event ? event.id : eventId;
  const eventTitle = event ? event.title : "Canton Quests: Volume 1 - The Founder's Cipher";

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
    verificationStatus: row.verification_status || row.audit_metadata?.verificationStatus || (row.draw_method === 'manual_external' ? 'manual_unverified' : row.draw_method === 'final_quest' ? 'final_quest_trail' : 'internal_seeded'),
    isSystemVerified: row.is_system_verified ?? row.audit_metadata?.isSystemVerified ?? (row.draw_method === 'final_quest' || row.draw_method === 'internal_test'),
    isIndependent: row.is_independent ?? row.audit_metadata?.isIndependent ?? false,
    finalQuestReceipt: row.audit_metadata?.finalQuestReceipt,
  }));

  const { data: questSubmissions } = await supabaseAdmin
    .from('quest_submissions')
    .select('id')
    .eq('event_id', realEventId)
    .eq('status', 'verified');

  const totalCompletedQuests = (questSubmissions || []).length;

  const { count: eventPlayersCount } = await supabaseAdmin
    .from('event_players')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', realEventId);

  const totalQualifiedPlayers = publicPlayerEntries.length > 0
    ? publicPlayerEntries.length
    : (eventPlayersCount || 0);

  const ledgerLockStatus: DrawingStatus = (lockRow?.status as DrawingStatus) || 'open';
  const firstPublished = publishedRows && publishedRows.length > 0 ? publishedRows[0] : null;

  const ticketRanges = lockRow?.canonical_snapshot
    ? localEngine.assignTicketsToSnapshot(lockRow.canonical_snapshot).ticketRanges
    : undefined;

  return {
    eventId: realEventId,
    eventTitle,
    ledgerLockStatus,
    ledgerLockTimestamp: lockRow?.is_locked ? lockRow.locked_at || null : null,
    snapshotHash: lockRow?.snapshot_hash || null,
    canonicalSnapshot: lockRow?.canonical_snapshot || null,
    totalQualifiedEntries,
    totalQualifiedPlayers,
    totalCompletedQuests,
    publicPlayerEntries,
    publishedPrizes,
    publishedAt: firstPublished ? firstPublished.published_at || null : null,
    verificationInfo: lockRow?.snapshot_hash
      ? `This drawing entry pool was finalized and cryptographically hashed (SHA-256: ${lockRow.snapshot_hash}) on ${lockRow.locked_at}. The winner selection is tied directly to the frozen canonical snapshot.`
      : undefined,
    ticketRanges,
  };
}

export async function getAuthenticatedPlayerDrawingQualificationDB(
  playerId: string,
  eventId: string
): Promise<AuthenticatedPlayerDrawingQualification | null> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return localEngine.getAuthenticatedPlayerDrawingQualification(playerId, eventId);
  }

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, title')
    .or(`id.eq.${eventId},slug.eq.${eventId}`)
    .maybeSingle();
  const realEventId = event ? event.id : eventId;

  const { data: player } = await supabaseAdmin
    .from('players')
    .select('id, display_name, is_minor')
    .eq('id', playerId)
    .maybeSingle();

  if (!player) return null;

  const { data: entryRows } = await supabaseAdmin
    .from('drawing_entry_ledger')
    .select('entries_count')
    .eq('event_id', realEventId)
    .eq('player_id', playerId);

  const totalEntries = (entryRows || []).reduce((sum: number, r: any) => sum + (r.entries_count || 0), 0);

  const isMinor = player.is_minor === true;
  const playerLabel = localEngine.getPublicPlayerLabel(
    { displayName: player.display_name, isMinor } as any,
    player.id
  );
  const participantId = localEngine.getPublicParticipantId(player.id, realEventId);

  const { data: lockRow } = await supabaseAdmin
    .from('drawing_ledger_locks')
    .select('*')
    .eq('event_id', realEventId)
    .maybeSingle();

  let ticketRange: string | null = null;
  if (lockRow?.canonical_snapshot) {
    const { ticketRanges } = localEngine.assignTicketsToSnapshot(lockRow.canonical_snapshot);
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
