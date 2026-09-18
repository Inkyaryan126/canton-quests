import type { GridNpcStrongholdRegistryPort } from './npc-stronghold-registry-port';
import type { GridNpcStrongholdRuntimeEvidencePort } from './npc-stronghold-runtime-port';
import { readGridNpcStrongholdRuntimeReadiness } from './npc-stronghold-runtime-service';
import type { GridNpcStrongholdRuntimeCommandPort } from './npc-stronghold-runtime-command-port';
import {
  setGridNpcFactionPressure,
  setGridNpcStrongholdEventActive,
  setGridNpcSurgeIntensity,
} from './npc-stronghold-runtime-command-service';

export interface GridNpcStrongholdRuntimeAdminScope {
  cityId: string;
  seasonId: string;
}

export interface GridNpcStrongholdRuntimeAdminScopePort {
  resolveScope(): Promise<GridNpcStrongholdRuntimeAdminScope>;
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Grid NPC runtime admin requires ${field}`);
  }
  return normalized;
}

function requireTimestamp(value: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('Grid NPC runtime admin requires a valid now timestamp');
  }
  return value;
}

async function scope(
  port: GridNpcStrongholdRuntimeAdminScopePort,
): Promise<GridNpcStrongholdRuntimeAdminScope> {
  const resolved = await port.resolveScope();
  return {
    cityId: requireText(resolved.cityId, 'resolved cityId'),
    seasonId: requireText(resolved.seasonId, 'resolved seasonId'),
  };
}

export async function getGridNpcStrongholdRuntimeAdminStatus(
  registryPort: GridNpcStrongholdRegistryPort,
  evidencePort: GridNpcStrongholdRuntimeEvidencePort,
  input: { citySlug: string; seasonSlug: string; now: string },
) {
  const citySlug = requireText(input.citySlug, 'citySlug');
  const seasonSlug = requireText(input.seasonSlug, 'seasonSlug');
  const now = requireTimestamp(input.now);
  const readiness = await readGridNpcStrongholdRuntimeReadiness(
    registryPort,
    evidencePort,
    { citySlug, seasonSlug, now },
  );

  if (readiness.status === 'incomplete') {
    return {
      status: 'incomplete' as const,
      missingFacts: readiness.missingFacts,
      signals: null,
      strongholds: null,
    };
  }

  return {
    status: 'ready' as const,
    missingFacts: [] as string[],
    signals: readiness.signals,
    strongholds: readiness.runtimeInputs.map(({ config, context }) => ({
      strongholdId: config.strongholdId,
      factionId: config.factionId,
      activation: config.activation,
      territorySlug: config.territorySlug,
      landmarkSlug: config.landmarkSlug ?? null,
      captured: context.captured,
      eventActive: context.eventActive,
      surgeIntensityBps: context.surgeIntensityBps,
      factionPressureBps: context.factionPressureBps,
    })),
  };
}

export async function setGridNpcStrongholdRuntimeAdminSurge(
  scopePort: GridNpcStrongholdRuntimeAdminScopePort,
  commandPort: GridNpcStrongholdRuntimeCommandPort,
  input: {
    surgeIntensityBps: number | null;
    idempotencyKey: string;
    now: string;
  },
) {
  const resolved = await scope(scopePort);
  return setGridNpcSurgeIntensity(commandPort, {
    ...resolved,
    actorPlayerId: null,
    surgeIntensityBps: input.surgeIntensityBps,
    idempotencyKey: requireText(input.idempotencyKey, 'idempotencyKey'),
    now: requireTimestamp(input.now),
  });
}

export async function setGridNpcStrongholdRuntimeAdminFactionPressure(
  scopePort: GridNpcStrongholdRuntimeAdminScopePort,
  commandPort: GridNpcStrongholdRuntimeCommandPort,
  input: {
    factionId: string;
    pressureBps: number;
    idempotencyKey: string;
    now: string;
  },
) {
  const resolved = await scope(scopePort);
  return setGridNpcFactionPressure(commandPort, {
    ...resolved,
    actorPlayerId: null,
    factionId: requireText(input.factionId, 'factionId'),
    pressureBps: input.pressureBps,
    idempotencyKey: requireText(input.idempotencyKey, 'idempotencyKey'),
    now: requireTimestamp(input.now),
  });
}

export async function setGridNpcStrongholdRuntimeAdminEvent(
  scopePort: GridNpcStrongholdRuntimeAdminScopePort,
  commandPort: GridNpcStrongholdRuntimeCommandPort,
  input: {
    strongholdId: string;
    active: boolean;
    idempotencyKey: string;
    now: string;
  },
) {
  const resolved = await scope(scopePort);
  return setGridNpcStrongholdEventActive(commandPort, {
    ...resolved,
    actorPlayerId: null,
    strongholdId: requireText(input.strongholdId, 'strongholdId'),
    active: input.active,
    idempotencyKey: requireText(input.idempotencyKey, 'idempotencyKey'),
    now: requireTimestamp(input.now),
  });
}
