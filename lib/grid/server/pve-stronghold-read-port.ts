import type { GridPveStrongholdContestStatus } from '../core/pve-stronghold-contest-types';

export interface GridPveStrongholdReadContext {
  contestId: string;
  attackerPlayerId: string;
  strongholdId: string;
  factionId: string;
  sourceTerritorySlug: string;
  targetTerritorySlug: string;
  objectiveKind: 'pve-territory' | 'pve-landmark';
  landmarkSlug: string | null;
  attackerCommittedInfluence: number;
  garrisonCommittedInfluence: number;
  attackerRemainingInfluence: number;
  garrisonRemainingInfluence: number;
  roundNumber: number;
  status: GridPveStrongholdContestStatus;
  startedAt: string;
  endedAt: string | null;
}

export interface GridPveStrongholdReadPort {
  listActiveForPlayer(playerId: string): Promise<GridPveStrongholdReadContext[]>;
  getById(contestId: string): Promise<GridPveStrongholdReadContext | null>;
}
