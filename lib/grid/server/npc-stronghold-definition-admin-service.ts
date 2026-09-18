import type { GridNpcStrongholdActivation } from '../core/npc-stronghold-types';
import type {
  GridNpcStrongholdDefinitionAdminPort,
  GridNpcStrongholdDefinitionAdminView,
  GridNpcStrongholdDefinitionMutationResult,
  GridSetNpcStrongholdDefinitionEnabledCommand,
  GridUpsertNpcStrongholdDefinitionCommand,
} from './npc-stronghold-definition-admin-port';

const ACTIVATIONS = new Set<GridNpcStrongholdActivation>([
  'season',
  'event',
  'surge',
]);

function text(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Grid NPC stronghold definition requires ${field}`);
  }
  return normalized;
}

function optionalText(value: string | null, field: string): string | null {
  if (value === null) return null;
  return text(value, field);
}

function timestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('Grid NPC stronghold definition requires a valid now timestamp');
  }
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Grid NPC stronghold definition ${field} must be a positive safe integer`);
  }
  return value;
}

function bps(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`Grid NPC stronghold definition ${field} must be 0..10000 basis points`);
  }
  return value;
}

export async function listGridNpcStrongholdDefinitionsForAdmin(
  port: GridNpcStrongholdDefinitionAdminPort,
): Promise<GridNpcStrongholdDefinitionAdminView[]> {
  const rows = await port.listDefinitions();
  return [...rows].sort((left, right) =>
    left.strongholdId.localeCompare(right.strongholdId),
  );
}

export async function upsertGridNpcStrongholdDefinition(
  port: GridNpcStrongholdDefinitionAdminPort,
  command: GridUpsertNpcStrongholdDefinitionCommand,
): Promise<GridNpcStrongholdDefinitionMutationResult> {
  const strongholdId = text(command.strongholdId, 'strongholdId');
  const factionId = text(command.factionId, 'factionId');
  const territorySlug = text(command.territorySlug, 'territorySlug');
  const landmarkSlug = optionalText(command.landmarkSlug, 'landmarkSlug');
  if (!ACTIVATIONS.has(command.activation)) {
    throw new Error('Grid NPC stronghold definition activation is not supported');
  }
  const baseGarrisonInfluence = positiveInteger(
    command.baseGarrisonInfluence,
    'baseGarrisonInfluence',
  );
  const maxGarrisonInfluence = positiveInteger(
    command.maxGarrisonInfluence,
    'maxGarrisonInfluence',
  );
  if (maxGarrisonInfluence < baseGarrisonInfluence) {
    throw new Error('Grid NPC stronghold definition maxGarrisonInfluence cannot be below baseGarrisonInfluence');
  }
  const pressureReinforcementBps = bps(
    command.pressureReinforcementBps,
    'pressureReinforcementBps',
  );
  const surgeReinforcementBps = bps(
    command.surgeReinforcementBps,
    'surgeReinforcementBps',
  );
  const idempotencyKey = text(command.idempotencyKey, 'a non-empty idempotency key');
  timestamp(command.now);

  return port.upsertDefinition({
    strongholdId,
    factionId,
    territorySlug,
    landmarkSlug,
    activation: command.activation,
    baseGarrisonInfluence,
    maxGarrisonInfluence,
    pressureReinforcementBps,
    surgeReinforcementBps,
    idempotencyKey,
    now: command.now,
  });
}

export async function setGridNpcStrongholdDefinitionEnabled(
  port: GridNpcStrongholdDefinitionAdminPort,
  command: GridSetNpcStrongholdDefinitionEnabledCommand,
): Promise<GridNpcStrongholdDefinitionMutationResult> {
  const strongholdId = text(command.strongholdId, 'strongholdId');
  if (typeof command.enabled !== 'boolean') {
    throw new Error('Grid NPC stronghold definition enabled must be boolean');
  }
  const idempotencyKey = text(command.idempotencyKey, 'a non-empty idempotency key');
  timestamp(command.now);
  return port.setDefinitionEnabled({
    strongholdId,
    enabled: command.enabled,
    idempotencyKey,
    now: command.now,
  });
}
