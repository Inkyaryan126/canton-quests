import type { GridNpcStrongholdActivation } from '../core/npc-stronghold-types';

export interface GridNpcStrongholdDefinitionAdminView {
  strongholdId: string;
  factionId: string;
  territorySlug: string;
  landmarkSlug: string | null;
  activation: GridNpcStrongholdActivation;
  baseGarrisonInfluence: number;
  maxGarrisonInfluence: number;
  pressureReinforcementBps: number;
  surgeReinforcementBps: number;
  enabled: boolean;
  hasContestHistory: boolean;
  activeContest: boolean;
  updatedAt: string;
}

export interface GridUpsertNpcStrongholdDefinitionCommand {
  strongholdId: string;
  factionId: string;
  territorySlug: string;
  landmarkSlug: string | null;
  activation: GridNpcStrongholdActivation;
  baseGarrisonInfluence: number;
  maxGarrisonInfluence: number;
  pressureReinforcementBps: number;
  surgeReinforcementBps: number;
  idempotencyKey: string;
  now: string;
}

export interface GridSetNpcStrongholdDefinitionEnabledCommand {
  strongholdId: string;
  enabled: boolean;
  idempotencyKey: string;
  now: string;
}

export interface GridNpcStrongholdDefinitionMutationResult {
  strongholdId: string;
  duplicate: boolean;
  updatedAt: string;
}

export interface GridNpcStrongholdDefinitionAdminPort {
  listDefinitions(): Promise<GridNpcStrongholdDefinitionAdminView[]>;
  upsertDefinition(
    command: GridUpsertNpcStrongholdDefinitionCommand,
  ): Promise<GridNpcStrongholdDefinitionMutationResult>;
  setDefinitionEnabled(
    command: GridSetNpcStrongholdDefinitionEnabledCommand,
  ): Promise<GridNpcStrongholdDefinitionMutationResult>;
}
