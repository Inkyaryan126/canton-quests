import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { GridAllianceRules } from '../lib/grid/core/alliance-types';
import type { GridAlliancePersistencePort } from '../lib/grid/server/alliance-persistence-port';
import { contributePersistentGridAllianceInfluence } from '../lib/grid/server/alliance-persistence-service';

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

const alliance = {
  allianceId: 'alliance-1', seasonId: 'season-1', slug: 'north-grid', name: 'North Grid',
  leaderPlayerId: 'leader-1', status: 'active' as const, influencePool: 480, revision: 7,
  createdAt: '2026-09-18T03:00:00.000Z', updatedAt: '2026-09-18T03:00:00.000Z', disbandedAt: null,
};
const membership = {
  playerId: 'player-2', seasonId: 'season-1', allianceId: 'alliance-1',
  joinedAt: '2026-09-18T03:00:00.000Z', leftAt: null, cooldownUntil: null,
};

function port(overrides: Partial<GridAlliancePersistencePort> = {}): GridAlliancePersistencePort {
  return {
    getAllianceById: vi.fn().mockResolvedValue(alliance),
    listActiveAlliances: vi.fn().mockResolvedValue([]),
    getMembershipHistory: vi.fn().mockResolvedValue([membership]),
    countActiveMembers: vi.fn().mockResolvedValue(2),
    createAllianceWithLeader: vi.fn(),
    joinAlliance: vi.fn(),
    leaveAlliance: vi.fn(),
    getPlayerInfluence: vi.fn().mockResolvedValue(90),
    getInfluenceContributionReplay: vi.fn().mockResolvedValue(null),
    applyInfluenceContribution: vi.fn().mockResolvedValue({
      acceptedInfluence: 20,
      playerInfluenceAfter: 70,
      poolInfluenceAfter: 500,
      allianceRevision: 8,
      constraints: ['pool-capacity'],
      eventId: 'event-1',
      replayed: false,
    }),
    getActiveMemberPlayerIds: vi.fn().mockResolvedValue([]),
    getAllianceNetworkInputs: vi.fn().mockResolvedValue({
      territoryOwnership: [],
      adjacencyEdges: [],
    }),
    getUpkeepSettlementReplay: vi.fn().mockResolvedValue(null),
    applyUpkeepSettlement: vi.fn(),
    ...overrides,
  };
}

describe('GRID Alliance persistent Influence contribution', () => {
  it('uses pure-core bounds then applies the exact result with optimistic expectations', async () => {
    const p = port();
    const result = await contributePersistentGridAllianceInfluence(p, {
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'player-2',
      requestedInfluence: 50, idempotencyKey: 'alliance:contribute:1',
      now: '2026-09-18T04:00:00.000Z',
    }, rules);

    expect(result).toMatchObject({
      acceptedInfluence: 20, playerInfluenceAfter: 70, poolInfluenceAfter: 500,
      constraints: ['pool-capacity'], allianceRevision: 8, eventId: 'event-1',
    });
    expect(p.applyInfluenceContribution).toHaveBeenCalledWith(expect.objectContaining({
      expectedAllianceRevision: 7,
      expectedPlayerInfluence: 90,
      acceptedInfluence: 20,
      playerInfluenceAfter: 70,
      poolInfluenceAfter: 500,
      poolCap: 500,
      idempotencyKey: 'alliance:contribute:1',
    }));
  });

  it('rejects non-members before moving personal Influence', async () => {
    const p = port({ getMembershipHistory: vi.fn().mockResolvedValue([]) });
    await expect(contributePersistentGridAllianceInfluence(p, {
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'outsider',
      requestedInfluence: 10, idempotencyKey: 'alliance:contribute:2',
      now: '2026-09-18T04:00:00.000Z',
    }, rules)).rejects.toThrow('active membership');
    expect(p.applyInfluenceContribution).not.toHaveBeenCalled();
  });

  it('replays an already-recorded contribution before reading mutable balances', async () => {
    const replay = {
      acceptedInfluence: 20,
      playerInfluenceAfter: 70,
      poolInfluenceAfter: 500,
      allianceRevision: 8,
      constraints: ['pool-capacity'] as const,
      eventId: 'event-1',
      replayed: true,
    };
    const p = port({
      getInfluenceContributionReplay: vi.fn().mockResolvedValue(replay),
    });
    const result = await contributePersistentGridAllianceInfluence(p, {
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'player-2',
      requestedInfluence: 50, idempotencyKey: 'alliance:contribute:1',
      now: '2026-09-18T04:00:00.000Z',
    }, rules);
    expect(result).toMatchObject({ eventId: 'event-1', replayed: true, persisted: true });
    expect(p.getAllianceById).not.toHaveBeenCalled();
    expect(p.applyInfluenceContribution).not.toHaveBeenCalled();
  });

  it('does not write when the core accepts zero Influence', async () => {
    const p = port({ getPlayerInfluence: vi.fn().mockResolvedValue(0) });
    const result = await contributePersistentGridAllianceInfluence(p, {
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'player-2',
      requestedInfluence: 10, idempotencyKey: 'alliance:contribute:3',
      now: '2026-09-18T04:00:00.000Z',
    }, rules);
    expect(result.acceptedInfluence).toBe(0);
    expect(result.persisted).toBe(false);
    expect(p.applyInfluenceContribution).not.toHaveBeenCalled();
  });

  it('fails closed when optimistic state changed before the atomic write', async () => {
    const p = port({ applyInfluenceContribution: vi.fn().mockResolvedValue(null) });
    await expect(contributePersistentGridAllianceInfluence(p, {
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'player-2',
      requestedInfluence: 10, idempotencyKey: 'alliance:contribute:4',
      now: '2026-09-18T04:00:00.000Z',
    }, rules)).rejects.toThrow('changed; reload before retrying');
  });
});

const contributionMigration = path.join(
  process.cwd(), 'supabase/migrations/20260918013000_grid_alliance_influence_contribution.sql',
);

describe('GRID Alliance Influence contribution schema', () => {
  it('moves only Influence through a locked service-role RPC with event idempotency', () => {
    const sql = fs.existsSync(contributionMigration)
      ? fs.readFileSync(contributionMigration, 'utf8').toLowerCase()
      : '';
    expect(sql).toContain('create or replace function public.grid_apply_alliance_influence_contribution');
    expect(sql).toContain('from public.grid_alliances');
    expect(sql).toContain('from public.grid_player_season_state');
    expect(sql).toContain('for update');
    expect(sql).toContain('grid_alliance_memberships');
    expect(sql).toContain('idempotency_key');
    expect(sql).toContain("'alliance_influence_contribution'");
    expect(sql).toContain('influence = p_player_influence_after');
    expect(sql).toContain('influence_pool = p_pool_influence_after');
    expect(sql).not.toMatch(/credits\s*=|command_points\s*=/);
    expect(sql).toContain('to service_role');
  });
});
