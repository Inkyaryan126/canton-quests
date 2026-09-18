import { projectGridCityPower } from '../core/city-power';
import { projectGridDominanceHeat } from '../core/dominance-heat';
import { selectGridSurgeHotspots } from '../core/surge';
import type { GridDominanceHeatEffects } from '../core/dominance-heat-types';
import type { GridSurgeHotspotCandidate } from '../core/surge-types';
import type {
  GridAntiSnowballCityPowerReport,
  GridAntiSnowballDominanceReport,
  GridAntiSnowballSimulationInput,
  GridAntiSnowballSimulationReport,
  GridAntiSnowballSurgeReport,
} from './anti-snowball-types';

const EFFECT_KEYS: Array<keyof GridDominanceHeatEffects> = [
  'neutralFactionPressureBps',
  'borderRewardBonusBps',
  'upkeepSurchargeBps',
  'rivalObjectiveBonusBps',
  'antiMonopolyContractSlots',
];

function nonBlank(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid anti-snowball simulation requires ${label}`);
  return normalized;
}

function positiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Grid anti-snowball simulation requires positive ${label}`);
  }
  return value;
}

function dominanceReport(
  actorId: string,
  eligibleTerritories: number,
  config: GridAntiSnowballSimulationInput['dominanceHeat'],
): GridAntiSnowballDominanceReport {
  const samples = Array.from({ length: eligibleTerritories + 1 }, (_, controlledTerritories) => {
    const projection = projectGridDominanceHeat(
      {
        actorId,
        actorKind: 'player',
        controlledTerritories,
        eligibleTerritories,
      },
      config,
    );
    return {
      controlledTerritories,
      dominanceScoreBps: projection.dominanceScoreBps,
      bandId: projection.bandId,
      effects: { ...projection.effects },
    };
  });

  let effectsMonotonic = true;
  let counterPressureEscalates = false;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1].effects;
    const current = samples[index].effects;
    for (const key of EFFECT_KEYS) {
      if (current[key] < previous[key]) effectsMonotonic = false;
      if (current[key] > previous[key]) counterPressureEscalates = true;
    }
  }

  const firstActive = samples.find((sample) => sample.bandId !== null);
  const highestActive = [...samples].reverse().find((sample) => sample.bandId !== null);

  return {
    samples,
    effectsMonotonic,
    counterPressureEscalates,
    firstActiveTerritoryCount: firstActive?.controlledTerritories ?? null,
    highestBandId: highestActive?.bandId ?? null,
  };
}

function cityPowerReport(
  config: GridAntiSnowballSimulationInput['cityPower'],
): GridAntiSnowballCityPowerReport {
  const singleAxis = config.components.map((component) => {
    const projection = projectGridCityPower(
      { [component.id]: component.rawCap },
      config,
    );
    return {
      componentId: component.id,
      powerBps: projection.cityPowerBps,
    };
  });

  const strongest = singleAxis.reduce((best, current) =>
    current.powerBps > best.powerBps ? current : best,
  );

  return {
    maxSingleAxisPowerBps: strongest.powerBps,
    maxSingleAxisComponentId: strongest.componentId,
    configuredSingleComponentCeilingBps: config.maxSingleComponentWeightBps,
    singleAxisLimitedBelowTotalPower: strongest.powerBps < 10_000,
  };
}

function equalCandidate(
  territorySlug: string,
  districtSlug: string,
  underdogOpportunityBps: number,
): GridSurgeHotspotCandidate {
  return {
    territorySlug,
    districtSlug,
    strategicValueBps: 5_000,
    contestPressureBps: 5_000,
    underdogOpportunityBps,
  };
}

function surgeReport(
  config: GridAntiSnowballSimulationInput['surge'],
): GridAntiSnowballSurgeReport {
  const underdogOpportunityWeightBps = config.hotspotWeights.underdogOpportunityBps;
  const underdogSignalActive = underdogOpportunityWeightBps > 0 && config.hotspotCount > 0;
  let underdogPreferredWhenOtherwiseEqual: boolean | null = null;

  if (config.hotspotCount > 0) {
    const candidates = [
      equalCandidate('baseline-opportunity', 'district-a', 0),
      equalCandidate('underdog-opportunity', 'district-b', 10_000),
    ];
    const selected = selectGridSurgeHotspots(candidates, config);
    if (selected.length > 0) {
      underdogPreferredWhenOtherwiseEqual =
        underdogOpportunityWeightBps === 0
          ? null
          : selected[0].territorySlug === 'underdog-opportunity';
    }
  }

  return {
    underdogOpportunityWeightBps,
    underdogSignalActive,
    underdogPreferredWhenOtherwiseEqual,
    dominanceExposureMultiplierBps: config.dominanceExposureMultiplierBps,
    surgeDoesNotReduceDominanceExposure:
      config.dominanceExposureMultiplierBps >= 10_000,
  };
}

export function runGridAntiSnowballSimulation(
  input: GridAntiSnowballSimulationInput,
): GridAntiSnowballSimulationReport {
  const actorId = nonBlank(input.actorId, 'actorId');
  const eligibleTerritories = positiveSafeInteger(
    input.eligibleTerritories,
    'eligibleTerritories',
  );

  const dominance = dominanceReport(actorId, eligibleTerritories, input.dominanceHeat);
  const cityPower = cityPowerReport(input.cityPower);
  const surge = surgeReport(input.surge);

  return {
    actorId,
    eligibleTerritories,
    dominance,
    cityPower,
    surge,
    guardrailsEngage:
      dominance.effectsMonotonic &&
      dominance.counterPressureEscalates &&
      cityPower.singleAxisLimitedBelowTotalPower &&
      surge.underdogSignalActive &&
      surge.underdogPreferredWhenOtherwiseEqual === true &&
      surge.surgeDoesNotReduceDominanceExposure,
  };
}
