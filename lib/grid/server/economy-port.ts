export interface GridEconomyCommand {
  seasonId: string;
  playerId: string;
  idempotencyKey: string;
  /** ISO timestamp captured once per command so retries settle to the same instant. */
  now: string;
}

export interface GridPlayerSeasonState {
  seasonId: string;
  cityId: string;
  playerId: string;
  credits: number;
  influence: number;
  commandPoints: number;
  commandPointsUpdatedAt: string;
  resourcesSettledAt: string;
  creditsAccrualRemainder: number;
  influenceAccrualRemainder: number;
  /** True only for the first join or its exact idempotent replay. */
  joined: boolean;
  eventId: string | null;
}

export interface GridEconomyCommandPort {
  joinSeason(command: GridEconomyCommand): Promise<GridPlayerSeasonState>;
  settleResources(command: GridEconomyCommand): Promise<GridPlayerSeasonState>;
}
