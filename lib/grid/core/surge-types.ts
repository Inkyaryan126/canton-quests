export type GridSurgePhase =
  | 'pre-season'
  | 'regular'
  | 'surge'
  | 'ended';

export interface GridSurgeHotspotWeights {
  strategicValueBps: number;
  contestPressureBps: number;
  underdogOpportunityBps: number;
}

export interface GridSurgeConfig {
  durationMinutes: number;
  districtControlValueMultiplierBps: number;
  landmarkValueMultiplierBps: number;
  hotspotValueMultiplierBps: number;
  dominanceExposureMultiplierBps: number;
  hotspotCount: number;
  maxHotspotsPerDistrict: number;
  specialObjectiveSlots: number;
  npcStrongholdSlots: number;
  emphasizeFinalRankings: boolean;
  hotspotWeights: GridSurgeHotspotWeights;
}

export interface GridSurgeSeasonWindow {
  startsAt: string;
  endsAt: string;
  surgeStartsAt?: string | null;
}

export interface GridSurgeHotspotCandidate {
  territorySlug: string;
  districtSlug: string;
  strategicValueBps: number;
  contestPressureBps: number;
  underdogOpportunityBps: number;
}

export interface GridSurgeHotspotProjection {
  territorySlug: string;
  districtSlug: string;
  scoreBps: number;
  rank: number;
}

export interface GridSurgeEffects {
  districtControlValueMultiplierBps: number;
  landmarkValueMultiplierBps: number;
  hotspotValueMultiplierBps: number;
  dominanceExposureMultiplierBps: number;
  specialObjectiveSlots: number;
  npcStrongholdSlots: number;
  emphasizeFinalRankings: boolean;
}

export interface GridSurgeProjection {
  phase: GridSurgePhase;
  active: boolean;
  startsAt: string;
  surgeStartsAt: string;
  endsAt: string;
  millisecondsUntilSurge: number | null;
  millisecondsRemaining: number | null;
  progressBps: number;
  effects: GridSurgeEffects;
  hotspots: GridSurgeHotspotProjection[];
}
