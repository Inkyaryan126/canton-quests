import { describe, expect, it, vi } from 'vitest';
import type { GridNpcStrongholdRegistryPort } from '../lib/grid/server/npc-stronghold-registry-port';
import type { GridNpcStrongholdRuntimeEvidencePort } from '../lib/grid/server/npc-stronghold-runtime-port';
import type { GridNpcStrongholdRuntimeCommandPort } from '../lib/grid/server/npc-stronghold-runtime-command-port';
import type { GridNpcStrongholdRuntimeAdminScopePort } from '../lib/grid/server/npc-stronghold-runtime-admin-service';
import {
  getGridNpcStrongholdRuntimeAdminStatus,
  setGridNpcStrongholdRuntimeAdminEvent,
  setGridNpcStrongholdRuntimeAdminFactionPressure,
  setGridNpcStrongholdRuntimeAdminSurge,
} from '../lib/grid/server/npc-stronghold-runtime-admin-service';

const now = '2026-09-18T08:00:00.000Z';
const scope: GridNpcStrongholdRuntimeAdminScopePort = {
  resolveScope: vi.fn().mockResolvedValue({ cityId: 'city-1', seasonId: 'season-1' }),
};
function commands(): GridNpcStrongholdRuntimeCommandPort {
  return {
    setSurgeIntensity: vi.fn().mockResolvedValue({
      surgeIntensityBps: 5000, eventId: 'e1', duplicate: false, updatedAt: now,
    }),
    setFactionPressure: vi.fn().mockResolvedValue({
      factionId: 'wardens', pressureBps: 6000, eventId: 'e2', duplicate: false, updatedAt: now,
    }),
    setStrongholdEvent: vi.fn().mockResolvedValue({
      strongholdId: 'fort-1', active: true, eventId: 'e3', duplicate: false, updatedAt: now,
    }),
  };
}
function registry(): GridNpcStrongholdRegistryPort {
  return {
    readSnapshot: vi.fn().mockResolvedValue({
      citySlug: 'canton-oh', seasonSlug: 'founding-season', capturedStrongholdIds: [],
      configs: [{
        strongholdId: 'fort-1', factionId: 'wardens', territorySlug: 'one',
        activation: 'season', baseGarrisonInfluence: 40, maxGarrisonInfluence: 80,
        pressureReinforcementBps: 1000, surgeReinforcementBps: 1000,
      }],
    }),
  };
}
function evidence(pressure: number | null = 6000): GridNpcStrongholdRuntimeEvidencePort {
  return {
    readEvidence: vi.fn().mockResolvedValue({
      citySlug: 'canton-oh', seasonSlug: 'founding-season', seasonActive: true,
      surgeIntensityBps: 5000, eventActiveByStrongholdId: {},
      factionPressureBpsByFaction: { wardens: pressure },
    }),
  };
}

describe('Grid NPC runtime admin service', () => {
  it('returns operator-ready signal and stronghold context when evidence is complete', async () => {
    const result = await getGridNpcStrongholdRuntimeAdminStatus(
      registry(), evidence(), { citySlug: 'canton-oh', seasonSlug: 'founding-season', now },
    );
    expect(result).toEqual({
      status: 'ready', missingFacts: [],
      signals: {
        seasonActive: true,
        eventActiveStrongholdIds: [],
        surgeIntensityBps: 5000,
        factionPressureBpsByFaction: { wardens: 6000 },
      },
      strongholds: [{
        strongholdId: 'fort-1', factionId: 'wardens', activation: 'season',
        territorySlug: 'one', landmarkSlug: null, captured: false,
        eventActive: false, surgeIntensityBps: 5000, factionPressureBps: 6000,
      }],
    });
  });

  it('reports exact missing facts to the operator when runtime is incomplete', async () => {
    await expect(getGridNpcStrongholdRuntimeAdminStatus(
      registry(), evidence(null), { citySlug: 'canton-oh', seasonSlug: 'founding-season', now },
    )).resolves.toEqual({
      status: 'incomplete', missingFacts: ['factionPressure:wardens'],
      signals: null, strongholds: null,
    });
  });

  it('resolves server scope before forwarding Surge updates with a null player actor', async () => {
    const p = commands();
    await setGridNpcStrongholdRuntimeAdminSurge(scope, p, {
      surgeIntensityBps: 5000, idempotencyKey: 'surge-1', now,
    });
    expect(p.setSurgeIntensity).toHaveBeenCalledWith({
      cityId: 'city-1', seasonId: 'season-1', actorPlayerId: null,
      surgeIntensityBps: 5000, idempotencyKey: 'surge-1', now,
    });
  });

  it('forwards explicit faction and stronghold event identity only after server scope resolution', async () => {
    const p = commands();
    await setGridNpcStrongholdRuntimeAdminFactionPressure(scope, p, {
      factionId: 'wardens', pressureBps: 6000, idempotencyKey: 'pressure-1', now,
    });
    await setGridNpcStrongholdRuntimeAdminEvent(scope, p, {
      strongholdId: 'fort-1', active: true, idempotencyKey: 'event-1', now,
    });
    expect(p.setFactionPressure).toHaveBeenCalledWith(expect.objectContaining({
      cityId: 'city-1', seasonId: 'season-1', actorPlayerId: null,
      factionId: 'wardens', pressureBps: 6000,
    }));
    expect(p.setStrongholdEvent).toHaveBeenCalledWith(expect.objectContaining({
      cityId: 'city-1', seasonId: 'season-1', actorPlayerId: null,
      strongholdId: 'fort-1', active: true,
    }));
  });

  it('rejects malformed scope or admin identity inputs before command writes', async () => {
    const p = commands();
    await expect(setGridNpcStrongholdRuntimeAdminFactionPressure(scope, p, {
      factionId: ' ', pressureBps: 6000, idempotencyKey: 'pressure-1', now,
    })).rejects.toThrow('factionId');
    expect(p.setFactionPressure).not.toHaveBeenCalled();
  });
});
