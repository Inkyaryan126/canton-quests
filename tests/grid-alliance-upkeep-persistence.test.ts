import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { GridAllianceRules } from '../lib/grid/core/alliance-types';
import type { GridAlliancePersistencePort } from '../lib/grid/server/alliance-persistence-port';
import { settlePersistentGridAllianceUpkeep } from '../lib/grid/server/alliance-persistence-service';

const rules: GridAllianceRules = {
  maxMembers: 6,
  leaveCooldownSeconds: 3600,
  influencePoolCap: 500,
  baseUpkeepInfluencePerTick: 5,
  memberUpkeepInfluencePerTick: 2,
  disconnectedComponentUpkeepInfluencePerTick: 3,
  largeAllianceThreshold: 3,
  largeAllianceSurchargeInfluencePerMemberPerTick: 4,
};

const alliance = {
  allianceId: 'alliance-1',
  seasonId: 'season-1',
  slug: 'north-grid',
  name: 'North Grid',
  leaderPlayerId: 'leader-1',
  status: 'active' as const,
  influencePool: 40,
  revision: 8,
  createdAt: '2026-09-18T03:00:00.000Z',
  updatedAt: '2026-09-18T03:00:00.000Z',
  disbandedAt: null,
};

const members = ['leader-1', 'player-2', 'player-3', 'player-4'];
const networkInputs = {
  territoryOwnership: [
    { territorySlug: 'alpha', ownerPlayerId: 'leader-1' },
    { territorySlug: 'bravo', ownerPlayerId: 'player-2' },
    { territorySlug: 'charlie', ownerPlayerId: 'player-3' },
  ],
  adjacencyEdges: [
    { fromTerritorySlug: 'alpha', toTerritorySlug: 'bravo' },
  ],
};

function port(
  overrides: Partial<GridAlliancePersistencePort> = {},
): GridAlliancePersistencePort {
  return {
    getAllianceById: vi.fn().mockResolvedValue(alliance),
    listActiveAlliances: vi.fn().mockResolvedValue([]),
    getMembershipHistory: vi.fn().mockResolvedValue([]),
    countActiveMembers: vi.fn().mockResolvedValue(members.length),
    createAllianceWithLeader: vi.fn(),
    joinAlliance: vi.fn(),
    leaveAlliance: vi.fn(),
    getPlayerInfluence: vi.fn().mockResolvedValue(0),
    getInfluenceContributionReplay: vi.fn().mockResolvedValue(null),
    applyInfluenceContribution: vi.fn(),
    getActiveMemberPlayerIds: vi.fn().mockResolvedValue(members),
    getAllianceNetworkInputs: vi.fn().mockResolvedValue(networkInputs),
    getUpkeepSettlementReplay: vi.fn().mockResolvedValue(null),
    applyUpkeepSettlement: vi.fn().mockResolvedValue({
      ticks: 2,
      activeMemberCount: 4,
      disconnectedComponentCount: 1,
      perTickInfluence: 20,
      totalInfluence: 40,
      paidInfluence: 40,
      poolInfluenceAfter: 0,
      shortfallInfluence: 0,
      fullyPaid: true,
      breakdown: {
        baseInfluencePerTick: 5,
        memberInfluencePerTick: 8,
        disconnectedInfluencePerTick: 3,
        largeAllianceSurchargeInfluencePerTick: 4,
      },
      allianceRevision: 9,
      eventId: 'event-upkeep-1',
      replayed: false,
    }),
    getDisbandReplay: vi.fn().mockResolvedValue(null),
    disbandAlliance: vi.fn(),
    ...overrides,
  };
}

describe('GRID Alliance persistent coordination upkeep', () => {
  it('derives live Alliance fragmentation and persists the exact core settlement', async () => {
    const p = port();
    const result = await settlePersistentGridAllianceUpkeep(
      p,
      {
        allianceId: 'alliance-1',
        seasonId: 'season-1',
        ticks: 2,
        idempotencyKey: 'alliance:upkeep:season-1:tick-44',
        now: '2026-09-18T04:10:00.000Z',
      },
      rules,
    );

    expect(result).toMatchObject({
      totalInfluence: 40,
      paidInfluence: 40,
      poolInfluenceAfter: 0,
      shortfallInfluence: 0,
      fullyPaid: true,
      allianceRevision: 9,
      eventId: 'event-upkeep-1',
    });
    expect(p.getAllianceNetworkInputs).toHaveBeenCalledWith('season-1', members);
    expect(p.applyUpkeepSettlement).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedAllianceRevision: 8,
        expectedPoolInfluence: 40,
        ticks: 2,
        activeMemberCount: 4,
        disconnectedComponentCount: 1,
        perTickInfluence: 20,
        totalInfluence: 40,
        paidInfluence: 40,
        poolInfluenceAfter: 0,
        shortfallInfluence: 0,
        fullyPaid: true,
        idempotencyKey: 'alliance:upkeep:season-1:tick-44',
      }),
    );
  });

  it('records deterministic shortfall without allowing the pool to go negative', async () => {
    const p = port({
      getAllianceById: vi.fn().mockResolvedValue({ ...alliance, influencePool: 10 }),
      applyUpkeepSettlement: vi.fn().mockResolvedValue({
        ticks: 2,
        activeMemberCount: 4,
        disconnectedComponentCount: 1,
        perTickInfluence: 20,
        totalInfluence: 40,
        paidInfluence: 10,
        poolInfluenceAfter: 0,
        shortfallInfluence: 30,
        fullyPaid: false,
        breakdown: {
          baseInfluencePerTick: 5,
          memberInfluencePerTick: 8,
          disconnectedInfluencePerTick: 3,
          largeAllianceSurchargeInfluencePerTick: 4,
        },
        allianceRevision: 9,
        eventId: 'event-upkeep-2',
        replayed: false,
      }),
    });

    const result = await settlePersistentGridAllianceUpkeep(
      p,
      {
        allianceId: 'alliance-1',
        seasonId: 'season-1',
        ticks: 2,
        idempotencyKey: 'alliance:upkeep:season-1:tick-45',
        now: '2026-09-18T04:10:00.000Z',
      },
      rules,
    );

    expect(result).toMatchObject({
      totalInfluence: 40,
      paidInfluence: 10,
      poolInfluenceAfter: 0,
      shortfallInfluence: 30,
      fullyPaid: false,
    });
  });

  it('replays a recorded upkeep tick before reading mutable Alliance state', async () => {
    const replay = {
      ticks: 1,
      activeMemberCount: 4,
      disconnectedComponentCount: 0,
      perTickInfluence: 17,
      totalInfluence: 17,
      paidInfluence: 17,
      poolInfluenceAfter: 23,
      shortfallInfluence: 0,
      fullyPaid: true,
      breakdown: {
        baseInfluencePerTick: 5,
        memberInfluencePerTick: 8,
        disconnectedInfluencePerTick: 0,
        largeAllianceSurchargeInfluencePerTick: 4,
      },
      allianceRevision: 9,
      eventId: 'event-upkeep-replay',
      replayed: true,
    };
    const p = port({ getUpkeepSettlementReplay: vi.fn().mockResolvedValue(replay) });

    const result = await settlePersistentGridAllianceUpkeep(
      p,
      {
        allianceId: 'alliance-1',
        seasonId: 'season-1',
        ticks: 1,
        idempotencyKey: 'alliance:upkeep:season-1:tick-43',
        now: '2026-09-18T04:10:00.000Z',
      },
      rules,
    );

    expect(result).toMatchObject({ eventId: 'event-upkeep-replay', replayed: true });
    expect(p.getAllianceById).not.toHaveBeenCalled();
    expect(p.getActiveMemberPlayerIds).not.toHaveBeenCalled();
    expect(p.applyUpkeepSettlement).not.toHaveBeenCalled();
  });

  it('fails closed if Alliance state changed before the atomic settlement', async () => {
    const p = port({ applyUpkeepSettlement: vi.fn().mockResolvedValue(null) });
    await expect(
      settlePersistentGridAllianceUpkeep(
        p,
        {
          allianceId: 'alliance-1',
          seasonId: 'season-1',
          ticks: 1,
          idempotencyKey: 'alliance:upkeep:season-1:tick-46',
          now: '2026-09-18T04:10:00.000Z',
        },
        rules,
      ),
    ).rejects.toThrow('changed; reload before retrying');
  });
});

const upkeepMigration = path.join(
  process.cwd(),
  'supabase/migrations/20260918020000_grid_alliance_upkeep_settlement.sql',
);

describe('GRID Alliance upkeep settlement schema', () => {
  it('settles pooled Influence through a locked idempotent service-role RPC', () => {
    const sql = fs.existsSync(upkeepMigration)
      ? fs.readFileSync(upkeepMigration, 'utf8').toLowerCase()
      : '';
    expect(sql).toContain('create or replace function public.grid_settle_alliance_upkeep');
    expect(sql).toContain('from public.grid_alliances');
    expect(sql).toContain('for update');
    expect(sql).toContain('idempotency_key');
    expect(sql).toContain("'alliance_upkeep_settlement'");
    expect(sql).toContain('influence_pool = p_pool_influence_after');
    expect(sql).toContain('revision = revision + 1');
    expect(sql).not.toMatch(/credits\s*=|command_points\s*=/);
    expect(sql).toContain('to service_role');
  });
});
