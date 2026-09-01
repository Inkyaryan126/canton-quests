// Canton Quests — Core Domain Types (Phase 4 Event Factory)

export type UserRole = 'player' | 'admin' | 'partner';

export type EventStatus = 'draft' | 'ready' | 'published' | 'upcoming' | 'active' | 'ended';

export type EventPhaseType =
  | 'pre_game'
  | 'opening'
  | 'day_1'
  | 'night_round'
  | 'day_2'
  | 'final_hours'
  | 'finale'
  | 'ended';

export type QuestDifficulty = 'easy' | 'medium' | 'hard' | 'epic';

export type QuestCategory =
  | 'exploration'
  | 'puzzle'
  | 'observation'
  | 'creative'
  | 'photo_video'
  | 'business_partner'
  | 'flash'
  | 'trivia'
  | 'secret'
  | 'finale'
  | 'fair_core'
  | 'fair_bonus';

export type ProofVerificationType =
  | 'checkin'
  | 'qr'
  | 'passphrase'
  | 'photo'
  | 'video'
  | 'gps'
  | 'game_master'
  | 'multi_step';

export type SubmissionStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'retry_requested';

export type QuestUnlockConditionType = 'none' | 'prerequisite' | 'scheduled' | 'manual' | 'collectible_set';

export type QuestState = 'available' | 'completed' | 'pending' | 'locked' | 'flash' | 'expired' | 'hidden' | 'claimed_out';

export type AnnouncementUrgency = 'info' | 'warning' | 'flash' | 'urgent';

export type ProofReviewFlag =
  | 'DUPLICATE_PROOF'
  | 'OUTSIDE_LOCATION'
  | 'EXPIRED_QUEST'
  | 'HIGH_FREQUENCY_SUBMISSIONS'
  | 'MALFORMED_QR'
  | 'PAUSED_EVENT';

export interface City {
  id: string;
  name: string;
  slug: string;
  state: string;
  isActive: boolean;
  createdAt: string;
}

export type StartingPath = 'family' | 'challenge' | 'secret';

export type QuestPath = StartingPath | 'cross_city';

export type CipherDistrictKey = 'arts' | 'challenge' | 'secret';

export type CipherDistrictStatus = 'locked' | 'in_progress' | 'ready_to_decode' | 'token_unlocked';

export interface CipherFragmentView {
  key: string;
  districtKey: CipherDistrictKey;
  displayName?: string;
  obscuredLabel: string;
  revealCopy?: string;
  collected: boolean;
  sortOrder: number;
  grantedAt?: string;
}

export interface CipherDistrictProgressView {
  key: CipherDistrictKey;
  name: string;
  status: CipherDistrictStatus;
  collectedCount: number;
  requiredCount: number;
  tokenLabel?: string;
  sigilSymbol?: string;
  tokenUnlockedAt?: string;
  decodedSentence?: string;
  fragments: CipherFragmentView[];
}

export interface PlayerCipherProgressView {
  eventId: string;
  playerId: string;
  districts: CipherDistrictProgressView[];
  totalCollected: number;
  totalRequired: number;
}

export interface Player {
  id: string;
  userId?: string;
  displayName: string;
  avatarUrl?: string;
  avatarPresetKey?: string;
  profileImagePath?: string | null;
  profileImageUrl?: string;
  profileImageCropZoom?: number;
  profileImageCropX?: number;
  profileImageCropY?: number;
  profileVisibility?: 'public' | 'private';
  playerImageVisibility?: 'public' | 'private';
  role: UserRole;
  totalXp: number;
  level: number;
  createdAt: string;
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
  updatedAt?: string;
}

export type AchievementCategory = 'path' | 'district' | 'exploration' | 'competitive' | 'special';

export interface Achievement {
  id: string;
  slug: string;
  name: string;
  description: string;
  badgeSymbol: string;
  category: AchievementCategory;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  district?: StartingPath;
}

export interface PlayerAchievement {
  id: string;
  playerId: string;
  achievementId: string;
  achievementSlug: string;
  eventId?: string;
  earnedAt: string;
  provenance?: string;
  achievement?: Achievement;
}

export interface DistrictContentSummary {
  district: StartingPath;
  name: string;
  approximateArea: string;
  flavor: string;
  activeQuestsCount: number;
  totalAvailableXp: number;
  questTypes: Record<string, number>;
  gpsQuestsCount: number;
  qrQuestsCount: number;
  photoQuestsCount: number;
  puzzleQuestsCount: number;
  brokenQuestsCount: number;
  contentGaps: string[];
}

export interface LocationInfo {
  id: string;
  cityId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  locationNotes?: string;
  isPartner: boolean;
  radiusMeters?: number;
  accessNotes?: string;
  openingHours?: string;
}

export interface QuestEvent {
  id: string;
  cityId: string;
  title: string;
  slug: string;
  description: string;
  status: EventStatus;
  currentPhase: EventPhaseType;
  isPaused: boolean;
  pauseReason?: string;
  startTime?: string;
  endTime?: string;
  registrationStartTime?: string;
  basicInstructions?: string;
  safetyNotes?: string;
  mapCenterLat?: number;
  mapCenterLon?: number;
  themeColor?: string;
  createdAt: string;
  /**
   * Whether entering this Operation requires the player to choose a
   * Family/Challenge/Secret path before reaching gameplay. Path is an
   * Operation-specific attribute, not a global account requirement — most
   * Operations (e.g. the Fair QR Hunt) leave this false. Defaults to false
   * when absent so older/local data without the column still behaves
   * path-free rather than unexpectedly gating.
   */
  requiresPath?: boolean;
}

export interface EventReadiness {
  isReady: boolean;
  blockers: string[];
  warnings: string[];
  metrics: {
    totalQuests: number;
    totalXp: number;
    categoryCounts: Record<string, number>;
    locationCount: number;
    secretCount: number;
    flashCount: number;
    chainCount: number;
    timeLockedXpPercentage: number;
  };
}

export interface QuestTemplate {
  id: string;
  name: string;
  description: string;
  preset: Partial<Quest>;
}

export interface GeneratedQR {
  id: string;
  eventId: string;
  token: string;
  targetType: 'quest' | 'secret' | 'code' | 'checkpoint' | 'partner';
  targetId: string;
  targetUrl: string;
  label: string;
  createdAt: string;
}

export type CampaignEntityStatus = 'active' | 'inactive';

export interface QrCampaign {
  id: string;
  name: string;
  slug: string;
  destinationUrl: string;
  description?: string;
  notes?: string;
  status: CampaignEntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignFlyerVariant {
  id: string;
  campaignId: string;
  name: string;
  description?: string;
  notes?: string;
  status: CampaignEntityStatus;
  createdAt: string;
}

export interface CampaignDistributor {
  id: string;
  campaignId: string;
  name: string;
  notes?: string;
  status: CampaignEntityStatus;
  createdAt: string;
}

export interface CampaignQrCode {
  id: string;
  campaignId: string;
  flyerVariantId: string;
  distributorId: string;
  internalName: string;
  destinationUrl: string;
  trackingSlug: string;
  trackingUrl: string;
  status: CampaignEntityStatus;
  createdAt: string;
}

export interface CampaignVisit {
  id: string;
  campaignId: string;
  flyerVariantId: string;
  distributorId: string;
  qrCodeId: string;
  destinationUrl: string;
  anonymousVisitorId: string;
  referrer?: string;
  userAgentClass?: string;
  createdAt: string;
}

export interface CampaignBundle {
  campaigns: QrCampaign[];
  flyerVariants: CampaignFlyerVariant[];
  distributors: CampaignDistributor[];
  qrCodes: CampaignQrCode[];
  visits: CampaignVisit[];
}

export interface CampaignAnalyticsRow {
  id: string;
  label: string;
  visits: number;
  uniqueVisitors: number;
}

export interface CampaignCombinationAnalyticsRow {
  qrCodeId: string;
  flyerVariantId: string;
  distributorId: string;
  label: string;
  trackingSlug: string;
  visits: number;
  uniqueVisitors: number;
}

export interface CampaignAnalytics {
  campaignId: string;
  totalVisits: number;
  uniqueVisitors: number;
  activeQrCodes: number;
  flyerPerformance: CampaignAnalyticsRow[];
  distributorPerformance: CampaignAnalyticsRow[];
  destinationPerformance: CampaignAnalyticsRow[];
  combinationPerformance: CampaignCombinationAnalyticsRow[];
}

export interface QuestStep {
  id: string;
  questId: string;
  stepOrder: number;
  title: string;
  instructions: string;
  verificationType: ProofVerificationType;
  targetCode?: string;
  /** Extra accepted text-answer synonyms for this step, checked alongside targetCode. */
  acceptedAnswerVariants?: string[];
  locationId?: string;
  location?: LocationInfo;
  radiusMeters?: number;
}

export type PublicQuestStep = Omit<QuestStep, 'targetCode' | 'acceptedAnswerVariants'>;
export type PublicQuestView = Omit<
  Quest,
  'targetCode' | 'gmNotes' | 'steps' | 'acceptedAnswerVariants' | 'placementDetails' | 'placedAt'
> & {
  steps?: PublicQuestStep[];
};

/** Admin-only physical placement notes beyond the short gmNotes field — never included in PublicQuestView. */
export interface QuestPlacementDetails {
  description?: string;
  setupNotes?: string;
  retrievalNotes?: string;
}

export interface Quest {
  id: string;
  eventId: string;
  locationId?: string;
  location?: LocationInfo;
  title: string;
  slug: string;
  description: string;
  instructions: string;
  pointValue: number;
  xpReward?: number;
  drawingEntryReward?: number;
  difficulty: QuestDifficulty;
  category: QuestCategory;
  verificationType: ProofVerificationType;
  targetCode?: string;
  proofRequirement: string;
  isFlash: boolean;
  startsAt?: string;
  expiresAt?: string;
  status: 'active' | 'inactive' | 'draft';
  sortOrder: number;
  createdAt: string;

  // Safety, GM & Multi-step Fields
  safetyNotes?: string;
  gmNotes?: string;
  steps?: QuestStep[];

  // Admin-only physical deployment fields (Fair QR Hunt placement workflow) —
  // always stripped from PublicQuestView, never returned to a player.
  placementDetails?: QuestPlacementDetails;
  placedAt?: string;

  // Phase 2, 3 & 4 Fields
  radiusMeters?: number;
  prerequisiteQuestId?: string;
  unlockConditionType?: QuestUnlockConditionType;
  requireLocationVerification?: boolean;
  requireQrAndLocation?: boolean;
  claimLimit?: number;
  currentClaims?: number;
  isSecret?: boolean;
  isFinaleQuest?: boolean;
  raceRewards?: QuestRaceBonusTier[];
  hints?: { id: string; hintText: string; costPoints: number }[];
  riskReward?: { hardModeBonus: number; failurePenalty: number };
  requiredCollectibleId?: string;
  qrCodeIdentifier?: string;
  startingPath?: QuestPath;

  // Structured, reusable reward template. Optional — quests without one
  // fall back to the flat pointValue/xpReward/raceRewards fields above.
  // See lib/quest-rewards.ts for the resolver that reads this.
  rewardConfig?: QuestRewardConfig;

  /** Extra accepted text-answer synonyms, checked alongside targetCode. Case/whitespace-insensitive. */
  acceptedAnswerVariants?: string[];

  /**
   * Marks a quest whose primary completion can happen via a non-location
   * verification type (e.g. passphrase) AND that also defines field-only
   * rewardConfig bonuses (fieldCheckInBonusXp/photoVideoBonusXp/nfcBonusXp)
   * meant to be collected later, in person, as separate follow-up
   * submissions. When true, a later submission with a different proofType
   * is allowed even after the quest is already verified — it grants only
   * the newly-eligible bonus, never re-grants the base completion. Every
   * other quest keeps today's one-submission-then-locked behavior.
   */
  remoteCapable?: boolean;

  /** A one-time sector-introduction Commander transmission, carried on the first quest of a sector. */
  sectorIntroTransmission?: QuestCommanderTransmission;
  /** Shown when a player first opens this quest (the "quest intro" trigger). */
  commanderTransmission?: QuestCommanderTransmission;
  /** Optional mid-quest milestone/checkpoint transmission (e.g. after a multi_step's first step). */
  milestoneTransmission?: QuestCommanderTransmission;
  /** Shown once the quest is verified complete, alongside/after the reward moment. */
  completionTransmission?: QuestCommanderTransmission;
  /** Shown the moment a hidden/secret quest first becomes visible to a player. */
  discoveryTransmission?: QuestCommanderTransmission;
}

/**
 * A reusable, generic "Commander transmission" — narrative framing shown
 * before/after a quest, sector, or any other game moment (GM live
 * announcements, finale beats, milestones). The actual media file is
 * referenced only by a configurable key; no binary media is created or
 * required by this type. Every field beyond `type`/`message` is optional so
 * existing transmissions (Challenge sector) keep working unchanged.
 */
export interface QuestCommanderTransmission {
  /** Default is PHOTO_MESSAGE — reserve VIDEO for genuinely important moments. */
  type: 'VIDEO' | 'PHOTO_MESSAGE';
  /** Body copy, rendered as the Commander's quoted message. */
  message: string;
  /** Short eyebrow/title shown above the message (e.g. "SIGNAL IDENTIFIED"). Defaults to a generic "INCOMING TRANSMISSION" label when unset. */
  headline?: string;
  /** Configurable placeholder key for the video/photo asset — not a real file path yet. */
  mediaKey?: string;
  /** Poster/thumbnail key shown before a VIDEO plays or if it fails to load. */
  posterKey?: string;
  /** What to render if the primary `type`'s media isn't available yet (e.g. VIDEO with a PHOTO_MESSAGE fallback). */
  fallbackType?: 'PHOTO_MESSAGE';
  /** Text shown in place of the message if a VIDEO fails to load and no PHOTO_MESSAGE fallback is configured. */
  fallbackMessage?: string;
  /** CTA button label. Defaults to "CONTINUE". */
  cta?: string;
  /** If true, the player can re-open this transmission after first viewing (see lib/transmission-viewed-state.ts). Defaults to true for most triggers. */
  replayable?: boolean;
  /** If false, the CTA/skip control is hidden and the transmission must play/be read in full (rare — use sparingly). Defaults to true. */
  skippable?: boolean;
  /** VIDEO framing. Defaults to 'video' (16:9) — the existing per-quest placeholder treatment. 'portrait' (9:16) is used by the real numbered Commander videos (see lib/commander-transmissions.ts). */
  mediaAspect?: 'video' | 'portrait';
  /** ISO timestamp — when set, the transmission UI may render a live countdown to this instant (e.g. a Flash Drop's remaining window). Purely presentational; never the authority for whether anything is actually still active. */
  countdownEndsAt?: string;
}

export interface QuestRaceBonusTier {
  place: number;
  bonusPoints: number;
}

/**
 * A quest's full reward template: a base completion reward plus any number
 * of optional bonus paths and unlocks. Every field is optional so a quest
 * can populate only the pieces that apply to it — the resolver in
 * lib/quest-rewards.ts fills gaps from the quest's legacy flat fields
 * (pointValue/xpReward/raceRewards) where this config leaves them unset.
 */
export interface QuestRewardConfig {
  /** Base XP for completing the quest's primary verification step. */
  baseXp?: number;
  /** Extra XP for a GPS-verified physical check-in, beyond the base reward. */
  fieldCheckInBonusXp?: number;
  /** Extra XP for scanning/tapping an NFC field cache tied to this quest. */
  nfcBonusXp?: number;
  /**
   * Extra Entry Token(s) for scanning/tapping an NFC field cache — separate
   * from nfcBonusXp's XP. Standard NFC caches leave this unset (0): NFC is
   * XP/collectible/unlock only by default. Only specific, explicitly
   * configured caches (e.g. a rare "Founder Cache") set this to grant an
   * additional Entry Token. Gated identically to nfcBonusXp — only applies
   * when the submission context reports usedNfc.
   */
  nfcCacheEntryBonus?: number;
  /** Extra XP for submitting photo or video proof beyond what's required. */
  photoVideoBonusXp?: number;
  /** Placement-based bonus XP for early finishers (race/flash quests). */
  raceBonus?: QuestRaceBonusTier[];
  /**
   * Extra Entry Token(s) beyond the quest's normal completion entry —
   * awarded unconditionally on quest completion (not gated by method).
   * Reserved for individual special/hidden quests and GM events that
   * explicitly configure additional entries; do not set this to make XP
   * bonuses grant entries — they never should (see lib/quest-rewards.ts).
   */
  drawingEntryBonus?: number;
  /** Achievement slugs granted when this quest is completed. */
  badgeUnlockSlugs?: string[];
  /** Collectible ids granted when this quest is completed. */
  collectibleUnlockIds?: string[];
  /** Quest ids that become available once this quest is completed. */
  secretQuestUnlockIds?: string[];
  /** The Founder's Three Locks fragment this quest awards, if any. */
  threeLocksFragment?: { lock: 'mark' | 'code' | 'word'; collectibleId: string };
  /** Hidden district-fragment keys granted after server-verified completion. */
  cipherFragmentKeys?: string[];
  /** Whether completing this quest counts toward finale qualification. */
  countsTowardFinale?: boolean;
}

/**
 * The reason a single reward-grant ledger row exists. One row is written
 * per distinct component of a quest's reward (base XP, each eligible
 * bonus, race tier, badge, collectible, etc.) so every award is auditable
 * and individually idempotent — see lib/quest-rewards.ts and the
 * award-granting functions in lib/game-engine.ts / lib/supabase-db.ts.
 */
export type RewardGrantReason =
  | 'QUEST_BASE'
  | 'QUEST_FIELD_CHECKIN'
  | 'QUEST_NFC'
  | 'QUEST_PHOTO_VIDEO'
  | 'QUEST_RACE_BONUS'
  | 'QUEST_DRAWING_ENTRY_BONUS'
  | 'BADGE_UNLOCK'
  | 'COLLECTIBLE_UNLOCK'
  | 'SECRET_UNLOCK'
  | 'THREE_LOCKS_FRAGMENT'
  | 'FINALE_PROGRESS'
  | 'PROFILE_COMPLETION'
  | 'PLAYER_LINK'
  | 'NPC_CLAIM'
  | 'BOUNTY_COMPLETE';

export interface RewardGrant {
  id: string;
  eventId: string;
  playerId: string;
  questId?: string;
  submissionId?: string;
  rewardType: RewardGrantReason;
  /** What was granted within rewardType — a quest id, badge slug, collectible id, etc. */
  rewardKey: string;
  xpAwarded: number;
  drawingEntriesAwarded: number;
  createdAt: string;
}

export interface QuestSubmission {
  id: string;
  questId: string;
  playerId: string;
  eventId: string;
  proofType: ProofVerificationType;
  submittedContent?: string;
  proofUrl?: string;
  status: SubmissionStatus;
  awardedPoints: number;
  drawingEntriesAwarded?: number;
  completedStepOrder?: number;
  feedback?: string;
  reviewerNotes?: string;
  reviewFlags?: ProofReviewFlag[];
  retryRequested?: boolean;
  submittedAt: string;
  reviewedAt?: string;
  userLat?: number;
  userLon?: number;
  distanceFromLocation?: number;
  claimPlacement?: number;
}

export interface ScoreLedgerEntry {
  id: string;
  eventId: string;
  playerId: string;
  questId?: string;
  submissionId?: string;
  points: number;
  category: string;
  description: string;
  awardedAt: string;
  adminIdentity?: string;
}

export interface DrawingEntryLedgerEntry {
  id: string;
  eventId: string;
  playerId: string;
  questId?: string;
  submissionId?: string;
  entriesCount: number;
  sourceType: string;
  reason: string;
  createdAt: string;
}

export type DrawingStatus = 'open' | 'review' | 'locked' | 'drawn' | 'published' | 'cancelled';

export interface CanonicalSnapshotPlayer {
  publicPlayerLabel: string;
  publicParticipantId?: string; // Deterministic privacy-safe hash (e.g. SHA-256(playerId + eventId).slice(0,8))
  entries: number;
}

export interface CanonicalSnapshot {
  eventId: string;
  players: CanonicalSnapshotPlayer[];
}

export interface EventDrawingLedgerLock {
  eventId: string;
  isLocked: boolean;
  status: DrawingStatus;
  lockedAt?: string;
  lockReason?: string;
  lockedBy?: string;
  snapshotHash?: string;
  canonicalSnapshot?: CanonicalSnapshot;
  totalQualifiedEntries?: number;
  totalQualifiedPlayers?: number;
  updatedAt?: string;
}

export interface PublicPlayerDrawingEntry {
  playerPublicLabel: string;
  totalQualifiedEntries: number;
}

export interface PublicDrawingLedgerProjection {
  eventId: string;
  totalEntriesAcrossAllPlayers: number;
  ledgerLockStatus: DrawingStatus;
  ledgerLockTimestamp: string | null;
  playerEntries: PublicPlayerDrawingEntry[];
}

export type DrawMethod = 'final_quest' | 'internal_test' | 'random_org' | 'manual_external';

export interface FinalQuestEventMetrics {
  totalPlayers: number;
  totalValidEntries: number;
  totalCompletedQuests: number;
  totalFinishers: number;
}

export interface FinalQuestTrailStep {
  stepIndex: number;
  windowString: string;
  parsedTicketNumber: number;
  isValid: boolean;
  reason: string;
}

export interface FinalQuestTicketRange {
  publicPlayerLabel: string;
  publicParticipantId?: string;
  startTicket: number;
  endTicket: number;
  ticketCount: number;
}

export interface FinalQuestDrawReceipt {
  eventId: string;
  eventTitle: string;
  totalTickets: number;
  ticketWidth: number;
  eventMetrics: FinalQuestEventMetrics;
  permanentNumber: string;
  productFormula: string;
  finalQuestNumber: string;
  trailSteps: FinalQuestTrailStep[];
  winningTicket: number;
  winningPublicPlayerLabel: string;
  winningPublicParticipantId?: string;
  winningPlayerTicketRange: { start: number; end: number };
  allTicketRanges: FinalQuestTicketRange[];
  resolutionMethod: 'forward_trail' | 'reverse_trail' | 'deterministic_modulo_fallback';
  lockedLedgerHash: string;
  drawnAt: string;
}

export interface PrizeDrawRecord {
  id: string;
  eventId: string;
  prizeId: string;
  prizeTitle: string;
  status: 'drawn' | 'published' | 'cancelled';
  lockedLedgerHash: string;
  lockedAt: string;
  drawMethod: DrawMethod;
  providerReference?: string;
  drawnAt: string;
  winningPlayerId: string; // PRIVATE - stored server-side, NOT exposed publicly
  winningPublicPlayerLabel: string;
  selectedWeightedEntryIndex: number;
  auditMetadata: Record<string, any>;
  publishedAt?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  createdAt: string;
}

export interface PublicPrizeDrawResult {
  drawRecordId: string;
  prizeId: string;
  prizeTitle: string;
  winnerPublicLabel: string;
  drawMethod: string;
  providerReference?: string;
  drawnAt: string;
  verificationStatus?: string;
  isSystemVerified?: boolean;
  isIndependent?: boolean;
  finalQuestReceipt?: FinalQuestDrawReceipt;
}

export interface AuthenticatedPlayerDrawingQualification {
  playerId: string;
  playerLabel: string;
  qualifiedEntries: number;
  ticketRange?: string | null;
  isQualified: boolean;
}

export interface PublicDrawingPageData {
  eventId: string;
  eventTitle: string;
  ledgerLockStatus: DrawingStatus;
  ledgerLockTimestamp: string | null;
  snapshotHash: string | null;
  canonicalSnapshot?: CanonicalSnapshot | null;
  totalQualifiedEntries: number;
  totalQualifiedPlayers: number;
  publicPlayerEntries: PublicPlayerDrawingEntry[];
  publishedPrizes: PublicPrizeDrawResult[];
  publishedAt: string | null;
  verificationInfo?: string;
  ticketRanges?: FinalQuestTicketRange[];
  authenticatedPlayerQualification?: AuthenticatedPlayerDrawingQualification | null;
}

export interface DrawingLedgerReview {
  eventId: string;
  eventTitle: string;
  ledgerStatus: DrawingStatus;
  totalQualifiedEntries: number;
  totalQualifiedPlayers: number;
  playerEntries: Array<{
    playerId?: string; // Admin view only
    publicPlayerLabel: string;
    entries: number;
    isMinor?: boolean;
  }>;
  pendingSubmissionsCount: number;
  hasPendingSubmissionsWarning: boolean;
}

export interface DrawProvider {
  id: string;
  name: string;
  isIndependent: boolean;
  executeDraw(params: {
    eventId: string;
    prizeId: string;
    prizeTitle: string;
    snapshot: CanonicalSnapshot;
    playerMap: Record<string, { label: string; isMinor?: boolean }>; // label to internal ID mapping for provider
    snapshotHash: string;
    testSeed?: string;
    excludedPlayerIds?: string[];
    manualWinnerPublicLabel?: string;
    manualWinnerPublicParticipantId?: string;
    manualWinnerPlayerId?: string;
    providerReference?: string;
    auditMetadata?: Record<string, any>;
  }): Promise<{
    winningPlayerId: string;
    winningPublicPlayerLabel: string;
    selectedWeightedEntryIndex: number;
    drawMethod: DrawMethod;
    providerReference: string;
    auditMetadata: Record<string, any>;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  profileImageCropZoom?: number;
  profileImageCropX?: number;
  profileImageCropY?: number;
  totalPoints: number;
  questsCompletedCount: number;
  lastScoreTime?: string;
}

export interface PlayerEventProgress {
  totalPoints: number;
  completedQuestIds: string[];
  pendingSubmissionQuestIds: string[];
  completedCount: number;
  availableCount: number;
  rank: number;
  isQualifiedForFinale?: boolean;
}

/**
 * Public-safe Player Roster entry — every registered permanent player
 * identity, regardless of Operation score. Deliberately excludes email,
 * userId, and any other private/auth field; never gated on having scored
 * any points.
 */
export interface PublicRosterEntry {
  id: string;
  displayName: string;
  /** Pre-resolved via resolveAvatarUrl server-side — never the raw storage path. */
  avatarUrl: string;
  profileImageCropZoom?: number;
  profileImageCropX?: number;
  profileImageCropY?: number;
  selectedStartingPath?: StartingPath;
  level: number;
  createdAt: string;
}

/**
 * A player's participation record for one Operation (event_players).
 * Separate from PermanentPlayer identity. `path` here is a LEGACY field —
 * the player's real, universal path lives on Player.selectedStartingPath
 * and applies platform-wide, not per Operation. This field is kept only
 * for backward compatibility with existing rows; do not read it as the
 * source of truth for a player's path.
 */
export interface EventParticipation {
  id: string;
  eventId: string;
  playerId: string;
  /** @deprecated legacy/back-compat only — read Player.selectedStartingPath instead. */
  path?: StartingPath | null;
  registeredAt: string;
}

export interface SubmitProofParams {
  playerId: string;
  questId: string;
  eventId: string;
  proofType: ProofVerificationType;
  submittedContent?: string;
  proofUrl?: string;
  userLat?: number;
  userLon?: number;
  userAccuracyMeters?: number;
  isHardModeOptIn?: boolean;
  stepIndex?: number;
  /** Whether an NFC tag scan was part of this specific submission. No UI currently sets this. */
  usedNfc?: boolean;
}

export interface SubmitProofResult {
  success: boolean;
  submission: QuestSubmission;
  message: string;
  awardedPoints: number;
  /**
   * Entry Tokens newly granted by exactly this submission — not the
   * quest's running total. 0 (or undefined) on a call that granted no new
   * entry (a retry, or a pure-XP field/photo/NFC bonus with no
   * drawingEntryBonus/nfcCacheEntryBonus configured). The Entry Token
   * cinematic must only ever fire when this is > 0.
   */
  drawingEntriesAwarded?: number;
  currentStepCompleted?: number;
  nextStepUnlocked?: QuestStep;
  isQuestFullyCompleted?: boolean;
  unlockedQuestId?: string;
  claimPlacement?: number;
  collectibleAwarded?: Collectible;
  flags?: ProofReviewFlag[];
  oldRank?: number;
  newRank?: number;
  newAchievements?: Array<{
    id: string;
    title: string;
    description: string;
    icon?: string;
    rewardXp?: number;
    rewardEntries?: number;
  }>;
  /** Which Three Locks fragment (if any) this submission newly granted, and full current ownership. */
  threeLocksFragmentAwarded?: 'mark' | 'code' | 'word';
  threeLocksOwned?: { mark: boolean; code: boolean; word: boolean };
  cipherFragmentsAwarded?: string[];
  cipherDistrictsUnlocked?: CipherDistrictKey[];
  readyToDecodeDistricts?: CipherDistrictKey[];
  isFirstCipherFragment?: boolean;
}

export interface LiveAnnouncement {
  id: string;
  eventId: string;
  title: string;
  message: string;
  urgency: AnnouncementUrgency;
  expiresAt?: string;
  linkedQuestId?: string;
  createdAt: string;
}

export interface SecretCode {
  id: string;
  eventId: string;
  code: string;
  description: string;
  bonusPoints: number;
  maxRedemptions?: number;
  currentRedemptions: number;
  expiresAt?: string;
  isActive: boolean;
  grantCollectibleId?: string;
  createdAt: string;
}

export interface CodeRedemption {
  id: string;
  codeId: string;
  playerId: string;
  teamId?: string;
  redeemedAt: string;
  pointsAwarded: number;
}

export interface Collectible {
  id: string;
  name: string;
  slug: string;
  description: string;
  badgeSymbol: string;
  rarity: 'common' | 'rare' | 'legendary';
}

export interface PlayerCollectible {
  id: string;
  playerId: string;
  collectibleId: string;
  earnedAt: string;
  source: string;
  eventId?: string;
  collectible?: Collectible;
}

export interface NPCCharacter {
  id: string;
  eventId: string;
  aliasName: string;
  description: string;
  avatarSymbol: string;
  isActive: boolean;
  currentZone: string;
  clueHint: string;
  secretCode?: string;
  operatorNotes?: string;
  lastSpottedAt: string;
}

export interface BusinessPartnerInfo {
  id: string;
  cityId: string;
  name: string;
  address: string;
  contactNotes?: string;
  publicInstructions: string;
  isActive: boolean;
}

export interface CrowdObjective {
  id: string;
  eventId: string;
  title: string;
  description: string;
  targetCount: number;
  currentCount: number;
  objectiveType: 'total_completions' | 'collectibles_found' | 'teams_active';
  isAchieved: boolean;
  unlockedQuestId?: string;
}

export interface BonusWindow {
  id: string;
  eventId: string;
  title: string;
  multiplier: number;
  flatBonus: number;
  targetCategory?: QuestCategory;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

export interface FinaleQualification {
  id: string;
  eventId: string;
  playerId: string;
  qualifiedAt: string;
  qualificationReason: string;
  isWildcard: boolean;
}

export interface Prize {
  id: string;
  eventId: string;
  title: string;
  sponsorName: string;
  quantity: number;
  eligibilityRule: string;
  winnerPlayerId?: string;
  awardedAt?: string;
}

export interface EventActivityItem {
  id: string;
  type:
    | 'player_joined'
    | 'quest_completed'
    | 'flash_activated'
    | 'submission_pending'
    | 'announcement'
    | 'code_redeemed'
    | 'collectible_earned'
    | 'phase_change'
    | 'bonus_activated'
    | 'finale_qualified'
    | 'audience_vote_launched'
    | 'audience_vote_resolved';
  actorName: string;
  title: string;
  timestamp: string;
  details?: string;
}

// -----------------------------------------------------------------------------
// Phase 5 Spectator Participation Engine Types
// -----------------------------------------------------------------------------

export type AudienceEventType = 'audience_vote' | 'player_benefit' | 'world_event' | 'crowd_meter';

export type AudienceEventStatus =
  | 'draft'
  | 'scheduled'
  | 'voting_active'
  | 'tallying_closed'
  | 'effect_applied'
  | 'resolved'
  | 'cancelled';

export type AudienceEligibilityMode = 'all_spectators' | 'authenticated_only' | 'exclude_active_players';

export type AudienceTargetType = 'category' | 'quest' | 'zone' | 'citywide';

export interface AudienceEvent {
  id: string;
  eventId: string;
  title: string;
  description?: string;
  eventType: AudienceEventType;
  status: AudienceEventStatus;
  isPaused: boolean;
  pausedAt?: string;
  eligibilityMode: AudienceEligibilityMode;
  maxVotesPerSession: number;
  targetType?: AudienceTargetType;
  targetId?: string;
  targetName?: string;
  startsAt?: string;
  endsAt?: string;
  winningOptionId?: string;
  isManuallyOverridden: boolean;
  overrideReason?: string;
  resolvedBy?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicAudienceEvent {
  id: string;
  eventId: string;
  title: string;
  description?: string;
  eventType: AudienceEventType;
  status: AudienceEventStatus;
  isPaused: boolean;
  startsAt?: string;
  endsAt?: string;
  pausedAt?: string;
  eligibilityMode: AudienceEligibilityMode;
  maxVotesPerSession: number;
  publicTargetDescription?: string;
  publicWinningOptionId?: string;
  createdAt: string;
}

export interface AudienceEventOption {
  id: string;
  audienceEventId: string;
  optionLabel: string;
  optionDescription?: string;
  effectPayload: Record<string, any>;
  voteCount: number;
  sortOrder: number;
  createdAt: string;
}

export interface PublicAudienceEventOption {
  id: string;
  audienceEventId: string;
  optionLabel: string;
  optionDescription?: string;
  voteCount: number;
  sortOrder: number;
  createdAt: string;
}

export interface AudienceVote {
  id: string;
  audienceEventId: string;
  optionId: string;
  sessionTokenHash: string;
  voteNumber: number;
  ipHash: string;
  playerId?: string;
  createdAt: string;
}

export type AudienceEffectStatus = 'pending' | 'applied' | 'failed' | 'cancelled' | 'overridden';

export interface AudienceEffect {
  id: string;
  audienceEventId: string;
  effectType: string;
  payload: Record<string, any>;
  status: AudienceEffectStatus;
  appliedAt?: string;
  resolvedAt?: string;
  cancellationReason?: string;
  overrideContext?: string;
  createdBy?: string;
  appliedBy?: string;
  resolvedBy?: string;
  createdAt: string;
}

export interface PublicGameFeedItem {
  id: string;
  eventId: string;
  feedType: string;
  headline: string;
  body?: string;
  districtName?: string;
  urgency: 'info' | 'warning' | 'flash' | 'urgent';
  isHost: boolean;
  isRetracted: boolean;
  isMinorParticipant: boolean;
  isPublicFeedEligible: boolean;
  publishedAt: string;
  createdAt: string;
}

export interface HostBroadcast {
  id: string;
  eventId: string;
  headline: string;
  body: string;
  tone: 'theatrical' | 'urgent' | 'announcement' | 'flash';
  targetChannel?: 'all' | 'spectators' | 'players' | 'internal';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  isPublished?: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SpectatorSession {
  id: string;
  sessionTokenHash: string;
  ipHash: string;
  convertedToPlayerId?: string;
  isMinor: boolean;
  ageAcknowledgedAt?: string;
  safetyAcknowledgedAt?: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface SpectatorSystemSettings {
  eventId: string;
  isSpectatorSystemDisabled: boolean;
  disabledReason?: string;
  disabledAt?: string;
  updatedAt: string;
}

export type LiveTimelineActionType =
  | 'phase_change'
  | 'audience_vote_opened'
  | 'audience_vote_closed'
  | 'audience_resolved'
  | 'audience_overridden'
  | 'audience_cancelled'
  | 'spectator_freeze'
  | 'spectator_unfreeze'
  | 'effect_executed'
  | 'flash_quest_triggered'
  | 'host_broadcast_published'
  | 'emergency_pause'
  | 'emergency_resume'
  | 'event_ended'
  | 'rehearsal_executed'
  | 'launch_gate_evaluated';

export interface LiveEventTimelineEntry {
  id: string;
  eventId: string;
  actionType: LiveTimelineActionType;
  title: string;
  details: string;
  actor: string;
  metadata?: Record<string, any>;
  isRehearsal?: boolean;
  createdAt: string;
}

export interface AudienceEffectExecutionResult {
  success: boolean;
  effectId: string;
  audienceEventId: string;
  winningOptionId?: string;
  actionTaken: string;
  details: Record<string, any>;
  executedAt: string;
  isDuplicatePrevented?: boolean;
  isRehearsal?: boolean;
  error?: string;
}

export interface AudienceVoteSimulationResult {
  success: boolean;
  simulatedEvent: AudienceEvent;
  totalVotesSimulated: number;
  options: AudienceEventOption[];
  winningOption: AudienceEventOption;
  simulatedEffectPreview: Record<string, any>;
  broadcastPreview: { headline: string; body: string };
  isRehearsal: true;
}

// -----------------------------------------------------------------------------
// Phase 5.4 Real Event Readiness & Launch Rehearsal Types
// -----------------------------------------------------------------------------

export type ReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'NOT_CONFIGURED';

export type OverallLaunchAssessment = 'READY_FOR_LIVE_EVENT' | 'READY_WITH_WARNINGS' | 'NOT_READY';

export type ReadinessCategory =
  | 'event_configuration'
  | 'quests_and_chains'
  | 'locations_and_spatial'
  | 'proof_methods'
  | 'qr_codes'
  | 'scoring_and_leaderboard'
  | 'spectator_and_watch'
  | 'host_broadcasts'
  | 'audience_influence'
  | 'game_master_auth'
  | 'emergency_controls'
  | 'prize_and_drawing_isolation';

export interface ReadinessCheckItem {
  id: string;
  category: ReadinessCategory;
  label: string;
  status: ReadinessStatus;
  details: string;
  blockerCount: number;
  warningCount: number;
  remediation?: string;
}

export interface CategoryReadinessSummary {
  status: ReadinessStatus;
  score: number; // 0-100%
  checks: ReadinessCheckItem[];
}

export interface EventReadinessReport {
  eventId: string;
  eventName: string;
  computedAt: string;
  overallStatus: OverallLaunchAssessment;
  categories: Record<ReadinessCategory, CategoryReadinessSummary>;
  summary: {
    totalChecks: number;
    readyCount: number;
    warningCount: number;
    blockedCount: number;
    notConfiguredCount: number;
  };
  blockers: string[];
  warnings: string[];
  recommendedActions: string[];
  metrics: {
    totalQuests: number;
    activeQuests: number;
    qrQuests: number;
    locationQuests: number;
    brokenQuests: number;
    registeredPlayers: number;
    activePhase: EventPhaseType;
    isPaused: boolean;
    isSpectatorFrozen: boolean;
  };
  lastRehearsalCompletedAt?: string;
}

export type QRQuestAuditStatus = 'READY' | 'WARNING' | 'BROKEN';

export interface QRQuestAuditItem {
  questId: string;
  questTitle: string;
  qrCodeIdentifier: string;
  status: QRQuestAuditStatus;
  verificationPath: string;
  isDuplicateAssignment: boolean;
  hasSecretExposed: boolean;
  isEventAssociated: boolean;
  isQuestEnabled: boolean;
  issues: string[];
}

export interface QRReadinessAuditReport {
  totalQrQuests: number;
  readyCount: number;
  warningCount: number;
  brokenCount: number;
  items: QRQuestAuditItem[];
}

export interface QuestAuditItem {
  questId: string;
  title: string;
  category: QuestCategory;
  pointValue: number;
  status: QuestState | EventStatus;
  proofType: ProofVerificationType;
  locationId?: string;
  locationName?: string;
  isLocationBound: boolean;
  isRadiusValid: boolean;
  hasPrerequisite: boolean;
  prerequisiteQuestId?: string;
  isPrerequisiteValid: boolean;
  auditStatus: 'READY' | 'WARNING' | 'BROKEN';
  issues: string[];
}

export interface LaunchGateRule {
  code: string;
  name: string;
  isPassed: boolean;
  severity: 'CRITICAL' | 'WARNING';
  failureReason?: string;
}

export interface LaunchGatesEvaluationResult {
  isLaunchPermitted: boolean;
  passedCount: number;
  failedCriticalCount: number;
  warningCount: number;
  gates: LaunchGateRule[];
  blockingReasons: string[];
}

export interface PreEventChecklistItem {
  id: string;
  label: string;
  description: string;
  category: 'core' | 'quests' | 'spectator' | 'field_ops' | 'safety';
  isAutomated: boolean;
  automatedStatus?: ReadinessStatus;
  isManuallyChecked: boolean;
  checkedBy?: string;
  checkedAt?: string;
}

export interface PreEventChecklistState {
  eventId: string;
  items: PreEventChecklistItem[];
  lastUpdated: string;
}

export interface WalkUpRehearsalStep {
  stepNumber: number;
  title: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  details: string;
  simulatedData?: Record<string, any>;
}

export interface WalkUpRehearsalResult {
  id: string;
  eventId: string;
  executedAt: string;
  durationMs: number;
  isSuccess: boolean;
  isRehearsal: true;
  steps: WalkUpRehearsalStep[];
  simulatedPlayer: {
    id: string;
    name: string;
    earnedXp: number;
    finalRank: number;
  };
  productionDataVerifiedUntouched: boolean;
}

export interface FullEventRehearsalPhaseResult {
  phase: EventPhaseType;
  status: 'PASSED' | 'FAILED';
  actionsExecuted: string[];
  details: string;
}

export interface FullEventRehearsalResult {
  id: string;
  eventId: string;
  executedAt: string;
  durationMs: number;
  isSuccess: boolean;
  isRehearsal: true;
  phases: FullEventRehearsalPhaseResult[];
  simulatedPlayerCount: number;
  simulatedQuestsCompleted: number;
  simulatedVotesCast: number;
  simulatedEffectsExecuted: number;
  productionDataVerifiedUntouched: boolean;
  summary: string;
}
