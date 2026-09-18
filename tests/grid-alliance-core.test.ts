import { describe, expect, it } from 'vitest';
import {
  calculateGridAllianceUpkeep,
  contributeGridAllianceInfluence,
  evaluateGridAllianceJoin,
  leaveGridAlliance,
  projectGridAllianceNetwork,
  settleGridAllianceUpkeep,
  validateGridAllianceRules,
} from '../lib/grid/core/alliance';
import type {
  GridAllianceMembership,
  GridAllianceRules,
} from '../lib/grid/core/alliance-types';

const RULES: GridAllianceRules = {
  maxMembers: 12,
  leaveCooldownSeconds: 86_400,
  influencePoolCap: 500,
  baseUpkeepInfluencePerTick: 5,
  memberUpkeepInfluencePerTick: 2,
  disconnectedComponentUpkeepInfluencePerTick: 3,
  largeAllianceThreshold: 6,
  largeAllianceSurchargeInfluencePerMemberPerTick: 4,
};

function membership(
  overrides: Partial<GridAllianceMembership> = {},
): GridAllianceMembership {
  return {
    playerId: 'player-1',
    seasonId: 'season-1',
    allianceId: 'alliance-a',
    joinedAt: '2026-09-17T12:00:00.000Z',
    leftAt: null,
    cooldownUntil: null,
    ...overrides,
  };
}

describe('Grid Alliance membership', () => {
  it('allows a player with no active membership in this season to join', () => {
    expect(evaluateGridAllianceJoin({
      playerId: 'player-1',
      seasonId: 'season-1',
      allianceId: 'alliance-b',
      now: '2026-09-17T13:00:00.000Z',
      targetActiveMemberCount: 4,
      membershipHistory: [],
    }, RULES)).toEqual({ allowed: true, reason: null, cooldownUntil: null });
  });

  it('rejects a second active Alliance in the same season', () => {
    expect(evaluateGridAllianceJoin({
      playerId: 'player-1',
      seasonId: 'season-1',
      allianceId: 'alliance-b',
      now: '2026-09-17T13:00:00.000Z',
      targetActiveMemberCount: 4,
      membershipHistory: [membership()],
    }, RULES)).toMatchObject({
      allowed: false,
      reason: 'already-in-alliance',
    });
  });

  it('treats memberships from another season independently', () => {
    expect(evaluateGridAllianceJoin({
      playerId: 'player-1',
      seasonId: 'season-2',
      allianceId: 'alliance-b',
      now: '2026-10-17T13:00:00.000Z',
      targetActiveMemberCount: 4,
      membershipHistory: [membership()],
    }, RULES).allowed).toBe(true);
  });

  it('rejects joins when the target Alliance is full', () => {
    expect(evaluateGridAllianceJoin({
      playerId: 'player-2',
      seasonId: 'season-1',
      allianceId: 'alliance-b',
      now: '2026-09-17T13:00:00.000Z',
      targetActiveMemberCount: RULES.maxMembers,
      membershipHistory: [],
    }, RULES)).toMatchObject({
      allowed: false,
      reason: 'alliance-full',
    });
  });

  it('closes membership and starts a deterministic leave cooldown', () => {
    const left = leaveGridAlliance(
      membership(),
      '2026-09-17T14:00:00.000Z',
      RULES,
    );

    expect(left).toMatchObject({
      leftAt: '2026-09-17T14:00:00.000Z',
      cooldownUntil: '2026-09-18T14:00:00.000Z',
    });
  });

  it('blocks every join before cooldown expiry and allows the exact boundary', () => {
    const left = leaveGridAlliance(
      membership(),
      '2026-09-17T14:00:00.000Z',
      RULES,
    );
    const base = {
      playerId: 'player-1',
      seasonId: 'season-1',
      allianceId: 'alliance-a',
      targetActiveMemberCount: 4,
      membershipHistory: [left],
    };

    expect(evaluateGridAllianceJoin({
      ...base,
      allianceId: 'alliance-b',
      now: '2026-09-18T13:59:59.999Z',
    }, RULES)).toMatchObject({
      allowed: false,
      reason: 'cooldown-active',
      cooldownUntil: '2026-09-18T14:00:00.000Z',
    });

    expect(evaluateGridAllianceJoin({
      ...base,
      now: '2026-09-18T14:00:00.000Z',
    }, RULES).allowed).toBe(true);
  });

  it('rejects malformed rules and invalid lifecycle transitions', () => {
    expect(() => validateGridAllianceRules({ ...RULES, maxMembers: 0 }))
      .toThrow(/maxMembers/i);
    expect(() => validateGridAllianceRules({
      ...RULES,
      influencePoolCap: Number.MAX_SAFE_INTEGER + 1,
    })).toThrow(/influencePoolCap/i);
    expect(() => leaveGridAlliance(
      membership({ leftAt: '2026-09-17T13:00:00.000Z' }),
      '2026-09-17T14:00:00.000Z',
      RULES,
    )).toThrow(/active membership/i);
  });
});

describe('Grid Alliance Influence pool', () => {
  it('moves only requested Influence when player balance and pool capacity allow it', () => {
    expect(contributeGridAllianceInfluence({
      requestedInfluence: 80,
      playerInfluence: 100,
      poolInfluence: 100,
    }, RULES)).toEqual({
      acceptedInfluence: 80,
      playerInfluenceAfter: 20,
      poolInfluenceAfter: 180,
      constraints: [],
    });
  });

  it('cannot contribute more Influence than the player owns', () => {
    expect(contributeGridAllianceInfluence({
      requestedInfluence: 100,
      playerInfluence: 40,
      poolInfluence: 100,
    }, RULES)).toMatchObject({
      acceptedInfluence: 40,
      playerInfluenceAfter: 0,
      poolInfluenceAfter: 140,
      constraints: ['player-balance'],
    });
  });

  it('never exceeds the configured Alliance pool cap', () => {
    expect(contributeGridAllianceInfluence({
      requestedInfluence: 50,
      playerInfluence: 100,
      poolInfluence: 490,
    }, RULES)).toMatchObject({
      acceptedInfluence: 10,
      playerInfluenceAfter: 90,
      poolInfluenceAfter: 500,
      constraints: ['pool-capacity'],
    });
  });

  it('reports both constraints when balance and remaining capacity tie', () => {
    expect(contributeGridAllianceInfluence({
      requestedInfluence: 50,
      playerInfluence: 10,
      poolInfluence: 490,
    }, RULES)).toMatchObject({
      acceptedInfluence: 10,
      constraints: ['player-balance', 'pool-capacity'],
    });
  });

  it('rejects zero requests and impossible pool state', () => {
    expect(() => contributeGridAllianceInfluence({
      requestedInfluence: 0,
      playerInfluence: 100,
      poolInfluence: 0,
    }, RULES)).toThrow(/requestedInfluence/i);

    expect(() => contributeGridAllianceInfluence({
      requestedInfluence: 1,
      playerInfluence: 100,
      poolInfluence: RULES.influencePoolCap + 1,
    }, RULES)).toThrow(/poolInfluence/i);
  });
});

describe('Grid Alliance coordination upkeep', () => {
  it('charges base, member, fragmentation, and large-Alliance costs per tick', () => {
    expect(calculateGridAllianceUpkeep({
      activeMemberCount: 8,
      disconnectedComponentCount: 2,
      ticks: 3,
    }, RULES)).toEqual({
      ticks: 3,
      perTickInfluence: 35,
      totalInfluence: 105,
      breakdown: {
        baseInfluencePerTick: 5,
        memberInfluencePerTick: 16,
        disconnectedInfluencePerTick: 6,
        largeAllianceSurchargeInfluencePerTick: 8,
      },
    });
  });

  it('does not charge fragmentation or large-Alliance surcharge when absent', () => {
    expect(calculateGridAllianceUpkeep({
      activeMemberCount: 4,
      disconnectedComponentCount: 0,
      ticks: 1,
    }, RULES)).toMatchObject({
      perTickInfluence: 13,
      totalInfluence: 13,
    });
  });

  it('settles from the pool without creating debt', () => {
    expect(settleGridAllianceUpkeep({
      poolInfluence: 70,
      activeMemberCount: 8,
      disconnectedComponentCount: 2,
      ticks: 3,
    }, RULES)).toMatchObject({
      paidInfluence: 70,
      poolInfluenceAfter: 0,
      shortfallInfluence: 35,
      fullyPaid: false,
    });

    expect(settleGridAllianceUpkeep({
      poolInfluence: 200,
      activeMemberCount: 8,
      disconnectedComponentCount: 2,
      ticks: 3,
    }, RULES)).toMatchObject({
      paidInfluence: 105,
      poolInfluenceAfter: 95,
      shortfallInfluence: 0,
      fullyPaid: true,
    });
  });

  it('rejects unsafe upkeep arithmetic instead of rounding it', () => {
    expect(() => calculateGridAllianceUpkeep({
      activeMemberCount: 8,
      disconnectedComponentCount: 2,
      ticks: Number.MAX_SAFE_INTEGER,
    }, RULES)).toThrow(/safe integer/i);
  });
});

describe('Grid Alliance Network projection', () => {
  it('connects personally owned member territories across accepted adjacency', () => {
    expect(projectGridAllianceNetwork(
      ['player-1', 'player-2'],
      [
        { territorySlug: 'alpha', ownerPlayerId: 'player-1' },
        { territorySlug: 'bravo', ownerPlayerId: 'player-2' },
      ],
      [{ fromTerritorySlug: 'alpha', toTerritorySlug: 'bravo' }],
    )).toEqual({
      controlledTerritorySlugs: ['alpha', 'bravo'],
      components: [['alpha', 'bravo']],
      componentCount: 1,
      largestComponentSize: 2,
      isolatedTerritorySlugs: [],
      disconnectedComponentCount: 0,
    });
  });

  it('does not let non-member territory bridge Alliance components', () => {
    expect(projectGridAllianceNetwork(
      ['player-1', 'player-2'],
      [
        { territorySlug: 'alpha', ownerPlayerId: 'player-1' },
        { territorySlug: 'outsider', ownerPlayerId: 'player-x' },
        { territorySlug: 'bravo', ownerPlayerId: 'player-2' },
      ],
      [
        { fromTerritorySlug: 'alpha', toTerritorySlug: 'outsider' },
        { fromTerritorySlug: 'outsider', toTerritorySlug: 'bravo' },
      ],
    )).toEqual({
      controlledTerritorySlugs: ['alpha', 'bravo'],
      components: [['alpha'], ['bravo']],
      componentCount: 2,
      largestComponentSize: 1,
      isolatedTerritorySlugs: ['alpha', 'bravo'],
      disconnectedComponentCount: 1,
    });
  });

  it('is deterministic across reordered and duplicate inputs without mutating them', () => {
    const members = ['player-2', 'player-1', 'player-1'];
    const ownership = [
      { territorySlug: 'charlie', ownerPlayerId: 'player-2' },
      { territorySlug: 'alpha', ownerPlayerId: 'player-1' },
      { territorySlug: 'bravo', ownerPlayerId: 'player-1' },
    ];
    const edges = [
      { fromTerritorySlug: 'bravo', toTerritorySlug: 'charlie' },
      { fromTerritorySlug: 'alpha', toTerritorySlug: 'bravo' },
      { fromTerritorySlug: 'bravo', toTerritorySlug: 'alpha' },
    ];
    const before = JSON.stringify({ members, ownership, edges });

    const forward = projectGridAllianceNetwork(members, ownership, edges);
    const reversed = projectGridAllianceNetwork(
      [...members].reverse(),
      [...ownership].reverse(),
      [...edges].reverse(),
    );

    expect(forward).toEqual(reversed);
    expect(forward).toMatchObject({
      controlledTerritorySlugs: ['alpha', 'bravo', 'charlie'],
      components: [['alpha', 'bravo', 'charlie']],
      componentCount: 1,
      largestComponentSize: 3,
      disconnectedComponentCount: 0,
    });
    expect(JSON.stringify({ members, ownership, edges })).toBe(before);
  });

  it('rejects conflicting ownership claims for the same territory', () => {
    expect(() => projectGridAllianceNetwork(
      ['player-1', 'player-2'],
      [
        { territorySlug: 'alpha', ownerPlayerId: 'player-1' },
        { territorySlug: 'alpha', ownerPlayerId: 'player-2' },
      ],
      [],
    )).toThrow(/conflicting ownership/i);
  });
});
