export type GridContestSessionStatus =
  | 'active'
  | 'captured'
  | 'defended'
  | 'withdrawn'
  | 'cancelled';

export interface GridStartContestCommand {
  seasonId: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  attackerCommittedInfluence: number;
  defenderCommittedInfluence: number;
  idempotencyKey: string;
  now: string;
}

export interface GridStartContestResult {
  contestId: string;
  seasonId: string;
  cityId: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  attackerCommittedInfluence: number;
  defenderCommittedInfluence: number;
  status: GridContestSessionStatus;
  startedAt: string;
  eventId: string;
}

export interface GridWithdrawContestCommand {
  contestId: string;
  attackerPlayerId: string;
  idempotencyKey: string;
  now: string;
}

export interface GridWithdrawContestResult {
  contestId: string;
  seasonId: string;
  cityId: string;
  status: GridContestSessionStatus;
  attackerRefundedInfluence: number;
  defenderRefundedInfluence: number;
  endedAt: string;
  eventId: string;
}

export interface GridContestSessionPort {
  startContest(command: GridStartContestCommand): Promise<GridStartContestResult>;
  withdrawContest(
    command: GridWithdrawContestCommand,
  ): Promise<GridWithdrawContestResult>;
}
