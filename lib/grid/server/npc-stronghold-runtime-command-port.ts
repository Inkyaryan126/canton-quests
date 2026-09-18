export interface GridNpcRuntimeCommandBase {
  seasonId: string;
  cityId: string;
  actorPlayerId: string | null;
  idempotencyKey: string;
  now: string;
}

export interface GridSetNpcSurgeIntensityCommand extends GridNpcRuntimeCommandBase {
  surgeIntensityBps: number | null;
}

export interface GridSetNpcFactionPressureCommand extends GridNpcRuntimeCommandBase {
  factionId: string;
  pressureBps: number;
}

export interface GridSetNpcStrongholdEventCommand extends GridNpcRuntimeCommandBase {
  strongholdId: string;
  active: boolean;
}

export interface GridNpcRuntimeCommandResult {
  eventId: string;
  duplicate: boolean;
  updatedAt: string;
}

export interface GridNpcSurgeIntensityCommandResult extends GridNpcRuntimeCommandResult {
  surgeIntensityBps: number | null;
}

export interface GridNpcFactionPressureCommandResult extends GridNpcRuntimeCommandResult {
  factionId: string;
  pressureBps: number;
}

export interface GridNpcStrongholdEventCommandResult extends GridNpcRuntimeCommandResult {
  strongholdId: string;
  active: boolean;
}

export interface GridNpcStrongholdRuntimeCommandPort {
  setSurgeIntensity(
    command: GridSetNpcSurgeIntensityCommand,
  ): Promise<GridNpcSurgeIntensityCommandResult>;
  setFactionPressure(
    command: GridSetNpcFactionPressureCommand,
  ): Promise<GridNpcFactionPressureCommandResult>;
  setStrongholdEvent(
    command: GridSetNpcStrongholdEventCommand,
  ): Promise<GridNpcStrongholdEventCommandResult>;
}
