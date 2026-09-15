import type { GridDevelopmentBranch } from '../core/economy-types';

export interface GridPropertyCommandBase {
  seasonId: string;
  playerId: string;
  propertyId: string;
  idempotencyKey: string;
  now: string;
}

export type GridAcquirePropertyCommand = GridPropertyCommandBase;

export interface GridDevelopPropertyCommand extends GridPropertyCommandBase {
  branch: GridDevelopmentBranch;
}

export interface GridPropertyMutationResult {
  seasonId: string;
  cityId: string;
  playerId: string;
  propertyId: string;
  propertySlug: string;
  territoryId: string;
  creditsSpent: number;
  commandPointsSpent: number;
  credits: number;
  influence: number;
  commandPoints: number;
  eventId: string;
}
export interface GridPropertyAcquisitionResult extends GridPropertyMutationResult {
  acquiredAt: string;
}

export interface GridPropertyDevelopmentResult extends GridPropertyMutationResult {
  developmentBranch: GridDevelopmentBranch;
  previousLevel: number;
  developmentLevel: number;
  developedAt: string;
  skylineEventId: string | null;
  skylineRuleIds: string[];
}

export interface GridPropertyCommandPort {
  acquireProperty(
    command: GridAcquirePropertyCommand,
  ): Promise<GridPropertyAcquisitionResult>;
  developProperty(
    command: GridDevelopPropertyCommand,
  ): Promise<GridPropertyDevelopmentResult>;
}