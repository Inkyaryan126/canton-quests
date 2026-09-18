import type { GridLocationEnhancementBenefit } from '../core/location-enhancement-types';

export interface GridLocationEnhancementGrantRecord {
  id: string;
  seasonId: string;
  playerId: string;
  ruleId: string;
  verificationId: string;
  benefit: GridLocationEnhancementBenefit;
  idempotencyKey: string;
  claimedAt: string;
}

export interface GridLocationEnhancementGrantInput {
  seasonId: string;
  playerId: string;
  ruleId: string;
  verificationId: string;
  benefit: GridLocationEnhancementBenefit;
  idempotencyKey: string;
  claimedAt: string;
  maxClaimsPerPlayer: number | null;
}

export interface GridLocationEnhancementInsertResult {
  grant: GridLocationEnhancementGrantRecord | null;
  duplicate: boolean;
  limitReached: boolean;
}

export interface GridLocationEnhancementPort {
  findByIdempotencyKey(
    seasonId: string,
    playerId: string,
    idempotencyKey: string,
  ): Promise<GridLocationEnhancementGrantRecord | null>;
  countRuleClaims(
    seasonId: string,
    playerId: string,
    ruleId: string,
  ): Promise<number>;
  insertGrantAtomic(
    input: GridLocationEnhancementGrantInput,
  ): Promise<GridLocationEnhancementInsertResult>;
}
