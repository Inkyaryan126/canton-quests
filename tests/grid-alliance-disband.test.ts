import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { GridAllianceRules } from '../lib/grid/core/alliance-types';
import type { GridAlliancePersistencePort } from '../lib/grid/server/alliance-persistence-port';
import { disbandGridAlliance } from '../lib/grid/server/alliance-persistence-service';

const rules: GridAllianceRules = {
  maxMembers: 6,
  leaveCooldownSeconds: 86_400,
  influencePoolCap: 600,
  baseUpkeepInfluencePerTick: 4,
  memberUpkeepInfluencePerTick: 2,
  disconnectedComponentUpkeepInfluencePerTick: 4,
  largeAllianceThreshold: 4,
  largeAllianceSurchargeInfluencePerMemberPerTick: 3,
};

const alliance = {
  allianceId: 'alliance-1', seasonId: 'season-1', slug: 'north-grid', name: 'North Grid',
  leaderPlayerId: 'leader-1', status: 'active' as const, influencePool: 240, revision: 9,
  createdAt: '2026-09-18T01:00:00.000Z', updatedAt: '2026-09-18T03:00:00.000Z', disbandedAt: null,
};
const leaderMembership = {
  playerId: 'leader-1', seasonId: 'season-1', allianceId: 'alliance-1',
  joinedAt: '2026-09-18T01:00:00.000Z', leftAt: null, cooldownUntil: null,
};

function port(overrides: Partial<GridAlliancePersistencePort> = {}): GridAlliancePersistencePort {
  return {
    getAllianceById: vi.fn().mockResolvedValue(alliance),
    listActiveAlliances: vi.fn().mockResolvedValue([alliance]),
    getMembershipHistory: vi.fn().mockResolvedValue([leaderMembership]),
    countActiveMembers: vi.fn().mockResolvedValue(3),
    createAllianceWithLeader: vi.fn(), joinAlliance: vi.fn(), leaveAlliance: vi.fn(),
    getPlayerInfluence: vi.fn().mockResolvedValue(100),
    getInfluenceContributionReplay: vi.fn().mockResolvedValue(null),
    applyInfluenceContribution: vi.fn(), getActiveMemberPlayerIds: vi.fn().mockResolvedValue([]),
    getAllianceNetworkInputs: vi.fn(), getUpkeepSettlementReplay: vi.fn().mockResolvedValue(null),
    applyUpkeepSettlement: vi.fn(),
    getDisbandReplay: vi.fn().mockResolvedValue(null),
    disbandAlliance: vi.fn().mockResolvedValue({
      allianceId: 'alliance-1', status: 'disbanded' as const,
      disbandedAt: '2026-09-18T04:00:00.000Z',
      cooldownUntil: '2026-09-19T04:00:00.000Z', closedMembershipCount: 3,
      influencePoolLocked: 240, allianceRevision: 10,
      eventId: 'event-disband-1', replayed: false,
    }),
    ...overrides,
  };
}

describe('GRID Alliance disband lifecycle', () => {
  it('lets only the leader atomically close the Alliance with the normal leave cooldown', async () => {
    const p = port();
    const result = await disbandGridAlliance(p, {
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'leader-1',
      idempotencyKey: 'alliance:disband:1', now: '2026-09-18T04:00:00.000Z',
    }, rules);

    expect(result).toMatchObject({
      status: 'disbanded', cooldownUntil: '2026-09-19T04:00:00.000Z',
      closedMembershipCount: 3, influencePoolLocked: 240, allianceRevision: 10,
    });
    expect(p.disbandAlliance).toHaveBeenCalledWith(expect.objectContaining({
      expectedAllianceRevision: 9, expectedInfluencePool: 240,
      cooldownUntil: '2026-09-19T04:00:00.000Z',
      idempotencyKey: 'alliance:disband:1',
    }));
  });

  it('rejects a non-leader before persistence mutation', async () => {
    const p = port();
    await expect(disbandGridAlliance(p, {
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'member-2',
      idempotencyKey: 'alliance:disband:2', now: '2026-09-18T04:00:00.000Z',
    }, rules)).rejects.toThrow('requires the Alliance leader');
    expect(p.disbandAlliance).not.toHaveBeenCalled();
  });

  it('replays a completed disband before reading mutable state', async () => {
    const replay = {
      allianceId: 'alliance-1', status: 'disbanded' as const,
      disbandedAt: '2026-09-18T04:00:00.000Z', cooldownUntil: '2026-09-19T04:00:00.000Z',
      closedMembershipCount: 3, influencePoolLocked: 240, allianceRevision: 10,
      eventId: 'event-disband-1', replayed: true,
    };
    const p = port({ getDisbandReplay: vi.fn().mockResolvedValue(replay) });
    await expect(disbandGridAlliance(p, {
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'leader-1',
      idempotencyKey: 'alliance:disband:1', now: '2026-09-18T04:05:00.000Z',
    }, rules)).resolves.toEqual(replay);
    expect(p.getAllianceById).not.toHaveBeenCalled();
    expect(p.disbandAlliance).not.toHaveBeenCalled();
  });

  it('fails closed when Alliance state changed before the atomic disband', async () => {
    const p = port({ disbandAlliance: vi.fn().mockResolvedValue(null) });
    await expect(disbandGridAlliance(p, {
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'leader-1',
      idempotencyKey: 'alliance:disband:3', now: '2026-09-18T04:00:00.000Z',
    }, rules)).rejects.toThrow('changed; reload before retrying');
  });
});

const migration = path.join(process.cwd(), 'supabase/migrations/20260918023000_grid_alliance_disband.sql');
describe('GRID Alliance disband persistence', () => {
  it('closes all active memberships, keeps pooled Influence stranded, and records an idempotent event', () => {
    const sql = fs.existsSync(migration) ? fs.readFileSync(migration, 'utf8').toLowerCase() : '';
    expect(sql).toContain('create or replace function public.grid_disband_alliance');
    expect(sql).toContain("status = 'disbanded'");
    expect(sql).toContain('update public.grid_alliance_memberships');
    expect(sql).toContain('cooldown_until = p_cooldown_until');
    expect(sql).toContain("'alliance_disbanded'");
    expect(sql).toContain("'influencepoollocked'");
    expect(sql).not.toMatch(/influence\s*=.*\+|credits\s*=|command_points\s*=/);
    expect(sql).toContain('to service_role');
  });
});
