import type { GridTakeoverDamagePolicy } from './takeover-damage';

export const GRID_DEVELOPMENT_BRANCHES = [
  'commerce',
  'influence',
  'fortress',
  'intel',
  'prestige',
] as const;

export type GridDevelopmentBranch = (typeof GRID_DEVELOPMENT_BRANCHES)[number];

/** Phase-2 spendable resources. Influence stays strategically separate. */
export interface GridEconomyCost {
  credits: number;
  commandPoints: number;
}

export interface GridIncomeRate {
  creditsPerHour: number;
  influencePerHour: number;
}

export interface GridAssetIncomeConfig {
  defaultRate: GridIncomeRate;
  rateBySlug?: Record<string, GridIncomeRate>;
}

export interface GridDevelopmentBonuses {
  creditsPerHour?: number;
  influencePerHour?: number;
  defenseBps?: number;
  intelBps?: number;
  prestigeBps?: number;
}

export interface GridDevelopmentLevelConfig {
  /** Consecutive, one-based level number. The maximum is configuration-driven. */
  level: number;
  cost: GridEconomyCost;
  bonuses: GridDevelopmentBonuses;
}

export interface GridDevelopmentBranchConfig {
  levels: GridDevelopmentLevelConfig[];
}

export type GridDevelopmentConfig = Record<
  GridDevelopmentBranch,
  GridDevelopmentBranchConfig
>;

export type GridSkylineBranchMode = 'any' | 'single-branch' | 'mixed';

export interface GridSkylineRule {
  id: string;
  minDevelopedProperties: number;
  branchMode: GridSkylineBranchMode;
  bonuses: GridDevelopmentBonuses;
}

export interface GridEconomyConfig {
  /** Maximum lazy Credits/Influence accrual window. No implicit default exists. */
  offlineAccrualCapMinutes: number;
  neutralClaims: {
    defaultCost: GridEconomyCost;
    costByTerritorySlug?: Record<string, GridEconomyCost>;
    starterTerritorySlugs: string[];
  };
  income: {
    territories: GridAssetIncomeConfig;
    properties: GridAssetIncomeConfig;
  };
  propertyAcquisition: {
    requireTerritoryControl: boolean;
    defaultCost: GridEconomyCost;
    costByPropertySlug?: Record<string, GridEconomyCost>;
  };
  /** Explicit policy for transferring defeated-owner properties on territory capture. */
  takeover?: GridTakeoverDamagePolicy;
  development: GridDevelopmentConfig;
  skyline: {
    rules: GridSkylineRule[];
  };
}
