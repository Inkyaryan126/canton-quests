import { projectGridNpcStronghold } from '../core/npc-strongholds';
import type {
  GridNpcStrongholdContext,
  GridNpcStrongholdProjection,
} from '../core/npc-stronghold-types';
import type { GridNpcStrongholdWorldInput } from './npc-stronghold-world';
import type {
  GridNpcStrongholdRegistryPort,
  GridNpcStrongholdRegistrySnapshot,
} from './npc-stronghold-registry-port';

export interface GridNpcStrongholdRuntimeSignals {
  seasonActive: boolean;
  eventActiveStrongholdIds: readonly string[];
  surgeIntensityBps: number;
  factionPressureBpsByFaction: Readonly<Record<string, number>>;
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid NPC stronghold registry requires ${field}`);
  return normalized;
}

function requireBps(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`Grid NPC stronghold registry ${field} must be 0..10000 basis points`);
  }
  return value;
}

function validateSignals(signals: GridNpcStrongholdRuntimeSignals): void {
  requireBps(signals.surgeIntensityBps, 'surgeIntensityBps');
  if (!signals.seasonActive && signals.surgeIntensityBps > 0) {
    throw new Error('Grid NPC stronghold registry Surge intensity requires an active season');
  }
  for (const [factionId, pressure] of Object.entries(signals.factionPressureBpsByFaction)) {
    requireText(factionId, 'faction pressure id');
    requireBps(pressure, `faction pressure ${factionId}`);
  }
  for (const strongholdId of signals.eventActiveStrongholdIds) {
    requireText(strongholdId, 'event-active stronghold id');
  }
}

function contextsFor(
  snapshot: GridNpcStrongholdRegistrySnapshot,
  signals: GridNpcStrongholdRuntimeSignals,
): Array<{ config: GridNpcStrongholdRegistrySnapshot['configs'][number]; context: GridNpcStrongholdContext }> {
  validateSignals(signals);
  const captured = new Set(snapshot.capturedStrongholdIds);
  const eventActive = new Set(signals.eventActiveStrongholdIds);
  const seen = new Set<string>();

  return snapshot.configs.map((config) => {
    if (seen.has(config.strongholdId)) {
      throw new Error(`Duplicate NPC stronghold registry id: ${config.strongholdId}`);
    }
    seen.add(config.strongholdId);
    return {
      config,
      context: {
        seasonActive: signals.seasonActive,
        eventActive: eventActive.has(config.strongholdId),
        surgeIntensityBps: signals.surgeIntensityBps,
        factionPressureBps:
          signals.factionPressureBpsByFaction[config.factionId] ?? 0,
        captured: captured.has(config.strongholdId),
      },
    };
  });
}

export function projectGridNpcStrongholdRegistrySnapshot(
  snapshot: GridNpcStrongholdRegistrySnapshot,
  signals: GridNpcStrongholdRuntimeSignals,
): GridNpcStrongholdWorldInput[] {
  requireText(snapshot.citySlug, 'snapshot citySlug');
  requireText(snapshot.seasonSlug, 'snapshot seasonSlug');
  return contextsFor(snapshot, signals);
}

export async function listGridNpcStrongholdRuntimeInputs(
  port: GridNpcStrongholdRegistryPort,
  input: {
    citySlug: string;
    seasonSlug: string;
    signals: GridNpcStrongholdRuntimeSignals;
  },
): Promise<GridNpcStrongholdWorldInput[]> {
  const citySlug = requireText(input.citySlug, 'citySlug');
  const seasonSlug = requireText(input.seasonSlug, 'seasonSlug');
  const snapshot = await port.readSnapshot(citySlug, seasonSlug);
  if (snapshot.citySlug !== citySlug || snapshot.seasonSlug !== seasonSlug) {
    throw new Error('Grid NPC stronghold registry snapshot identity mismatch');
  }
  return projectGridNpcStrongholdRegistrySnapshot(snapshot, input.signals);
}

export async function resolveGridNpcStrongholdFromRegistry(
  port: GridNpcStrongholdRegistryPort,
  input: {
    citySlug: string;
    seasonSlug: string;
    strongholdId: string;
    signals: GridNpcStrongholdRuntimeSignals;
  },
): Promise<GridNpcStrongholdProjection | null> {
  const strongholdId = requireText(input.strongholdId, 'strongholdId');
  const runtimeInputs = await listGridNpcStrongholdRuntimeInputs(port, input);
  const match = runtimeInputs.find(({ config }) => config.strongholdId === strongholdId);
  return match ? projectGridNpcStronghold(match.config, match.context) : null;
}
