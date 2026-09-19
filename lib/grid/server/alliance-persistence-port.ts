import type {
  GridAllianceAdjacencyEdge,
  GridAllianceMembership,
  GridAllianceTerritoryOwnership,
  GridAllianceUpkeepBreakdown,
} from '../core/alliance-types';

export type GridAllianceStatus = 'active' | 'disbanded';

export interface GridAllianceState {
  allianceId: string;
  seasonId: string;
  slug: string;
  name: string;
  leaderPlayerId: string;
  status: GridAllianceStatus;
  influencePool: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  disbandedAt: string | null;
}

export interface GridCreateAlliancePersistenceCommand {
  allianceId: string;
  seasonId: string;
  leaderPlayerId: string;
  slug: string;
  name: string;
  joinedAt: string;
}

export interface GridCreateAlliancePersistenceResult {
  alliance: GridAllianceState;
  membership: GridAllianceMembership;
}

export interface GridJoinAlliancePersistenceCommand {
  allianceId: string;
  seasonId: string;
  playerId: string;
  joinedAt: string;
  maxMembers: number;
}

export interface GridLeaveAlliancePersistenceCommand {
  allianceId: string;
  seasonId: string;
  playerId: string;
  leftAt: string;
  cooldownUntil: string;
}


export interface GridAllianceInfluenceContributionPersistenceCommand {
  allianceId: string;
  seasonId: string;
  playerId: string;
  expectedAllianceRevision: number;
  expectedPlayerInfluence: number;
  acceptedInfluence: number;
  playerInfluenceAfter: number;
  poolInfluenceAfter: number;
  poolCap: number;
  constraints: Array<'player-balance' | 'pool-capacity'>;
  idempotencyKey: string;
  now: string;
}

export interface GridAllianceInfluenceContributionPersistenceResult {
  acceptedInfluence: number;
  playerInfluenceAfter: number;
  poolInfluenceAfter: number;
  allianceRevision: number;
  constraints: Array<'player-balance' | 'pool-capacity'>;
  eventId: string;
  replayed: boolean;
}


export interface GridAllianceNetworkPersistenceInputs {
  territoryOwnership: GridAllianceTerritoryOwnership[];
  adjacencyEdges: GridAllianceAdjacencyEdge[];
}

export interface GridAllianceUpkeepPersistenceCommand {
  allianceId: string;
  seasonId: string;
  expectedAllianceRevision: number;
  expectedPoolInfluence: number;
  ticks: number;
  activeMemberCount: number;
  disconnectedComponentCount: number;
  perTickInfluence: number;
  totalInfluence: number;
  paidInfluence: number;
  poolInfluenceAfter: number;
  shortfallInfluence: number;
  fullyPaid: boolean;
  breakdown: GridAllianceUpkeepBreakdown;
  idempotencyKey: string;
  now: string;
}

export interface GridAllianceUpkeepPersistenceResult {
  ticks: number;
  activeMemberCount: number;
  disconnectedComponentCount: number;
  perTickInfluence: number;
  totalInfluence: number;
  paidInfluence: number;
  poolInfluenceAfter: number;
  shortfallInfluence: number;
  fullyPaid: boolean;
  breakdown: GridAllianceUpkeepBreakdown;
  allianceRevision: number;
  eventId: string;
  replayed: boolean;
}


export interface GridAllianceDisbandPersistenceCommand {
  allianceId: string;
  seasonId: string;
  leaderPlayerId: string;
  expectedAllianceRevision: number;
  expectedInfluencePool: number;
  disbandedAt: string;
  cooldownUntil: string;
  idempotencyKey: string;
}

export interface GridAllianceDisbandPersistenceResult {
  allianceId: string;
  status: 'disbanded';
  disbandedAt: string;
  cooldownUntil: string;
  closedMembershipCount: number;
  influencePoolLocked: number;
  allianceRevision: number;
  eventId: string;
  replayed: boolean;
}

export interface GridAlliancePersistencePort {
  getAllianceById(allianceId: string): Promise<GridAllianceState | null>;
  listActiveAlliances(seasonId: string): Promise<GridAllianceState[]>;
  getMembershipHistory(
    seasonId: string,
    playerId: string,
  ): Promise<GridAllianceMembership[]>;
  countActiveMembers(allianceId: string): Promise<number>;
  createAllianceWithLeader(
    command: GridCreateAlliancePersistenceCommand,
  ): Promise<GridCreateAlliancePersistenceResult>;
  joinAlliance(
    command: GridJoinAlliancePersistenceCommand,
  ): Promise<GridAllianceMembership>;
  leaveAlliance(
    command: GridLeaveAlliancePersistenceCommand,
  ): Promise<GridAllianceMembership>;
  getPlayerInfluence(seasonId: string, playerId: string): Promise<number | null>;
  getInfluenceContributionReplay(
    seasonId: string,
    allianceId: string,
    playerId: string,
    idempotencyKey: string,
  ): Promise<GridAllianceInfluenceContributionPersistenceResult | null>;
  applyInfluenceContribution(
    command: GridAllianceInfluenceContributionPersistenceCommand,
  ): Promise<GridAllianceInfluenceContributionPersistenceResult | null>;
  getActiveMemberPlayerIds(allianceId: string): Promise<string[]>;
  getAllianceNetworkInputs(
    seasonId: string,
    memberPlayerIds: string[],
  ): Promise<GridAllianceNetworkPersistenceInputs>;
  getUpkeepSettlementReplay(
    seasonId: string,
    allianceId: string,
    idempotencyKey: string,
  ): Promise<GridAllianceUpkeepPersistenceResult | null>;
  applyUpkeepSettlement(
    command: GridAllianceUpkeepPersistenceCommand,
  ): Promise<GridAllianceUpkeepPersistenceResult | null>;
  getDisbandReplay(
    seasonId: string,
    allianceId: string,
    playerId: string,
    idempotencyKey: string,
  ): Promise<GridAllianceDisbandPersistenceResult | null>;
  disbandAlliance(
    command: GridAllianceDisbandPersistenceCommand,
  ): Promise<GridAllianceDisbandPersistenceResult | null>;
}
