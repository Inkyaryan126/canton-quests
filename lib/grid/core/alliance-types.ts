export interface GridAllianceRules {
  maxMembers: number;
  leaveCooldownSeconds: number;
  influencePoolCap: number;
  baseUpkeepInfluencePerTick: number;
  memberUpkeepInfluencePerTick: number;
  disconnectedComponentUpkeepInfluencePerTick: number;
  largeAllianceThreshold: number;
  largeAllianceSurchargeInfluencePerMemberPerTick: number;
}

export interface GridAllianceMembership {
  playerId: string;
  seasonId: string;
  allianceId: string;
  joinedAt: string;
  leftAt: string | null;
  cooldownUntil: string | null;
}

export type GridAllianceJoinDenialReason =
  | 'already-in-alliance'
  | 'alliance-full'
  | 'cooldown-active';

export interface GridAllianceJoinRequest {
  playerId: string;
  seasonId: string;
  allianceId: string;
  now: string;
  targetActiveMemberCount: number;
  membershipHistory: GridAllianceMembership[];
}

export interface GridAllianceJoinDecision {
  allowed: boolean;
  reason: GridAllianceJoinDenialReason | null;
  cooldownUntil: string | null;
}

export type GridAllianceContributionConstraint =
  | 'player-balance'
  | 'pool-capacity';

export interface GridAllianceContributionInput {
  requestedInfluence: number;
  playerInfluence: number;
  poolInfluence: number;
}

export interface GridAllianceContributionDecision {
  acceptedInfluence: number;
  playerInfluenceAfter: number;
  poolInfluenceAfter: number;
  constraints: GridAllianceContributionConstraint[];
}

export interface GridAllianceDominanceHeatUpkeep {
  bandId: string | null;
  upkeepSurchargeBps: number;
}

export interface GridAllianceUpkeepInput {
  activeMemberCount: number;
  disconnectedComponentCount: number;
  ticks: number;
  dominanceHeat: GridAllianceDominanceHeatUpkeep;
}

export interface GridAllianceUpkeepBreakdown {
  baseInfluencePerTick: number;
  memberInfluencePerTick: number;
  disconnectedInfluencePerTick: number;
  largeAllianceSurchargeInfluencePerTick: number;
  /** Optional only for replay compatibility with upkeep events written before Heat enforcement. */
  dominanceHeatBandId?: string | null;
  dominanceHeatUpkeepSurchargeBps?: number;
  dominanceHeatSurchargeInfluencePerTick?: number;
}

export interface GridAllianceUpkeepProjection {
  ticks: number;
  perTickInfluence: number;
  totalInfluence: number;
  breakdown: GridAllianceUpkeepBreakdown;
}

export interface GridAllianceUpkeepSettlementInput
  extends GridAllianceUpkeepInput {
  poolInfluence: number;
}

export interface GridAllianceUpkeepSettlement {
  upkeep: GridAllianceUpkeepProjection;
  paidInfluence: number;
  poolInfluenceAfter: number;
  shortfallInfluence: number;
  fullyPaid: boolean;
}

export interface GridAllianceTerritoryOwnership {
  territorySlug: string;
  ownerPlayerId: string;
}

export interface GridAllianceAdjacencyEdge {
  fromTerritorySlug: string;
  toTerritorySlug: string;
}

export interface GridAllianceNetworkProjection {
  controlledTerritorySlugs: string[];
  components: string[][];
  componentCount: number;
  largestComponentSize: number;
  isolatedTerritorySlugs: string[];
  disconnectedComponentCount: number;
}
