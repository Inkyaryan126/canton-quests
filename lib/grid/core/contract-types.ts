export const GRID_CONTRACT_KINDS = [
  'seasonal',
  'underdog',
  'anti-monopoly',
  'npc',
  'event',
  'tutorial',
] as const;

export type GridContractKind = (typeof GRID_CONTRACT_KINDS)[number];

export interface GridContractReward {
  credits: number;
  influence: number;
  commandPoints: number;
}

export interface GridContractObjectiveDefinition {
  id: string;
  target: number;
}

export interface GridContractLocationEnhancement {
  bonusReward: GridContractReward;
}

export interface GridContractDefinition {
  id: string;
  kind: GridContractKind;
  objectives: GridContractObjectiveDefinition[];
  reward: GridContractReward;
  locationEnhancement?: GridContractLocationEnhancement;
}
export type GridContractStatus = 'active' | 'completed' | 'expired';

export interface GridContractInstance {
  contractId: string;
  playerId: string;
  status: GridContractStatus;
  acceptedAtMs: number;
  expiresAtMs: number | null;
  completedAtMs: number | null;
  locationEnhanced: boolean;
  progress: Record<string, number>;
}

export interface GridContractCreateInput {
  playerId: string;
  acceptedAtMs: number;
  expiresAtMs: number | null;
}

export interface GridContractProgressInput {
  objectiveId: string;
  amount: number;
  nowMs: number;
  locationEnhanced?: boolean;
}

export interface GridContractProgressResult {
  instance: GridContractInstance;
  completedNow: boolean;
  rewardIntent: GridContractReward | null;
  locationBonusIntent: GridContractReward | null;
}