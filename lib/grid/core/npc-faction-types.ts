export type GridNpcTerritoryControl =
  | 'neutral'
  | 'npc'
  | 'player'
  | 'alliance';

export type GridNpcObjectiveKind =
  | 'occupy-neutral'
  | 'defend-landmark'
  | 'pressure-dominant-owner'
  | 'event-response'
  | 'tutorial-opponent';

export interface GridNpcObjectiveWeights {
  neutralExpansionBps: number;
  landmarkDefenseBps: number;
  dominantOwnerPressureBps: number;
  eventResponseBps: number;
  tutorialOpponentBps: number;
}

export interface GridNpcFactionConfig {
  factionId: string;
  basePressureBps: number;
  maxPressureBps: number;
  dominanceHeatResponseBps: number;
  eventPressureResponseBps: number;
  baseObjectiveSlots: number;
  maxObjectiveSlots: number;
  objectiveWeights: GridNpcObjectiveWeights;
}

export interface GridNpcTerritoryCandidate {
  territorySlug: string;
  control: GridNpcTerritoryControl;
  strategicValue: number;
  containsLandmark: boolean;
  ownerDominanceBps?: number;
  eventPriorityBps?: number;
  tutorialOpponentEligible?: boolean;
}

export interface GridNpcFactionContext {
  dominanceHeatBps: number;
  eventPressureBps: number;
  territories: GridNpcTerritoryCandidate[];
}

export interface GridNpcFactionPressureProjection {
  factionId: string;
  pressureBps: number;
  objectiveSlots: number;
  capped: boolean;
}

export interface GridNpcFactionObjective {
  territorySlug: string;
  kind: GridNpcObjectiveKind;
  scoreBps: number;
  strategicValueBps: number;
}

export interface GridNpcFactionPlan {
  pressure: GridNpcFactionPressureProjection;
  objectives: GridNpcFactionObjective[];
}
