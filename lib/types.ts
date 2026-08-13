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
  | 'finale';

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

export interface Player {
  id: string;
  userId?: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  totalXp: number;
  level: number;
  createdAt: string;
}

export interface Team {
  id: string;
  eventId: string;
  name: string;
  joinCode: string;
  captainId: string;
  avatarSymbol?: string;
  totalPoints: number;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  playerId: string;
  joinedAt: string;
  player?: Player;
}

export interface TeamLeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  joinCode: string;
  captainId: string;
  captainName: string;
  memberCount: number;
  totalPoints: number;
  questsCompletedCount: number;
  lastScoreTime?: string;
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

export interface QuestStep {
  id: string;
  questId: string;
  stepOrder: number;
  title: string;
  instructions: string;
  verificationType: ProofVerificationType;
  targetCode?: string;
  locationId?: string;
  location?: LocationInfo;
  radiusMeters?: number;
}

export type PublicQuestStep = Omit<QuestStep, 'targetCode'>;
export type PublicQuestView = Omit<Quest, 'targetCode' | 'gmNotes' | 'steps'> & {
  steps?: PublicQuestStep[];
};

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
  raceRewards?: { place: number; bonusPoints: number }[];
  hints?: { id: string; hintText: string; costPoints: number }[];
  riskReward?: { hardModeBonus: number; failurePenalty: number };
  requiredCollectibleId?: string;
}

export interface QuestSubmission {
  id: string;
  questId: string;
  playerId: string;
  teamId?: string;
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
  teamId?: string;
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

export type DrawMethod = 'internal_test' | 'random_org' | 'manual_external';

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
  totalPoints: number;
  questsCompletedCount: number;
  lastScoreTime?: string;
  teamName?: string;
}

export interface PlayerEventProgress {
  totalPoints: number;
  completedQuestIds: string[];
  pendingSubmissionQuestIds: string[];
  completedCount: number;
  availableCount: number;
  rank: number;
  team?: Team;
  isQualifiedForFinale?: boolean;
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
  teamId?: string;
  isHardModeOptIn?: boolean;
  stepIndex?: number;
}

export interface SubmitProofResult {
  success: boolean;
  submission: QuestSubmission;
  message: string;
  awardedPoints: number;
  drawingEntriesAwarded?: number;
  currentStepCompleted?: number;
  nextStepUnlocked?: QuestStep;
  isQuestFullyCompleted?: boolean;
  unlockedQuestId?: string;
  teamPointsAwarded?: number;
  claimPlacement?: number;
  collectibleAwarded?: Collectible;
  flags?: ProofReviewFlag[];
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
  teamId?: string;
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
    | 'team_created'
    | 'team_joined'
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

export type AudienceTargetType = 'category' | 'quest' | 'team' | 'zone' | 'citywide';

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
