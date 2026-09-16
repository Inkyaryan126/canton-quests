import type { GridDevelopmentBranch } from '../core/economy-types';

export type GridReturnViewerRole =
  | 'attacker'
  | 'defender'
  | 'actor'
  | 'none';

export type GridReturnContestOutcome =
  | 'active'
  | 'captured'
  | 'defended'
  | 'withdrawn'
  | 'cancelled'
  | null;

export interface GridReturnOwnedProperty {
  propertySlug: string;
  developmentBranch: GridDevelopmentBranch | null;
  developmentLevel: number;
}

export interface GridReturnResourceState {
  credits: number;
  influence: number;
  commandPoints: number;
  commandPointsUpdatedAt: string;
  resourcesSettledAt: string;
  creditsAccrualRemainder: number;
  influenceAccrualRemainder: number;
  ownedTerritorySlugs: string[];
  ownedProperties: GridReturnOwnedProperty[];
}

export interface GridReturnSummaryContext {
  cityId: string;
  seasonId: string;
  lastActiveAt: string;
  resources: GridReturnResourceState;
}

export interface GridReturnActivityEvent {
  eventType: string;
  entityType: string | null;
  createdAt: string;
  viewerRole: GridReturnViewerRole;
  contestOutcome: GridReturnContestOutcome;
}

export interface GridReturnActivityBatch {
  events: GridReturnActivityEvent[];
  truncated: boolean;
}

export interface GridReturnSummaryPort {
  getContext(playerId: string): Promise<GridReturnSummaryContext | null>;
  listActivity(
    seasonId: string,
    playerId: string,
    since: string,
    limit: number,
  ): Promise<GridReturnActivityBatch>;
}
