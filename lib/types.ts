// Canton Quests — Phase 1 Core Domain Types

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

export interface LocationInfo {
  id: string;
  cityId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  locationNotes?: string;
  isPartner: boolean;
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
  expiresAt?: string;
  status: 'active' | 'inactive' | 'draft';
  sortOrder: number;
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
  feedback?: string;
  submittedAt: string;
  reviewedAt?: string;
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
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  displayName: string;
  avatarUrl?: string;
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
}

export interface SubmitProofResult {
  success: boolean;
  submission: QuestSubmission;
  message: string;
  awardedPoints: number;
}
