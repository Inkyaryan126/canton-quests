// Canton Quests — Core Domain Types

export type UserRole = 'player' | 'admin' | 'partner';

export type EventStatus = 'draft' | 'upcoming' | 'active' | 'ended';

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
  | 'secret';

export type ProofVerificationType = 'checkin' | 'qr' | 'passphrase' | 'photo' | 'video';

export type SubmissionStatus = 'pending' | 'verified' | 'rejected';

export type QuestUnlockConditionType = 'none' | 'prerequisite' | 'scheduled' | 'manual';

export type QuestState = 'available' | 'completed' | 'pending' | 'locked' | 'flash' | 'expired' | 'hidden';

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
  startTime?: string;
  endTime?: string;
  basicInstructions?: string;
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
  targetCode?: string; // Correct answer or QR token hash
  proofRequirement: string;
  isFlash: boolean;
  startsAt?: string;
  expiresAt?: string;
  status: 'active' | 'inactive' | 'draft';
  sortOrder: number;
  createdAt: string;

  // Phase 2 Fields
  radiusMeters?: number;
  prerequisiteQuestId?: string;
  unlockConditionType?: QuestUnlockConditionType;
  requireLocationVerification?: boolean;
  requireQrAndLocation?: boolean;
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
  submittedAt: string;
  reviewedAt?: string;
  userLat?: number;
  userLon?: number;
  distanceFromLocation?: number;
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
}

export interface SubmitProofResult {
  success: boolean;
  submission: QuestSubmission;
  message: string;
  awardedPoints: number;
  unlockedQuestId?: string;
  teamPointsAwarded?: number;
}

export interface EventActivityItem {
  id: string;
  type: 'player_joined' | 'team_created' | 'team_joined' | 'quest_completed' | 'flash_activated' | 'submission_pending';
  actorName: string;
  title: string;
  timestamp: string;
  details?: string;
}

