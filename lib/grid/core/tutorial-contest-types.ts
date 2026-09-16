import type {
  GridContestRoundResult,
} from './contest-types';

export type GridTutorialContestPhase =
  | 'reinforce'
  | 'contest'
  | 'continue'
  | 'withdraw'
  | 'complete';

export interface GridTutorialContestConfig {
  attackerInitialCommitInfluence: number;
  attackerReserveInfluence: number;
  reinforcementInfluence: number;
  defenderCommittedInfluence: number;
}

export interface GridTutorialContestLessons {
  reinforce: boolean;
  contest: boolean;
  continue: boolean;
  withdraw: boolean;
}

export interface GridTutorialContestRound {
  roundNumber: number;
  result: GridContestRoundResult;
}

export interface GridTutorialContestState {
  phase: GridTutorialContestPhase;
  safeMode: true;
  liveResourceDelta: 0;
  attackerCommittedInfluence: number;
  attackerReserveInfluence: number;
  defenderCommittedInfluence: number;
  lessons: GridTutorialContestLessons;
  rounds: GridTutorialContestRound[];
}

export type GridTutorialContestAction =
  | { type: 'reinforce' }
  | {
      type: 'contest';
      attackerRolls: number[];
      defenderRolls: number[];
    }
  | {
      type: 'continue';
      attackerRolls: number[];
      defenderRolls: number[];
    }
  | { type: 'withdraw' };
