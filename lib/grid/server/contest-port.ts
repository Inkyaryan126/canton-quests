import type { GridContestRoundResult } from '../core/contest-types';

export interface GridContestRoundCommand {
  seasonId: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  attackerCommittedInfluence: number;
  defenderCommittedInfluence: number;
  attackerRolls: number[];
  defenderRolls: number[];
  idempotencyKey: string;
  now: string;
}

export interface GridContestRoundCommandResult extends GridContestRoundResult {
  seasonId: string;
  cityId: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  attackerCommittedInfluence: number;
  defenderCommittedInfluence: number;
  attackerRolls: number[];
  defenderRolls: number[];
  eventId: string;
}

export interface GridContestRoundPort {
  resolveRound(
    command: GridContestRoundCommand,
  ): Promise<GridContestRoundCommandResult>;
}
