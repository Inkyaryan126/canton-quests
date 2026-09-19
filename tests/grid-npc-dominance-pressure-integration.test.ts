import { describe, expect, it, vi } from 'vitest';
import { cantonDominanceHeatConfig } from '../lib/grid/cities/canton/dominance-heat';
import { deriveGridNpcDominancePressure } from '../lib/grid/server/npc-dominance-pressure';
import type { GridNpcStrongholdRegistryPort } from '../lib/grid/server/npc-stronghold-registry-port';
import type { GridNpcStrongholdRuntimeEvidencePort } from '../lib/grid/server/npc-stronghold-runtime-port';
import { resolveGridNpcStrongholdRuntimeReadiness } from '../lib/grid/server/npc-stronghold-runtime-service';

const now = '2026-09-19T05:00:00.000Z';

function registry(): GridNpcStrongholdRegistryPort {
  return {
    readSnapshot: vi.fn().mockResolvedValue({
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      configs: [
        {
          strongholdId: 'wardens-fort',
          factionId: 'wardens',
          territorySlug: 'one',
          activation: 'season',
          baseGarrisonInfluence: 40,
          maxGarrisonInfluence: 80,
          pressureReinforcementBps: 10_000,
          surgeReinforcementBps: 0,
        },
      ],
      capturedStrongholdIds: [],
    }),
  };
}

async function garrisonFor(controlledTerritories: number): Promise<number> {
  const pressure = deriveGridNpcDominancePressure(
    {
      eligibleTerritories: 20,
      ownerPlayerIds: Array.from(
        { length: controlledTerritories },
        () => 'dominant-player',
      ),
      allianceMemberships: [],
    },
    cantonDominanceHeatConfig,
  ).pressureBps;

  const evidence: GridNpcStrongholdRuntimeEvidencePort = {
    readEvidence: vi.fn().mockResolvedValue({
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      seasonActive: true,
      surgeIntensityBps: 0,
      eventActiveByStrongholdId: {},
      factionPressureBpsByFaction: { wardens: pressure },
    }),
  };

  const result = await resolveGridNpcStrongholdRuntimeReadiness(
    registry(),
    evidence,
    {
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      strongholdId: 'wardens-fort',
      now,
    },
  );

  if (result.status !== 'ready' || !result.projection) {
    throw new Error('expected a ready NPC stronghold');
  }
  return result.projection.garrisonInfluence;
}

describe('Dominance Heat mechanically reinforces NPC strongholds', () => {
  it('increases committed garrison as city concentration moves through Heat bands', async () => {
    expect(await garrisonFor(0)).toBe(40);
    expect(await garrisonFor(7)).toBe(42);
    expect(await garrisonFor(10)).toBe(44);
    expect(await garrisonFor(15)).toBe(50);
  });
});
