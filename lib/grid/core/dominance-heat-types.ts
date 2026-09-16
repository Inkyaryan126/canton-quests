export type GridDominanceActorKind = 'player' | 'alliance';

export type GridDominanceExposureSource =
  | 'none'
  | 'territory-share'
  | 'strategic-value-share'
  | 'both';

export interface GridDominanceHeatEffects {
  neutralFactionPressureBps: number;
  borderRewardBonusBps: number;
  upkeepSurchargeBps: number;
  rivalObjectiveBonusBps: number;
  antiMonopolyContractSlots: number;
}

export interface GridDominanceHeatBand {
  id: string;
  minDominanceBps: number;
  effects: GridDominanceHeatEffects;
}

export interface GridDominanceHeatConfig {
  bands: GridDominanceHeatBand[];
}
export interface GridDominanceHeatInput {
  actorId: string;
  actorKind: GridDominanceActorKind;
  controlledTerritories: number;
  eligibleTerritories: number;
  controlledStrategicValue?: number;
  totalStrategicValue?: number;
}

export interface GridDominanceHeatProjection {
  actorId: string;
  actorKind: GridDominanceActorKind;
  territoryShareBps: number;
  strategicValueShareBps: number;
  dominanceScoreBps: number;
  exposureSource: GridDominanceExposureSource;
  active: boolean;
  bandId: string | null;
  effects: GridDominanceHeatEffects;
  nextBandId: string | null;
  bpsToNextBand: number | null;
}
