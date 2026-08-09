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

export type ProofVerificationType = 'checkin' | 'qr' | 'passphrase' | 'photo' | 'video';

export type SubmissionStatus = 'pending' | 'verified' | 'rejected' | 'retry_requested';

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
  teamId?: string;
  isHardModeOptIn?: boolean;
}

export interface SubmitProofResult {
  success: boolean;
  submission: QuestSubmission;
  message: string;
  awardedPoints: number;
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
    | 'finale_qualified';
  actorName: string;
  title: string;
  timestamp: string;
  details?: string;
}
