import type {
  GridContestComparison,
  GridContestRoundResult,
} from '../core/contest-types';
import type { GridContestSessionStatus } from './contest-session-port';

export interface GridContestSessionRoundContext {
  contestId: string;
  seasonId: string;
  attackerPlayerId: string;
  attackerRemainingInfluence: number;
  defenderRemainingInfluence: number;
  status: GridContestSessionStatus;
}

export interface GridContestSessionRoundCommand {
  contestId: string;
  attackerPlayerId: string;
  attackerRolls: number[];
  defenderRolls: number[];
  idempotencyKey: string;
  now: string;
}

export interface GridContestSessionRoundResult
  extends Pick<
    GridContestRoundResult,
    | 'attackerInfluenceLost'
    | 'defenderInfluenceLost'
    | 'attackerRemainingInfluence'
    | 'defenderRemainingInfluence'
  > {
  contestId: string;
  seasonId: string;
  cityId: string;
  roundNumber: number;
  status: GridContestSessionStatus;
  attackerRolls: number[];
  defenderRolls: number[];
  comparisons: GridContestComparison[];
  attackerRefundedInfluence: number;
  defenderRefundedInfluence: number;
  territoryCaptured: boolean;
  eventId: string;
}

export interface GridContestSessionRoundPort {
  getRoundContext(contestId: string): Promise<GridContestSessionRoundContext>;
  resolveRound(
    command: GridContestSessionRoundCommand,
  ): Promise<GridContestSessionRoundResult>;
}
