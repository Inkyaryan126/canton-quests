import { describe, expect, it, vi } from 'vitest';
import type { GridNpcStrongholdDefinitionAdminPort } from '../lib/grid/server/npc-stronghold-definition-admin-port';
import {
  listGridNpcStrongholdDefinitionsForAdmin,
  setGridNpcStrongholdDefinitionEnabled,
  upsertGridNpcStrongholdDefinition,
} from '../lib/grid/server/npc-stronghold-definition-admin-service';

const now = '2026-09-18T07:50:00.000Z';
function port(): GridNpcStrongholdDefinitionAdminPort {
  return {
    listDefinitions: vi.fn().mockResolvedValue([
      {
        strongholdId: 'z-fort', factionId: 'wardens', territorySlug: 'z', landmarkSlug: null,
        activation: 'season', baseGarrisonInfluence: 40, maxGarrisonInfluence: 80,
        pressureReinforcementBps: 2_000, surgeReinforcementBps: 4_000,
        enabled: false, hasContestHistory: false, activeContest: false, updatedAt: now,
      },
      {
        strongholdId: 'a-fort', factionId: 'keepers', territorySlug: 'a', landmarkSlug: 'tower',
        activation: 'event', baseGarrisonInfluence: 50, maxGarrisonInfluence: 100,
        pressureReinforcementBps: 0, surgeReinforcementBps: 5_000,
        enabled: true, hasContestHistory: true, activeContest: false, updatedAt: now,
      },
    ]),
    upsertDefinition: vi.fn().mockResolvedValue({ strongholdId: 'fort-1', duplicate: false, updatedAt: now }),
    setDefinitionEnabled: vi.fn().mockResolvedValue({ strongholdId: 'fort-1', duplicate: false, updatedAt: now }),
  };
}

const valid = {
  strongholdId: 'fort-1', factionId: 'wardens', territorySlug: 'one', landmarkSlug: null,
  activation: 'season' as const, baseGarrisonInfluence: 40, maxGarrisonInfluence: 80,
  pressureReinforcementBps: 2_000, surgeReinforcementBps: 4_000,
  idempotencyKey: 'definition-1', now,
};

describe('Grid NPC stronghold definition admin service', () => {
  it('sorts operator definitions deterministically', async () => {
    const result = await listGridNpcStrongholdDefinitionsForAdmin(port());
    expect(result.map((row) => row.strongholdId)).toEqual(['a-fort', 'z-fort']);
  });
  it('validates and forwards an explicit definition without inventing values', async () => {
    const p = port();
    await upsertGridNpcStrongholdDefinition(p, valid);
    expect(p.upsertDefinition).toHaveBeenCalledWith(valid);
  });
  it('rejects unsupported activation and invalid garrison ordering', async () => {
    const p = port();
    await expect(upsertGridNpcStrongholdDefinition(p, {
      ...valid, activation: 'mystery' as 'season',
    })).rejects.toThrow('activation is not supported');
    await expect(upsertGridNpcStrongholdDefinition(p, {
      ...valid, maxGarrisonInfluence: 20,
    })).rejects.toThrow('cannot be below baseGarrisonInfluence');
    expect(p.upsertDefinition).not.toHaveBeenCalled();
  });
  it('rejects out-of-range reinforcement values', async () => {
    await expect(upsertGridNpcStrongholdDefinition(port(), {
      ...valid, pressureReinforcementBps: 10_001,
    })).rejects.toThrow('0..10000');
  });
  it('validates explicit enabled state and idempotency before persistence', async () => {
    const p = port();
    await setGridNpcStrongholdDefinitionEnabled(p, {
      strongholdId: 'fort-1', enabled: true, idempotencyKey: 'enable-1', now,
    });
    expect(p.setDefinitionEnabled).toHaveBeenCalled();
    await expect(setGridNpcStrongholdDefinitionEnabled(p, {
      strongholdId: 'fort-1', enabled: null as unknown as boolean, idempotencyKey: 'enable-2', now,
    })).rejects.toThrow('enabled must be boolean');
  });
});
