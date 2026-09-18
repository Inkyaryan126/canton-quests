import type {
  GridNpcFactionPressureCommandResult,
  GridNpcStrongholdEventCommandResult,
  GridNpcStrongholdRuntimeCommandPort,
  GridNpcSurgeIntensityCommandResult,
  GridSetNpcFactionPressureCommand,
  GridSetNpcStrongholdEventCommand,
  GridSetNpcSurgeIntensityCommand,
} from './npc-stronghold-runtime-command-port';

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid NPC runtime command requires ${field}`);
  return normalized;
}

function requireTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('Grid NPC runtime command requires a valid now timestamp');
  }
}

function requireBps(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`Grid NPC runtime command ${field} must be 0..10000 basis points`);
  }
  return value;
}

function base<T extends {
  seasonId: string;
  cityId: string;
  actorPlayerId: string | null;
  idempotencyKey: string;
  now: string;
}>(command: T): T {
  requireText(command.seasonId, 'seasonId');
  requireText(command.cityId, 'cityId');
  if (command.actorPlayerId !== null) requireText(command.actorPlayerId, 'actorPlayerId');
  requireText(command.idempotencyKey, 'a non-empty idempotency key');
  requireTimestamp(command.now);
  return command;
}

export async function setGridNpcSurgeIntensity(
  port: GridNpcStrongholdRuntimeCommandPort,
  command: GridSetNpcSurgeIntensityCommand,
): Promise<GridNpcSurgeIntensityCommandResult> {
  base(command);
  if (command.surgeIntensityBps !== null) {
    requireBps(command.surgeIntensityBps, 'surgeIntensityBps');
  }
  return port.setSurgeIntensity(command);
}

export async function setGridNpcFactionPressure(
  port: GridNpcStrongholdRuntimeCommandPort,
  command: GridSetNpcFactionPressureCommand,
): Promise<GridNpcFactionPressureCommandResult> {
  base(command);
  requireText(command.factionId, 'factionId');
  requireBps(command.pressureBps, 'pressureBps');
  return port.setFactionPressure(command);
}

export async function setGridNpcStrongholdEventActive(
  port: GridNpcStrongholdRuntimeCommandPort,
  command: GridSetNpcStrongholdEventCommand,
): Promise<GridNpcStrongholdEventCommandResult> {
  base(command);
  requireText(command.strongholdId, 'strongholdId');
  if (typeof command.active !== 'boolean') {
    throw new Error('Grid NPC runtime command active must be boolean');
  }
  return port.setStrongholdEvent(command);
}
