import { describe, expect, it } from 'vitest';
import { runGridAntiSnowballSimulation } from '../lib/grid/sim/anti-snowball';
import type { GridAntiSnowballSimulationInput } from '../lib/grid/sim/anti-snowball-types';

const input: GridAntiSnowballSimulationInput = {
  actorId: 'leader-1',
  eligibleTerritories: 10,
  dominanceHeat: {
    bands: [
      {
        id: 'warm', minDominanceBps: 3_500,
        effects: {
          neutralFactionPressureBps: 500,
          borderRewardBonusBps: 250,
          upkeepSurchargeBps: 200,
          rivalObjectiveBonusBps: 400,
          antiMonopolyContractSlots: 1,
        },
      },
      {
        id: 'hot', minDominanceBps: 5_000,
        effects: {
          neutralFactionPressureBps: 1_200,
          borderRewardBonusBps: 700,
          upkeepSurchargeBps: 800,
          rivalObjectiveBonusBps: 1_000,
          antiMonopolyContractSlots: 2,
        },
      },
      {
        id: 'critical', minDominanceBps: 7_500,
        effects: {
          neutralFactionPressureBps: 2_500,
          borderRewardBonusBps: 1_500,
          upkeepSurchargeBps: 1_800,
          rivalObjectiveBonusBps: 2_000,
          antiMonopolyContractSlots: 4,
        },
      },
    ],
  },
  cityPower: {
    maxSingleComponentWeightBps: 3_000,
    components: [
      { id: 'territory-control', weightBps: 2_500, rawCap: 100, curve: [{ rawValue: 50, attainmentBps: 6_000 }, { rawValue: 100, attainmentBps: 10_000 }] },
      { id: 'economic-strength', weightBps: 2_500, rawCap: 100, curve: [{ rawValue: 50, attainmentBps: 6_000 }, { rawValue: 100, attainmentBps: 10_000 }] },
      { id: 'contest-performance', weightBps: 2_500, rawCap: 100, curve: [{ rawValue: 50, attainmentBps: 6_000 }, { rawValue: 100, attainmentBps: 10_000 }] },
      { id: 'prestige', weightBps: 2_500, rawCap: 100, curve: [{ rawValue: 50, attainmentBps: 6_000 }, { rawValue: 100, attainmentBps: 10_000 }] },
    ],
  },
  surge: {
    durationMinutes: 72 * 60,
    districtControlValueMultiplierBps: 15_000,
    landmarkValueMultiplierBps: 17_500,
    hotspotValueMultiplierBps: 20_000,
    dominanceExposureMultiplierBps: 12_500,
    hotspotCount: 3,
    maxHotspotsPerDistrict: 1,
    specialObjectiveSlots: 4,
    npcStrongholdSlots: 2,
    emphasizeFinalRankings: true,
    hotspotWeights: {
      strategicValueBps: 4_000,
      contestPressureBps: 3_500,
      underdogOpportunityBps: 2_500,
    },
  },
};

describe('Grid anti-snowball simulation', () => {
  it('shows escalating Dominance Heat as a leader concentrates territory', () => {
    const report = runGridAntiSnowballSimulation(input);
    expect(report.dominance.effectsMonotonic).toBe(true);
    expect(report.dominance.counterPressureEscalates).toBe(true);
    expect(report.dominance.firstActiveTerritoryCount).toBe(4);
    expect(report.dominance.highestBandId).toBe('critical');
    expect(report.dominance.samples.at(-1)?.effects).toMatchObject({
      neutralFactionPressureBps: 2_500,
      upkeepSurchargeBps: 1_800,
      rivalObjectiveBonusBps: 2_000,
      antiMonopolyContractSlots: 4,
    });
  });

  it('proves one maxed City Power axis cannot become total city power', () => {
    const report = runGridAntiSnowballSimulation(input);
    expect(report.cityPower).toMatchObject({
      maxSingleAxisPowerBps: 2_500,
      configuredSingleComponentCeilingBps: 3_000,
      singleAxisLimitedBelowTotalPower: true,
    });
  });

  it('proves Surge underdog weighting wins an otherwise equal hotspot comparison', () => {
    const report = runGridAntiSnowballSimulation(input);
    expect(report.surge).toMatchObject({
      underdogOpportunityWeightBps: 2_500,
      underdogSignalActive: true,
      underdogPreferredWhenOtherwiseEqual: true,
      dominanceExposureMultiplierBps: 12_500,
      surgeDoesNotReduceDominanceExposure: true,
    });
    expect(report.guardrailsEngage).toBe(true);
  });

  it('detects a Dominance Heat misconfiguration that decreases counter-pressure at higher control', () => {
    const broken: GridAntiSnowballSimulationInput = {
      ...input,
      dominanceHeat: {
        bands: [
          input.dominanceHeat.bands[0],
          {
            ...input.dominanceHeat.bands[1],
            effects: {
              ...input.dominanceHeat.bands[1].effects,
              upkeepSurchargeBps: 100,
            },
          },
        ],
      },
    };
    const report = runGridAntiSnowballSimulation(broken);
    expect(report.dominance.effectsMonotonic).toBe(false);
    expect(report.guardrailsEngage).toBe(false);
  });

  it('detects when City Power allows a single axis to become total power', () => {
    const broken: GridAntiSnowballSimulationInput = {
      ...input,
      cityPower: {
        maxSingleComponentWeightBps: 10_000,
        components: [
          {
            id: 'territory-control',
            weightBps: 10_000,
            rawCap: 100,
            curve: [{ rawValue: 100, attainmentBps: 10_000 }],
          },
        ],
      },
    };
    const report = runGridAntiSnowballSimulation(broken);
    expect(report.cityPower.singleAxisLimitedBelowTotalPower).toBe(false);
    expect(report.guardrailsEngage).toBe(false);
  });

  it('detects when Surge removes the underdog signal', () => {
    const broken: GridAntiSnowballSimulationInput = {
      ...input,
      surge: {
        ...input.surge,
        hotspotWeights: {
          strategicValueBps: 5_000,
          contestPressureBps: 5_000,
          underdogOpportunityBps: 0,
        },
      },
    };
    const report = runGridAntiSnowballSimulation(broken);
    expect(report.surge.underdogSignalActive).toBe(false);
    expect(report.surge.underdogPreferredWhenOtherwiseEqual).toBeNull();
    expect(report.guardrailsEngage).toBe(false);
  });

  it('is deterministic and validates top-level identity', () => {
    expect(runGridAntiSnowballSimulation(input)).toEqual(
      runGridAntiSnowballSimulation(structuredClone(input)),
    );
    expect(() => runGridAntiSnowballSimulation({ ...input, actorId: ' ' })).toThrow(
      'requires actorId',
    );
  });
});
