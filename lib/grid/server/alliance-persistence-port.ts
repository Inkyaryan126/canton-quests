import type { GridAllianceMembership } from '../core/alliance-types';

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

export interface GridAlliancePersistencePort {
  getAllianceById(allianceId: string): Promise<GridAllianceState | null>;
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
}
