import { describe, expect, it, vi } from 'vitest';
import type { GridNpcStrongholdRegistryPort } from '../lib/grid/server/npc-stronghold-registry-port';
import type { GridNpcStrongholdRuntimeEvidencePort } from '../lib/grid/server/npc-stronghold-runtime-port';
import {
  createGridNpcStrongholdTrustedResolver,
  listGridNpcStrongholdLiveWorld,
} from '../lib/grid/server/npc-stronghold-live-service';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';

const now = '2026-09-18T07:25:00.000Z';

function registry(): GridNpcStrongholdRegistryPort {
  const territory = cantonFoundingSeasonPackage.territories[0];
  if (!territory) throw new Error('test package requires territory');
  return {
    readSnapshot: vi.fn().mockResolvedValue({
      citySlug: cantonFoundingSeasonPackage.city.slug,
      seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
      configs: [{
        strongholdId: 'fort-1',
        factionId: 'wardens',
        territorySlug: territory.slug,
        activation: 'season',
        baseGarrisonInfluence: 40,
        maxGarrisonInfluence: 80,
        pressureReinforcementBps: 0,
        surgeReinforcementBps: 0,
      }],
      capturedStrongholdIds: [],
    }),
  };
}

function evidence(seasonActive: boolean | null = true): GridNpcStrongholdRuntimeEvidencePort {
  return {
    readEvidence: vi.fn().mockResolvedValue({
      citySlug: cantonFoundingSeasonPackage.city.slug,
      seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
      seasonActive,
      surgeIntensityBps: null,
      eventActiveByStrongholdId: {},
      factionPressureBpsByFaction: {},
    }),
  };
}

describe('Grid NPC stronghold live service', () => {
  it('builds package-safe world strongholds when runtime evidence is ready', async () => {
    const result = await listGridNpcStrongholdLiveWorld(
      registry(), evidence(), cantonFoundingSeasonPackage, now,
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected ready');
    expect(result.strongholds).toHaveLength(1);
    expect(result.strongholds[0]).toMatchObject({
      strongholdId: 'fort-1',
      factionId: 'wardens',
      status: 'active',
      contestable: true,
    });
  });

  it('keeps exact incomplete facts inside the service boundary', async () => {
    const result = await listGridNpcStrongholdLiveWorld(
      registry(), evidence(null), cantonFoundingSeasonPackage, now,
    );
    expect(result).toEqual({
      status: 'incomplete',
      missingFacts: ['seasonActive'],
      strongholds: null,
    });
  });

  it('trusted combat resolver returns the Core projection and throws on incomplete evidence', async () => {
    const ready = createGridNpcStrongholdTrustedResolver(
      registry(), evidence(), {
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
      },
    );
    await expect(ready({ strongholdId: 'fort-1', now })).resolves.toMatchObject({
      strongholdId: 'fort-1', status: 'active', contestable: true,
    });

    const blocked = createGridNpcStrongholdTrustedResolver(
      registry(), evidence(null), {
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
      },
    );
    await expect(blocked({ strongholdId: 'fort-1', now })).rejects.toThrow(
      'Grid stronghold runtime evidence incomplete: seasonActive',
    );
  });
});
