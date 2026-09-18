import type { GridNpcStrongholdProjection } from '../core/npc-stronghold-types';
import type { GridPveStrongholdContestStatus } from '../core/pve-stronghold-contest-types';

export interface GridPveStrongholdStartContextRequest {
  attackerPlayerId: string;
  sourceTerritoryId: string;
  strongholdId: string;
  now: string;
}

export interface GridPveStrongholdStartContext {
  seasonId: string;
  cityId: string;
  attackerPlayerId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  stronghold: GridNpcStrongholdProjection;
}

export interface GridStartPveStrongholdSessionCommand {
  seasonId: string;
  cityId: string;
  strongholdId: string;
  factionId: string;
  attackerPlayerId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  objectiveKind: 'pve-territory' | 'pve-landmark';
  landmarkSlug: string | null;
  attackerCommittedInfluence: number;
  garrisonCommittedInfluence: number;
  idempotencyKey: string;
  now: string;
}

export interface GridStartPveStrongholdSessionResult {
  contestId: string;
  seasonId: string;
  cityId: string;
  strongholdId: string;
  factionId: string;
  attackerPlayerId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  status: GridPveStrongholdContestStatus;
  attackerCommittedInfluence: number;
  garrisonCommittedInfluence: number;
  startedAt: string;
  eventId: string;
}

export interface GridPveStrongholdRoundContext {
  contestId: string;
  attackerPlayerId: string;
  status: GridPveStrongholdContestStatus;
  attackerRemainingInfluence: number;
  garrisonRemainingInfluence: number;
}

export interface GridResolvePveStrongholdRoundCommand {
  contestId: string;
  attackerPlayerId: string;
  attackerRolls: number[];
  garrisonRolls: number[];
  idempotencyKey: string;
  now: string;
}

export interface GridResolvePveStrongholdRoundResult {
  contestId: string;
  seasonId: string;
  cityId: string;
  strongholdId: string;
  roundNumber: number;
  status: GridPveStrongholdContestStatus;
  attackerRolls: number[];
  garrisonRolls: number[];
  attackerInfluenceLost: number;
  garrisonInfluenceLost: number;
  attackerRemainingInfluence: number;
  garrisonRemainingInfluence: number;
  attackerRefundedInfluence: number;
  territoryCaptured: boolean;
  eventId: string;
}

export interface GridPveStrongholdSessionPort {
  getStartContext(
    request: GridPveStrongholdStartContextRequest,
  ): Promise<GridPveStrongholdStartContext>;
  startContest(
    command: GridStartPveStrongholdSessionCommand,
  ): Promise<GridStartPveStrongholdSessionResult>;
  getRoundContext(contestId: string): Promise<GridPveStrongholdRoundContext>;
  resolveRound(
    command: GridResolvePveStrongholdRoundCommand,
  ): Promise<GridResolvePveStrongholdRoundResult>;
}
