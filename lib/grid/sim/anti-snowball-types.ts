import type { GridCityPowerConfig } from '../core/city-power-types';
import type {
  GridDominanceHeatConfig,
  GridDominanceHeatEffects,
} from '../core/dominance-heat-types';
import type { GridSurgeConfig } from '../core/surge-types';

export interface GridAntiSnowballSimulationInput {
  actorId: string;
  eligibleTerritories: number;
  dominanceHeat: GridDominanceHeatConfig;
  cityPower: GridCityPowerConfig;
  surge: GridSurgeConfig;
}

export interface GridAntiSnowballDominanceSample {
  controlledTerritories: number;
  dominanceScoreBps: number;
  bandId: string | null;
  effects: GridDominanceHeatEffects;
}

export interface GridAntiSnowballDominanceReport {
  samples: GridAntiSnowballDominanceSample[];
  effectsMonotonic: boolean;
  counterPressureEscalates: boolean;
  firstActiveTerritoryCount: number | null;
  highestBandId: string | null;
}

export interface GridAntiSnowballCityPowerReport {
  maxSingleAxisPowerBps: number;
  maxSingleAxisComponentId: string;
  configuredSingleComponentCeilingBps: number;
  singleAxisLimitedBelowTotalPower: boolean;
}

export interface GridAntiSnowballSurgeReport {
  underdogOpportunityWeightBps: number;
  underdogSignalActive: boolean;
  underdogPreferredWhenOtherwiseEqual: boolean | null;
  dominanceExposureMultiplierBps: number;
  surgeDoesNotReduceDominanceExposure: boolean;
}

export interface GridAntiSnowballSimulationReport {
  actorId: string;
  eligibleTerritories: number;
  dominance: GridAntiSnowballDominanceReport;
  cityPower: GridAntiSnowballCityPowerReport;
  surge: GridAntiSnowballSurgeReport;
  guardrailsEngage: boolean;
}
