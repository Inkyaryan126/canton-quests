import {
  evaluateGridAllianceJoin,
  leaveGridAlliance as closeGridAllianceMembership,
  validateGridAllianceRules,
} from '../core/alliance';
import type {
  GridAllianceJoinDenialReason,
  GridAllianceMembership,
  GridAllianceRules,
} from '../core/alliance-types';
import type {
  GridAlliancePersistencePort,
  GridAllianceState,
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
