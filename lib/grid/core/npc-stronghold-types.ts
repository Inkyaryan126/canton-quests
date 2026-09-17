export type GridNpcStrongholdActivation =
  | 'season'
  | 'event'
  | 'surge';

export type GridNpcStrongholdStatus =
  | 'dormant'
  | 'active'
  | 'captured';

export type GridNpcStrongholdObjectiveKind =
  | 'pve-territory'
  | 'pve-landmark';

export interface GridNpcStrongholdConfig {
  strongholdId: string;
  factionId: string;
  territorySlug: string;
  landmarkSlug?: string;
  activation: GridNpcStrongholdActivation;
  baseGarrisonInfluence: number;
  maxGarrisonInfluence: number;
  pressureReinforcementBps: number;
  surgeReinforcementBps: number;
}

export interface GridNpcStrongholdContext {
  seasonActive: boolean;
  eventActive: boolean;
  surgeIntensityBps: number;
  factionPressureBps: number;
  captured: boolean;
}

export interface GridNpcStrongholdObjective {
  kind: GridNpcStrongholdObjectiveKind;
  factionId: string;
  territorySlug: string;
  landmarkSlug?: string;
}

export interface GridNpcStrongholdProjection {
  strongholdId: string;
  status: GridNpcStrongholdStatus;
  activationReason: GridNpcStrongholdActivation | null;
  contestable: boolean;
  baseGarrisonInfluence: number;
  reinforcementInfluence: number;
  garrisonInfluence: number;
  objective: GridNpcStrongholdObjective;
}
