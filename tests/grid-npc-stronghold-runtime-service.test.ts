import { describe, expect, it, vi } from 'vitest';
import type { GridNpcStrongholdRegistryPort } from '../lib/grid/server/npc-stronghold-registry-port';
import type { GridNpcStrongholdRuntimeEvidencePort } from '../lib/grid/server/npc-stronghold-runtime-port';
import {
  readGridNpcStrongholdRuntimeReadiness,
  resolveGridNpcStrongholdRuntimeReadiness,
} from '../lib/grid/server/npc-stronghold-runtime-service';

const now = '2026-09-18T07:03:00.000Z';

function registry(): GridNpcStrongholdRegistryPort {
  return {
    readSnapshot: vi.fn().mockResolvedValue({
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      configs: [
        {
          strongholdId: 'season-fort', factionId: 'wardens', territorySlug: 'one',
          activation: 'season', baseGarrisonInfluence: 40, maxGarrisonInfluence: 80,
          pressureReinforcementBps: 5_000, surgeReinforcementBps: 0,
        },
        {
          strongholdId: 'event-fort', factionId: 'keepers', territorySlug: 'two',
          activation: 'event', baseGarrisonInfluence: 50, maxGarrisonInfluence: 100,
          pressureReinforcementBps: 0, surgeReinforcementBps: 5_000,
        },
      ],
      capturedStrongholdIds: [],
    }),
  };
}

function evidence(overrides: Partial<Awaited<ReturnType<GridNpcStrongholdRuntimeEvidencePort['readEvidence']>>> = {}): GridNpcStrongholdRuntimeEvidencePort {
  return {
    readEvidence: vi.fn().mockResolvedValue({
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      seasonActive: true,
      surgeIntensityBps: 4_000,
      eventActiveByStrongholdId: { 'event-fort': true },
      factionPressureBpsByFaction: { wardens: 6_000 },
      ...overrides,
    }),
  };
}

describe('Grid NPC stronghold runtime readiness', () => {
  it('projects all definitions only when every required runtime fact is authoritative', async () => {
    const result = await readGridNpcStrongholdRuntimeReadiness(
      registry(), evidence(), { citySlug: 'canton-oh', seasonSlug: 'founding-season', now },
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected ready strongholds');
    expect(result.runtimeInputs).toHaveLength(2);
    expect(result.signals).toEqual({
      seasonActive: true,
      eventActiveStrongholdIds: ['event-fort'],
      surgeIntensityBps: 4_000,
      factionPressureBpsByFaction: { wardens: 6_000 },
    });
  });

  it('reports the exact missing strategic facts instead of substituting zeroes', async () => {
    await expect(readGridNpcStrongholdRuntimeReadiness(
      registry(),
      evidence({
        surgeIntensityBps: null,
        eventActiveByStrongholdId: {},
        factionPressureBpsByFaction: {},
      }),
      { citySlug: 'canton-oh', seasonSlug: 'founding-season', now },
    )).resolves.toEqual({
      status: 'incomplete',
      missingFacts: [
        'eventActive:event-fort',
        'factionPressure:wardens',
        'surgeIntensityBps',
      ],
      runtimeInputs: null,
      signals: null,
    });
  });

  it('safely short-circuits strategic evidence when the season is authoritatively inactive', async () => {
    const result = await readGridNpcStrongholdRuntimeReadiness(
      registry(),
      evidence({
        seasonActive: false,
        surgeIntensityBps: null,
        eventActiveByStrongholdId: {},
        factionPressureBpsByFaction: {},
      }),
      { citySlug: 'canton-oh', seasonSlug: 'founding-season', now },
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected inactive ready state');
    expect(result.signals).toEqual({
      seasonActive: false,
      eventActiveStrongholdIds: [],
      surgeIntensityBps: 0,
      factionPressureBpsByFaction: {},
    });
  });

  it('validates known bad evidence even if another fact is missing or the season is inactive', async () => {
    await expect(readGridNpcStrongholdRuntimeReadiness(
      registry(), evidence({ seasonActive: false, surgeIntensityBps: 10_001 }),
      { citySlug: 'canton-oh', seasonSlug: 'founding-season', now },
    )).rejects.toThrow('0..10000');
  });

  it('scopes combat readiness to one stronghold so unrelated missing signals do not block it', async () => {
    const p = evidence({
      surgeIntensityBps: null,
      eventActiveByStrongholdId: {},
      factionPressureBpsByFaction: { wardens: 6_000 },
    });
    const result = await resolveGridNpcStrongholdRuntimeReadiness(
      registry(), p,
      { citySlug: 'canton-oh', seasonSlug: 'founding-season', now, strongholdId: 'season-fort' },
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected scoped ready stronghold');
    expect(result.projection).toMatchObject({ strongholdId: 'season-fort', status: 'active' });
    expect(p.readEvidence).toHaveBeenCalledWith({
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      now,
      strongholdIds: ['season-fort'],
      factionIds: ['wardens'],
    });
  });

  it('returns incomplete for only the requested stronghold facts when needed', async () => {
    await expect(resolveGridNpcStrongholdRuntimeReadiness(
      registry(), evidence({ factionPressureBpsByFaction: {} }),
      { citySlug: 'canton-oh', seasonSlug: 'founding-season', now, strongholdId: 'season-fort' },
    )).resolves.toEqual({
      status: 'incomplete',
      missingFacts: ['factionPressure:wardens'],
      projection: null,
    });
  });

  it('does not query runtime evidence for an empty or unknown registry scope', async () => {
    const p = evidence();
    const result = await resolveGridNpcStrongholdRuntimeReadiness(
      registry(), p,
      { citySlug: 'canton-oh', seasonSlug: 'founding-season', now, strongholdId: 'missing' },
    );
    expect(result).toEqual({ status: 'ready', missingFacts: [], projection: null });
    expect(p.readEvidence).not.toHaveBeenCalled();
  });
});
