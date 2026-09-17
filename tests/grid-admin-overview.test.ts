import { describe, expect, it } from 'vitest';
import {
  buildGridAdminOverview,
  type GridAdminOverviewInput,
} from '../lib/grid/server/grid-admin-overview';

const input: GridAdminOverviewInput = {
  generatedAt: '2026-09-17T12:00:00.000Z',
  season: {
    cityName: 'Canton', seasonName: 'Founding Season', status: 'active',
    startsAt: '2026-09-11T18:00:00.000Z', surgeStartsAt: '2026-09-14T18:00:00.000Z',
    endsAt: '2026-09-15T18:00:00.000Z',
  },
  players: [{
    playerId: 'private-player-id', displayName: 'Cipher Fox', level: 4, totalXp: 900,
    credits: 4200, influence: 80, commandPoints: 6, lastActiveAt: '2026-09-17T11:00:00.000Z',
  }],
  territories: [{ slug: 'downtown', name: 'Downtown', districtName: 'Core', ownerDisplayName: 'Cipher Fox', status: 'occupied' }],
  properties: [{ slug: 'old-bank', name: 'Old Bank', territoryName: 'Downtown', ownerDisplayName: null, status: 'neutral', developmentLevel: 0, conditionBps: 10000 }],
  activeContests: [{ contestId: 'private-contest-id', sourceTerritoryName: 'Downtown', targetTerritoryName: 'Market', status: 'active', startedAt: '2026-09-17T10:00:00.000Z' }],
  auctions: [{ auctionId: 'private-auction-id', propertyName: 'Old Bank', status: 'open', endsAt: '2026-09-18T10:00:00.000Z', leadingBidCredits: 300 }],
  marketTransactions: [{ propertyName: 'Rail Depot', priceCredits: 250, transactedAt: '2026-09-17T09:00:00.000Z' }],
  strongholds: [{ strongholdName: 'The Foundry', factionName: 'Ash Wardens', status: 'active', garrisonInfluence: 40 }],
  dynamicEvents: [{ kind: 'influence-surge', status: 'active', startsAt: '2026-09-17T08:00:00.000Z', endsAt: '2026-09-17T14:00:00.000Z' }],
  activity: [{ eventType: 'grid:property_acquired', entityType: 'property', actorDisplayName: 'Cipher Fox', createdAt: '2026-09-17T11:00:00.000Z' }],
};

describe('Grid admin overview projection', () => {
  it('returns an operator-safe projection without internal identifiers or payloads', () => {
    const result = buildGridAdminOverview(input);
    const serialized = JSON.stringify(result);

    expect(result.players[0]).toMatchObject({ displayName: 'Cipher Fox', credits: 4200 });
    expect(result.counts).toEqual({ players: 1, occupiedTerritories: 1, occupiedProperties: 0, activeContests: 1, activeAuctions: 1 });
    expect(serialized).not.toContain('private-player-id');
    expect(serialized).not.toContain('private-contest-id');
    expect(serialized).not.toContain('private-auction-id');
    expect(serialized).not.toContain('actor_player_id');
  });

  it('does not invent replay links when no safe admin replay route exists', () => {
    const result = buildGridAdminOverview({ ...input, activeContests: [] });
    expect(result.activeContests).toEqual([]);
  });
});

