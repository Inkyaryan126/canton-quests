import type { GridContestComparison } from './contest-types';
import type { GridNpcStrongholdObjective, GridNpcStrongholdProjection } from './npc-stronghold-types';

export type GridPveStrongholdContestStatus =
  | 'active'
  | 'captured'
  | 'repelled'
  | 'withdrawn';

export interface GridPveStrongholdContestState {
  strongholdId: string;
  factionId: string;
  objective: GridNpcStrongholdObjective;
  status: GridPveStrongholdContestStatus;
  roundNumber: number;
  attackerInitialInfluence: number;
  attackerRemainingInfluence: number;
  garrisonInitialInfluence: number;
  garrisonRemainingInfluence: number;
}

export interface GridStartPveStrongholdContestInput {
  stronghold: GridNpcStrongholdProjection;
  attackerCommittedInfluence: number;
}

export interface GridResolvePveStrongholdRoundInput {
  state: GridPveStrongholdContestState;
  attackerRolls: number[];
  garrisonRolls: number[];
}

export interface GridPveStrongholdRoundResult {
  state: GridPveStrongholdContestState;
  comparisons: GridContestComparison[];
  attackerInfluenceLost: number;
  garrisonInfluenceLost: number;
}
