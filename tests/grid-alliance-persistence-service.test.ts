import { describe, expect, it, vi } from 'vitest';
import type { GridAllianceRules } from '../lib/grid/core/alliance-types';
import type {
  GridAlliancePersistencePort,
  GridAllianceState,
} from '../lib/grid/server/alliance-persistence-port';
import {
  createGridAlliance,
  joinGridAlliance,
  leaveGridAllianceMembership,
} from '../lib/grid/server/alliance-persistence-service';

const rules: GridAllianceRules = {
  maxMembers: 4,
  leaveCooldownSeconds: 3600,
  influencePoolCap: 500,
  baseUpkeepInfluencePerTick: 5,
  memberUpkeepInfluencePerTick: 2,
  disconnectedComponentUpkeepInfluencePerTick: 3,
  largeAllianceThreshold: 3,
  largeAllianceSurchargeInfluencePerMemberPerTick: 4,
};

const alliance: GridAllianceState = {
  allianceId: 'alliance-1',
  seasonId: 'season-1',
  slug: 'north-grid',
  name: 'North Grid',
  leaderPlayerId: 'leader-1',
  status: 'active',
  influencePool: 0,
  revision: 0,
  createdAt: '2026-09-18T03:00:00.000Z',
  updatedAt: '2026-09-18T03:00:00.000Z',
  disbandedAt: null,
};

function port(overrides: Partial<GridAlliancePersistencePort> = {}): GridAlliancePersistencePort {
  return {
    getAllianceById: vi.fn().mockResolvedValue(alliance),
    getMembershipHistory: vi.fn().mockResolvedValue([]),
    countActiveMembers: vi.fn().mockResolvedValue(1),
    createAllianceWithLeader: vi.fn().mockResolvedValue({ alliance, membership: {
      playerId: 'leader-1', seasonId: 'season-1', allianceId: 'alliance-1',
      joinedAt: alliance.createdAt, leftAt: null, cooldownUntil: null,
    }}),
    joinAlliance: vi.fn().mockImplementation(async (command) => ({
      playerId: command.playerId,
      seasonId: command.seasonId,
      allianceId: command.allianceId,
      joinedAt: command.joinedAt,
      leftAt: null,
      cooldownUntil: null,
    })),
    leaveAlliance: vi.fn().mockImplementation(async (command) => ({
      playerId: command.playerId,
      seasonId: command.seasonId,
      allianceId: command.allianceId,
      joinedAt: '2026-09-18T03:00:00.000Z',
      leftAt: command.leftAt,
      cooldownUntil: command.cooldownUntil,
    })),
    ...overrides,
  };
}

describe('GRID Alliance persistence service', () => {
  it('creates an Alliance only when the leader passes the same join rules', async () => {
    const p = port();
    const result = await createGridAlliance(p, {
      allianceId: 'alliance-1',
      seasonId: 'season-1',
      leaderPlayerId: 'leader-1',
      slug: ' north-grid ',
      name: ' North Grid ',
      now: alliance.createdAt,
    }, rules);

    expect(result.alliance.slug).toBe('north-grid');
    expect(p.createAllianceWithLeader).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'north-grid', name: 'North Grid', leaderPlayerId: 'leader-1',
    }));
  });

  it('denies a join during cooldown before persistence is called', async () => {
    const p = port({
      getMembershipHistory: vi.fn().mockResolvedValue([{
        playerId: 'player-2', seasonId: 'season-1', allianceId: 'old-alliance',
        joinedAt: '2026-09-18T01:00:00.000Z',
        leftAt: '2026-09-18T02:30:00.000Z',
        cooldownUntil: '2026-09-18T03:30:00.000Z',
      }]),
    });

    const result = await joinGridAlliance(p, {
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'player-2',
      now: '2026-09-18T03:00:00.000Z',
    }, rules);

    expect(result).toMatchObject({ joined: false, reason: 'cooldown-active' });
    expect(p.joinAlliance).not.toHaveBeenCalled();
  });

  it('uses the configured capacity and persists an allowed join', async () => {
    const p = port({ countActiveMembers: vi.fn().mockResolvedValue(3) });
    const result = await joinGridAlliance(p, {
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'player-2',
      now: '2026-09-18T03:00:00.000Z',
    }, rules);

    expect(result.joined).toBe(true);
    expect(p.joinAlliance).toHaveBeenCalledWith(expect.objectContaining({ maxMembers: 4 }));
  });

  it('closes a membership with the pure-core cooldown and blocks leader self-leave', async () => {
    const member = {
      playerId: 'player-2', seasonId: 'season-1', allianceId: 'alliance-1',
      joinedAt: '2026-09-18T01:00:00.000Z', leftAt: null, cooldownUntil: null,
    };
    const p = port({ getMembershipHistory: vi.fn().mockResolvedValue([member]) });

    const left = await leaveGridAllianceMembership(p, {
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'player-2',
      now: '2026-09-18T03:00:00.000Z',
    }, rules);

    expect(left.cooldownUntil).toBe('2026-09-18T04:00:00.000Z');
    expect(p.leaveAlliance).toHaveBeenCalledWith(expect.objectContaining({
      cooldownUntil: '2026-09-18T04:00:00.000Z',
    }));

    await expect(leaveGridAllianceMembership(port({
      getMembershipHistory: vi.fn().mockResolvedValue([{
        ...member, playerId: 'leader-1',
      }]),
    }), {
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'leader-1',
      now: '2026-09-18T03:00:00.000Z',
    }, rules)).rejects.toThrow('leader must transfer leadership or disband');
  });
});
