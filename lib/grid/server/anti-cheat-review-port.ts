import type {
  GridAntiCheatAssessment,
  GridAntiCheatSignal,
} from '../core/anti-cheat-types';

export interface GridAntiCheatReviewCommand {
  cityId: string;
  seasonId: string;
  playerId: string;
  actionId: string;
  assessmentKey: string;
  assessment: GridAntiCheatAssessment;
  signals: readonly GridAntiCheatSignal[];
  createdAt: string;
}

export interface GridAntiCheatReviewResult {
  assessmentId: string;
  idempotent: boolean;
  assessment: GridAntiCheatAssessment;
}

export type GridAntiCheatReviewStatus = 'pending' | 'in-review' | 'resolved';

export interface GridAntiCheatReviewStateCommand {
  assessmentId: string;
  status: GridAntiCheatReviewStatus;
  resolution?: Record<string, unknown> | null;
}

export interface GridAntiCheatReviewQueueItem {
  assessmentId: string;
  cityId: string;
  seasonId: string;
  playerId: string;
  actionId: string;
  assessmentKey: string;
  assessment: GridAntiCheatAssessment;
  signals: GridAntiCheatSignal[];
  status: GridAntiCheatReviewStatus;
  resolution: Record<string, unknown> | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface GridAntiCheatReviewPort {
  recordAssessment(
    command: GridAntiCheatReviewCommand,
  ): Promise<GridAntiCheatReviewResult>;
  listReviewQueue(limit?: number): Promise<GridAntiCheatReviewQueueItem[]>;
  recordReview(
    command: GridAntiCheatReviewStateCommand,
  ): Promise<GridAntiCheatReviewQueueItem>;
}
