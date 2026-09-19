import {
  contributeGridAllianceInfluence,
  evaluateGridAllianceJoin,
  leaveGridAlliance as closeGridAllianceMembership,
  projectGridAllianceNetwork,
  settleGridAllianceUpkeep,
  validateGridAllianceRules,
} from '../core/alliance';
import type {
  GridAllianceJoinDenialReason,
  GridAllianceMembership,
  GridAllianceRules,
} from '../core/alliance-types';
import { projectGridDominanceHeat } from '../core/dominance-heat';
import type { GridDominanceHeatConfig } from '../core/dominance-heat-types';
import type {
  GridAllianceDisbandPersistenceResult,
  GridAlliancePersistencePort,
  GridAllianceState,
  GridAllianceUpkeepPersistenceResult,
  GridAllianceInfluenceContributionPersistenceResult,
  GridCreateAlliancePersistenceResult,
} from './alliance-persistence-port';

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid Alliance requires ${label}`);
  return normalized;
}

function requireTimestamp(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Grid Alliance requires a valid ${label} timestamp`);
  }
  return new Date(parsed).toISOString();
}

function requireActiveAlliance(
  alliance: GridAllianceState | null,
  seasonId: string,
): GridAllianceState {
  if (!alliance || alliance.seasonId !== seasonId || alliance.status !== 'active') {
    throw new Error('Grid Alliance active seasonal Alliance was not found');
  }
  return alliance;
}

export interface GridCreateAllianceCommand {
  allianceId: string;
  seasonId: string;
  leaderPlayerId: string;
  slug: string;
  name: string;
  now: string;
}

export interface GridJoinAllianceCommand {
  allianceId: string;
  seasonId: string;
  playerId: string;
  now: string;
}

export interface GridJoinAllianceResult {
  joined: boolean;
  reason: GridAllianceJoinDenialReason | null;
  cooldownUntil: string | null;
  membership: GridAllianceMembership | null;
}

export interface GridLeaveAllianceCommand {
  allianceId: string;
  seasonId: string;
  playerId: string;
  now: string;
}

export async function createGridAlliance(
  port: GridAlliancePersistencePort,
  command: GridCreateAllianceCommand,
  rules: GridAllianceRules,
): Promise<GridCreateAlliancePersistenceResult> {
  validateGridAllianceRules(rules);
  const allianceId = requireText(command.allianceId, 'allianceId');
  const seasonId = requireText(command.seasonId, 'seasonId');
  const leaderPlayerId = requireText(command.leaderPlayerId, 'leaderPlayerId');
  const slug = requireText(command.slug, 'slug').toLowerCase();
  const name = requireText(command.name, 'name');
  const now = requireTimestamp(command.now, 'now');

  const leaderInfluence = await port.getPlayerInfluence(seasonId, leaderPlayerId);
  if (leaderInfluence === null) {
    throw new Error('Grid Alliance player season state was not found');
  }

  const membershipHistory = await port.getMembershipHistory(
    seasonId,
    leaderPlayerId,
  );
  const decision = evaluateGridAllianceJoin(
    {
      playerId: leaderPlayerId,
      seasonId,
      allianceId,
      now,
      targetActiveMemberCount: 0,
      membershipHistory,
    },
    rules,
  );
  if (!decision.allowed) {
    throw new Error(`Grid Alliance leader cannot create Alliance: ${decision.reason}`);
  }

  return port.createAllianceWithLeader({
    allianceId,
    seasonId,
    leaderPlayerId,
    slug,
    name,
    joinedAt: now,
  });
}

export async function joinGridAlliance(
  port: GridAlliancePersistencePort,
  command: GridJoinAllianceCommand,
  rules: GridAllianceRules,
): Promise<GridJoinAllianceResult> {
  validateGridAllianceRules(rules);
  const allianceId = requireText(command.allianceId, 'allianceId');
  const seasonId = requireText(command.seasonId, 'seasonId');
  const playerId = requireText(command.playerId, 'playerId');
  const now = requireTimestamp(command.now, 'now');
  const alliance = requireActiveAlliance(
    await port.getAllianceById(allianceId),
    seasonId,
  );
  const playerInfluence = await port.getPlayerInfluence(seasonId, playerId);
  if (playerInfluence === null) {
    throw new Error('Grid Alliance player season state was not found');
  }

  const [membershipHistory, targetActiveMemberCount] = await Promise.all([
    port.getMembershipHistory(seasonId, playerId),
    port.countActiveMembers(alliance.allianceId),
  ]);
  const decision = evaluateGridAllianceJoin(
    {
      playerId,
      seasonId,
      allianceId,
      now,
      targetActiveMemberCount,
      membershipHistory,
    },
    rules,
  );

  if (!decision.allowed) {
    return {
      joined: false,
      reason: decision.reason,
      cooldownUntil: decision.cooldownUntil,
      membership: null,
    };
  }

  const membership = await port.joinAlliance({
    allianceId,
    seasonId,
    playerId,
    joinedAt: now,
    maxMembers: rules.maxMembers,
  });
  return {
    joined: true,
    reason: null,
    cooldownUntil: null,
    membership,
  };
}

export async function leaveGridAllianceMembership(
  port: GridAlliancePersistencePort,
  command: GridLeaveAllianceCommand,
  rules: GridAllianceRules,
): Promise<GridAllianceMembership> {
  validateGridAllianceRules(rules);
  const allianceId = requireText(command.allianceId, 'allianceId');
  const seasonId = requireText(command.seasonId, 'seasonId');
  const playerId = requireText(command.playerId, 'playerId');
  const now = requireTimestamp(command.now, 'now');
  const alliance = requireActiveAlliance(
    await port.getAllianceById(allianceId),
    seasonId,
  );

  if (alliance.leaderPlayerId === playerId) {
    throw new Error(
      'Grid Alliance leader must transfer leadership or disband before leaving',
    );
  }

  const membershipHistory = await port.getMembershipHistory(seasonId, playerId);
  const activeMembership = membershipHistory.find(
    (membership) =>
      membership.allianceId === allianceId &&
      membership.seasonId === seasonId &&
      membership.playerId === playerId &&
      membership.leftAt === null,
  );
  if (!activeMembership) {
    throw new Error('Grid Alliance active membership was not found');
  }

  const closed = closeGridAllianceMembership(activeMembership, now, rules);
  return port.leaveAlliance({
    allianceId,
    seasonId,
    playerId,
    leftAt: closed.leftAt!,
    cooldownUntil: closed.cooldownUntil!,
  });
}


export interface GridContributeAllianceInfluenceCommand {
  allianceId: string;
  seasonId: string;
  playerId: string;
  requestedInfluence: number;
  idempotencyKey: string;
  now: string;
}

export interface GridPersistentAllianceInfluenceContributionResult
  extends Omit<GridAllianceInfluenceContributionPersistenceResult, 'eventId'> {
  eventId: string | null;
  persisted: boolean;
}

export async function contributePersistentGridAllianceInfluence(
  port: GridAlliancePersistencePort,
  command: GridContributeAllianceInfluenceCommand,
  rules: GridAllianceRules,
): Promise<GridPersistentAllianceInfluenceContributionResult> {
  validateGridAllianceRules(rules);
  const allianceId = requireText(command.allianceId, 'allianceId');
  const seasonId = requireText(command.seasonId, 'seasonId');
  const playerId = requireText(command.playerId, 'playerId');
  const idempotencyKey = requireText(command.idempotencyKey, 'idempotencyKey');
  const now = requireTimestamp(command.now, 'now');

  const replay = await port.getInfluenceContributionReplay(
    seasonId,
    allianceId,
    playerId,
    idempotencyKey,
  );
  if (replay) {
    return { ...replay, persisted: true };
  }

  const alliance = requireActiveAlliance(
    await port.getAllianceById(allianceId),
    seasonId,
  );
  const membershipHistory = await port.getMembershipHistory(seasonId, playerId);
  const isActiveMember = membershipHistory.some(
    (membership) =>
      membership.allianceId === allianceId &&
      membership.seasonId === seasonId &&
      membership.playerId === playerId &&
      membership.leftAt === null,
  );
  if (!isActiveMember) {
    throw new Error('Grid Alliance Influence contribution requires active membership');
  }

  const playerInfluence = await port.getPlayerInfluence(seasonId, playerId);
  if (playerInfluence === null) {
    throw new Error('Grid Alliance player season Influence state was not found');
  }

  const decision = contributeGridAllianceInfluence(
    {
      requestedInfluence: command.requestedInfluence,
      playerInfluence,
      poolInfluence: alliance.influencePool,
    },
    rules,
  );

  if (decision.acceptedInfluence === 0) {
    return {
      ...decision,
      allianceRevision: alliance.revision,
      eventId: null,
      replayed: false,
      persisted: false,
    };
  }

  const persisted = await port.applyInfluenceContribution({
    allianceId,
    seasonId,
    playerId,
    expectedAllianceRevision: alliance.revision,
    expectedPlayerInfluence: playerInfluence,
    acceptedInfluence: decision.acceptedInfluence,
    playerInfluenceAfter: decision.playerInfluenceAfter,
    poolInfluenceAfter: decision.poolInfluenceAfter,
    poolCap: rules.influencePoolCap,
    constraints: decision.constraints,
    idempotencyKey,
    now,
  });
  if (!persisted) {
    throw new Error(
      'Grid Alliance contribution changed; reload before retrying',
    );
  }

  return { ...persisted, persisted: true };
}

export interface GridSettleAllianceUpkeepCommand {
  allianceId: string;
  seasonId: string;
  ticks: number;
  idempotencyKey: string;
  now: string;
}

export async function settlePersistentGridAllianceUpkeep(
  port: GridAlliancePersistencePort,
  command: GridSettleAllianceUpkeepCommand,
  rules: GridAllianceRules,
  dominanceHeatConfig: GridDominanceHeatConfig,
): Promise<GridAllianceUpkeepPersistenceResult> {
  validateGridAllianceRules(rules);
  const allianceId = requireText(command.allianceId, 'allianceId');
  const seasonId = requireText(command.seasonId, 'seasonId');
  const idempotencyKey = requireText(command.idempotencyKey, 'idempotencyKey');
  const now = requireTimestamp(command.now, 'now');

  if (!Number.isSafeInteger(command.ticks) || command.ticks <= 0) {
    throw new Error('Grid Alliance upkeep ticks must be a positive safe integer');
  }

  const replay = await port.getUpkeepSettlementReplay(
    seasonId,
    allianceId,
    idempotencyKey,
  );
  if (replay) return replay;

  const alliance = requireActiveAlliance(
    await port.getAllianceById(allianceId),
    seasonId,
  );
  const memberPlayerIds = await port.getActiveMemberPlayerIds(allianceId);
  if (memberPlayerIds.length === 0) {
    throw new Error('Grid Alliance upkeep requires at least one active member');
  }
  if (memberPlayerIds.length > rules.maxMembers) {
    throw new Error('Grid Alliance active member count exceeds configured maximum');
  }

  const networkInputs = await port.getAllianceNetworkInputs(
    seasonId,
    memberPlayerIds,
  );
  const network = projectGridAllianceNetwork(
    memberPlayerIds,
    networkInputs.territoryOwnership,
    networkInputs.adjacencyEdges,
  );
  const dominanceHeatProjection = projectGridDominanceHeat(
    {
      actorId: allianceId,
      actorKind: 'alliance',
      controlledTerritories: network.controlledTerritorySlugs.length,
      eligibleTerritories: networkInputs.eligibleTerritoryCount,
    },
    dominanceHeatConfig,
  );
  const settlement = settleGridAllianceUpkeep(
    {
      activeMemberCount: memberPlayerIds.length,
      disconnectedComponentCount: network.disconnectedComponentCount,
      ticks: command.ticks,
      poolInfluence: alliance.influencePool,
      dominanceHeat: {
        bandId: dominanceHeatProjection.bandId,
        upkeepSurchargeBps:
          dominanceHeatProjection.effects.upkeepSurchargeBps,
      },
    },
    rules,
  );

  const persisted = await port.applyUpkeepSettlement({
    allianceId,
    seasonId,
    expectedAllianceRevision: alliance.revision,
    expectedPoolInfluence: alliance.influencePool,
    ticks: settlement.upkeep.ticks,
    activeMemberCount: memberPlayerIds.length,
    disconnectedComponentCount: network.disconnectedComponentCount,
    perTickInfluence: settlement.upkeep.perTickInfluence,
    totalInfluence: settlement.upkeep.totalInfluence,
    paidInfluence: settlement.paidInfluence,
    poolInfluenceAfter: settlement.poolInfluenceAfter,
    shortfallInfluence: settlement.shortfallInfluence,
    fullyPaid: settlement.fullyPaid,
    breakdown: settlement.upkeep.breakdown,
    idempotencyKey,
    now,
  });
  if (!persisted) {
    throw new Error('Grid Alliance upkeep changed; reload before retrying');
  }
  return persisted;
}

export interface GridDisbandAllianceCommand {
  allianceId: string;
  seasonId: string;
  playerId: string;
  idempotencyKey: string;
  now: string;
}

export async function disbandGridAlliance(
  port: GridAlliancePersistencePort,
  command: GridDisbandAllianceCommand,
  rules: GridAllianceRules,
): Promise<GridAllianceDisbandPersistenceResult> {
  validateGridAllianceRules(rules);
  const allianceId = requireText(command.allianceId, 'allianceId');
  const seasonId = requireText(command.seasonId, 'seasonId');
  const playerId = requireText(command.playerId, 'playerId');
  const idempotencyKey = requireText(command.idempotencyKey, 'idempotencyKey');
  const now = requireTimestamp(command.now, 'now');

  const replay = await port.getDisbandReplay(
    seasonId,
    allianceId,
    playerId,
    idempotencyKey,
  );
  if (replay) return replay;

  const alliance = requireActiveAlliance(
    await port.getAllianceById(allianceId),
    seasonId,
  );
  if (alliance.leaderPlayerId !== playerId) {
    throw new Error('Grid Alliance disband requires the Alliance leader');
  }

  const history = await port.getMembershipHistory(seasonId, playerId);
  const activeLeaderMembership = history.find(
    (membership) =>
      membership.allianceId === allianceId &&
      membership.playerId === playerId &&
      membership.seasonId === seasonId &&
      membership.leftAt === null,
  );
  if (!activeLeaderMembership) {
    throw new Error('Grid Alliance leader membership was not found');
  }

  const closedLeaderMembership = closeGridAllianceMembership(
    activeLeaderMembership,
    now,
    rules,
  );
  const persisted = await port.disbandAlliance({
    allianceId,
    seasonId,
    leaderPlayerId: playerId,
    expectedAllianceRevision: alliance.revision,
    expectedInfluencePool: alliance.influencePool,
    disbandedAt: closedLeaderMembership.leftAt!,
    cooldownUntil: closedLeaderMembership.cooldownUntil!,
    idempotencyKey,
  });
  if (!persisted) {
    throw new Error('Grid Alliance disband changed; reload before retrying');
  }
  return persisted;
}
