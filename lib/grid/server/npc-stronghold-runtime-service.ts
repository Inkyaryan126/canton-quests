import { projectGridNpcStronghold } from '../core/npc-strongholds';
import type {
  GridNpcStrongholdConfig,
  GridNpcStrongholdProjection,
} from '../core/npc-stronghold-types';
import {
  projectGridNpcStrongholdRegistrySnapshot,
  type GridNpcStrongholdRuntimeSignals,
} from './npc-stronghold-registry-service';
import type {
  GridNpcStrongholdRegistryPort,
  GridNpcStrongholdRegistrySnapshot,
} from './npc-stronghold-registry-port';
import type {
  GridNpcStrongholdRuntimeEvidence,
  GridNpcStrongholdRuntimeEvidencePort,
} from './npc-stronghold-runtime-port';
import type { GridNpcStrongholdWorldInput } from './npc-stronghold-world';

export type GridNpcStrongholdRuntimeReadiness =
  | {
      status: 'ready';
      missingFacts: [];
      runtimeInputs: GridNpcStrongholdWorldInput[];
      signals: GridNpcStrongholdRuntimeSignals;
    }
  | {
      status: 'incomplete';
      missingFacts: string[];
      runtimeInputs: null;
      signals: null;
    };

export type GridNpcStrongholdResolveReadiness =
  | {
      status: 'ready';
      missingFacts: [];
      projection: GridNpcStrongholdProjection | null;
    }
  | {
      status: 'incomplete';
      missingFacts: string[];
      projection: null;
    };

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid NPC stronghold runtime requires ${field}`);
  return normalized;
}

function validateBps(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`Grid NPC stronghold runtime ${field} must be 0..10000 basis points`);
  }
}

function validateKnownEvidence(evidence: GridNpcStrongholdRuntimeEvidence): void {
  if (evidence.surgeIntensityBps !== null) {
    validateBps(evidence.surgeIntensityBps, 'surgeIntensityBps');
  }
  for (const [strongholdId, active] of Object.entries(evidence.eventActiveByStrongholdId)) {
    requireText(strongholdId, 'event stronghold id');
    if (active !== null && active !== undefined && typeof active !== 'boolean') {
      throw new Error(`Grid NPC stronghold runtime event signal ${strongholdId} must be boolean`);
    }
  }
  for (const [factionId, pressure] of Object.entries(evidence.factionPressureBpsByFaction)) {
    requireText(factionId, 'faction pressure id');
    if (pressure !== null && pressure !== undefined) {
      validateBps(pressure, `faction pressure ${factionId}`);
    }
  }
}

function scopedSnapshot(
  snapshot: GridNpcStrongholdRegistrySnapshot,
  strongholdId?: string,
): GridNpcStrongholdRegistrySnapshot {
  if (!strongholdId) return snapshot;
  return {
    ...snapshot,
    configs: snapshot.configs.filter((config) => config.strongholdId === strongholdId),
  };
}

function evidenceRequestIds(configs: GridNpcStrongholdConfig[]): {
  strongholdIds: string[];
  factionIds: string[];
} {
  return {
    strongholdIds: [...new Set(configs.map((config) => config.strongholdId))].sort(),
    factionIds: [...new Set(configs.map((config) => config.factionId))].sort(),
  };
}

function requiredFacts(
  configs: GridNpcStrongholdConfig[],
  evidence: GridNpcStrongholdRuntimeEvidence,
): string[] {
  if (evidence.seasonActive === null) return ['seasonActive'];
  if (!evidence.seasonActive) return [];

  const missing: string[] = [];
  const surgeRequired = configs.some(
    (config) => config.activation === 'surge' || config.surgeReinforcementBps > 0,
  );
  if (surgeRequired && evidence.surgeIntensityBps === null) {
    missing.push('surgeIntensityBps');
  }

  for (const config of configs) {
    if (
      config.activation === 'event' &&
      (evidence.eventActiveByStrongholdId[config.strongholdId] === null ||
        evidence.eventActiveByStrongholdId[config.strongholdId] === undefined)
    ) {
      missing.push(`eventActive:${config.strongholdId}`);
    }
  }

  const pressureFactions = [...new Set(
    configs
      .filter((config) => config.pressureReinforcementBps > 0)
      .map((config) => config.factionId),
  )].sort();
  for (const factionId of pressureFactions) {
    const value = evidence.factionPressureBpsByFaction[factionId];
    if (value === null || value === undefined) {
      missing.push(`factionPressure:${factionId}`);
    }
  }

  return [...new Set(missing)].sort();
}

function signalsFrom(
  configs: GridNpcStrongholdConfig[],
  evidence: GridNpcStrongholdRuntimeEvidence,
): GridNpcStrongholdRuntimeSignals {
  if (evidence.seasonActive === false) {
    return {
      seasonActive: false,
      eventActiveStrongholdIds: [],
      surgeIntensityBps: 0,
      factionPressureBpsByFaction: {},
    };
  }

  const eventActiveStrongholdIds = configs
    .filter(
      (config) =>
        config.activation === 'event' &&
        evidence.eventActiveByStrongholdId[config.strongholdId] === true,
    )
    .map((config) => config.strongholdId)
    .sort();
  const factionPressureBpsByFaction: Record<string, number> = {};
  for (const config of configs) {
    if (config.pressureReinforcementBps <= 0) continue;
    const value = evidence.factionPressureBpsByFaction[config.factionId];
    if (typeof value === 'number') factionPressureBpsByFaction[config.factionId] = value;
  }

  return {
    seasonActive: true,
    eventActiveStrongholdIds,
    surgeIntensityBps: evidence.surgeIntensityBps ?? 0,
    factionPressureBpsByFaction,
  };
}

async function readinessForScope(
  registryPort: GridNpcStrongholdRegistryPort,
  evidencePort: GridNpcStrongholdRuntimeEvidencePort,
  input: { citySlug: string; seasonSlug: string; now: string; strongholdId?: string },
): Promise<GridNpcStrongholdRuntimeReadiness> {
  const citySlug = requireText(input.citySlug, 'citySlug');
  const seasonSlug = requireText(input.seasonSlug, 'seasonSlug');
  if (!Number.isFinite(Date.parse(input.now))) {
    throw new Error('Grid NPC stronghold runtime requires valid now');
  }
  const strongholdId = input.strongholdId
    ? requireText(input.strongholdId, 'strongholdId')
    : undefined;
  const original = await registryPort.readSnapshot(citySlug, seasonSlug);
  if (original.citySlug !== citySlug || original.seasonSlug !== seasonSlug) {
    throw new Error('Grid NPC stronghold runtime registry identity mismatch');
  }
  const snapshot = scopedSnapshot(original, strongholdId);
  if (snapshot.configs.length === 0) {
    const signals: GridNpcStrongholdRuntimeSignals = {
      seasonActive: false,
      eventActiveStrongholdIds: [],
      surgeIntensityBps: 0,
      factionPressureBpsByFaction: {},
    };
    return {
      status: 'ready',
      missingFacts: [],
      runtimeInputs: [],
      signals,
    };
  }

  const ids = evidenceRequestIds(snapshot.configs);
  const evidence = await evidencePort.readEvidence({
    citySlug,
    seasonSlug,
    now: input.now,
    ...ids,
  });
  if (evidence.citySlug !== citySlug || evidence.seasonSlug !== seasonSlug) {
    throw new Error('Grid NPC stronghold runtime evidence identity mismatch');
  }
  validateKnownEvidence(evidence);

  const missingFacts = requiredFacts(snapshot.configs, evidence);
  if (missingFacts.length > 0) {
    return {
      status: 'incomplete',
      missingFacts,
      runtimeInputs: null,
      signals: null,
    };
  }

  const signals = signalsFrom(snapshot.configs, evidence);
  return {
    status: 'ready',
    missingFacts: [],
    runtimeInputs: projectGridNpcStrongholdRegistrySnapshot(snapshot, signals),
    signals,
  };
}

export async function readGridNpcStrongholdRuntimeReadiness(
  registryPort: GridNpcStrongholdRegistryPort,
  evidencePort: GridNpcStrongholdRuntimeEvidencePort,
  input: { citySlug: string; seasonSlug: string; now: string },
): Promise<GridNpcStrongholdRuntimeReadiness> {
  return readinessForScope(registryPort, evidencePort, input);
}

export async function resolveGridNpcStrongholdRuntimeReadiness(
  registryPort: GridNpcStrongholdRegistryPort,
  evidencePort: GridNpcStrongholdRuntimeEvidencePort,
  input: { citySlug: string; seasonSlug: string; now: string; strongholdId: string },
): Promise<GridNpcStrongholdResolveReadiness> {
  const readiness = await readinessForScope(registryPort, evidencePort, input);
  if (readiness.status === 'incomplete') {
    return {
      status: 'incomplete',
      missingFacts: readiness.missingFacts,
      projection: null,
    };
  }
  const match = readiness.runtimeInputs[0];
  return {
    status: 'ready',
    missingFacts: [],
    projection: match ? projectGridNpcStronghold(match.config, match.context) : null,
  };
}
