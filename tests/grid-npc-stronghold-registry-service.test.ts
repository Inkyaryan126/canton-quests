import { describe, expect, it, vi } from 'vitest';
import type { GridNpcStrongholdRegistryPort } from '../lib/grid/server/npc-stronghold-registry-port';
import {
  listGridNpcStrongholdRuntimeInputs,
  projectGridNpcStrongholdRegistrySnapshot,
  resolveGridNpcStrongholdFromRegistry,
} from '../lib/grid/server/npc-stronghold-registry-service';

function port(): GridNpcStrongholdRegistryPort {
  return {
    readSnapshot: vi.fn().mockResolvedValue({
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      configs: [
        {
          strongholdId: 'season-fort', factionId: 'ash-wardens', territorySlug: 'one',
          activation: 'season', baseGarrisonInfluence: 40, maxGarrisonInfluence: 80,
          pressureReinforcementBps: 5_000, surgeReinforcementBps: 5_000,
        },
        {
          strongholdId: 'event-fort', factionId: 'signal-keepers', territorySlug: 'two',
          landmarkSlug: 'tower', activation: 'event', baseGarrisonInfluence: 50,
          maxGarrisonInfluence: 100, pressureReinforcementBps: 2_000,
          surgeReinforcementBps: 8_000,
        },
      ],
      capturedStrongholdIds: ['season-fort'],
    }),
  };
}

const signals = {
  seasonActive: true,
  eventActiveStrongholdIds: ['event-fort'],
  surgeIntensityBps: 5_000,
  factionPressureBpsByFaction: {
    'ash-wardens': 4_000,
    'signal-keepers': 2_000,
  },
} as const;

describe('Grid NPC stronghold registry service', () => {
  it('combines definitions, runtime activation signals, pressure, and captured history', async () => {
    const inputs = await listGridNpcStrongholdRuntimeInputs(port(), {
      citySlug: 'canton-oh', seasonSlug: 'founding-season', signals,
    });
    expect(inputs).toHaveLength(2);
    expect(inputs[0].context).toEqual({
      seasonActive: true,
      eventActive: false,
      surgeIntensityBps: 5_000,
      factionPressureBps: 4_000,
      captured: true,
    });
    expect(inputs[1].context).toEqual({
      seasonActive: true,
      eventActive: true,
      surgeIntensityBps: 5_000,
      factionPressureBps: 2_000,
      captured: false,
    });
  });

  it('resolves one stronghold through the same Core projection used by combat', async () => {
    const projection = await resolveGridNpcStrongholdFromRegistry(port(), {
      citySlug: 'canton-oh', seasonSlug: 'founding-season', strongholdId: 'event-fort', signals,
    });
    expect(projection).toMatchObject({
      strongholdId: 'event-fort', status: 'active', contestable: true,
      objective: { kind: 'pve-landmark', factionId: 'signal-keepers', landmarkSlug: 'tower' },
    });
    expect(projection?.garrisonInfluence).toBeGreaterThan(50);
  });

  it('returns null for an unknown stronghold without inventing a definition', async () => {
    await expect(resolveGridNpcStrongholdFromRegistry(port(), {
      citySlug: 'canton-oh', seasonSlug: 'founding-season', strongholdId: 'missing', signals,
    })).resolves.toBeNull();
  });

  it('fails closed on snapshot identity mismatch and malformed runtime signals', async () => {
    const p = port();
    vi.mocked(p.readSnapshot).mockResolvedValueOnce({
      citySlug: 'other-city', seasonSlug: 'founding-season', configs: [], capturedStrongholdIds: [],
    });
    await expect(listGridNpcStrongholdRuntimeInputs(p, {
      citySlug: 'canton-oh', seasonSlug: 'founding-season', signals,
    })).rejects.toThrow('snapshot identity mismatch');

    expect(() => projectGridNpcStrongholdRegistrySnapshot({
      citySlug: 'canton-oh', seasonSlug: 'founding-season', configs: [], capturedStrongholdIds: [],
    }, { ...signals, surgeIntensityBps: 10_001 })).toThrow('0..10000');
  });

  it('rejects duplicate definition ids instead of silently choosing one', () => {
    const config = {
      strongholdId: 'duplicate', factionId: 'faction', territorySlug: 'one',
      activation: 'season' as const, baseGarrisonInfluence: 10, maxGarrisonInfluence: 20,
      pressureReinforcementBps: 0, surgeReinforcementBps: 0,
    };
    expect(() => projectGridNpcStrongholdRegistrySnapshot({
      citySlug: 'canton-oh', seasonSlug: 'founding-season',
      configs: [config, { ...config, territorySlug: 'two' }], capturedStrongholdIds: [],
    }, signals)).toThrow('Duplicate NPC stronghold registry id');
  });
});
