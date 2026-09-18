import { describe, expect, it, vi } from 'vitest';
import type { GridDirectDealProposalCommandPort } from '../lib/grid/server/direct-deal-proposal-port';
import type { GridDirectDealMarketPort } from '../lib/grid/server/direct-deal-market-port';
import {
  acceptGridPlayerDirectDeal,
  createGridPlayerDirectDeal,
  listGridDirectDeals,
} from '../lib/grid/server/direct-deal-market-service';
import { cantonFoundingSeasonPackage as pkg } from '../lib/grid/cities/canton/founding-season';

const now = '2026-09-18T07:00:00.000Z';
const later = '2026-09-19T07:00:00.000Z';
const property = pkg.properties[0];

function commandPort(): GridDirectDealProposalCommandPort {
  return {
    createProposal: vi.fn().mockResolvedValue({
      proposalId: 'direct:create-1',
      seasonId: 'season-1',
      cityId: 'city-1',
      proposerPlayerId: 'player-a',
      counterpartyPlayerId: 'player-b',
      proposerCredits: 100,
      counterpartyCredits: 250,
      proposerPropertyIds: ['property-id-1'],
      counterpartyPropertyIds: [],
      transactionTaxBps: 500,
      propertyTradeCooldownMinutes: 60,
      maxAssetsPerSide: 4,
      createdAt: now,
      expiresAt: later,
      status: 'open',
      eventId: 'event-create',
    }),
    cancelProposal: vi.fn(),
    acceptProposal: vi.fn().mockResolvedValue({
      proposalId: 'deal-1',
      seasonId: 'season-1',
      status: 'accepted',
      acceptedAt: now,
      settlement: {
        transactionId: 'direct-deal:accept-1',
        seasonId: 'season-1',
        cityId: 'city-1',
        source: 'direct-deal',
        sourceId: 'deal-1',
        occurredAt: now,
        participantIds: ['player-a', 'player-b'],
        creditsAfter: { 'player-a': 1140, 'player-b': 855 },
        propertyOwnerPlayerIds: {},
        totalTaxCredits: 5,
        eventId: 'event-settle',
      },
      eventId: 'event-accept',
    }),
  };
}

function marketPort(overrides: Partial<GridDirectDealMarketPort> = {}): GridDirectDealMarketPort {
  return {
    getContext: vi.fn().mockResolvedValue({
      cityId: 'city-1',
      seasonId: 'season-1',
      seasonStatus: 'active',
    }),
    resolvePlayerByCallsign: vi.fn().mockResolvedValue({
      playerId: 'player-b',
      callsign: 'BRAVO',
    }),
    resolvePropertyIds: vi.fn().mockResolvedValue([
      { propertySlug: property.slug, propertyId: 'property-id-1' },
    ]),
    listOpenProposals: vi.fn().mockResolvedValue([]),
    readProposal: vi.fn().mockResolvedValue(null),
    readPlayerLabels: vi.fn().mockResolvedValue([]),
    readPlayerStates: vi.fn().mockResolvedValue([]),
    readProperties: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('Grid Direct Deal player market service', () => {
  it('creates a proposal from callsign and property slug without client authority ids', async () => {
    const market = marketPort();
    const commands = commandPort();

    const result = await createGridPlayerDirectDeal(market, commands, {
      proposerPlayerId: 'player-a',
      counterpartyCallsign: ' BRAVO ',
      proposerCredits: 100,
      counterpartyCredits: 250,
      proposerPropertySlugs: [property.slug],
      durationMinutes: 1440,
      idempotencyKey: 'create-1',
      now,
    });

    expect(market.resolvePlayerByCallsign).toHaveBeenCalledWith('BRAVO');
    expect(market.resolvePropertyIds).toHaveBeenCalledWith([property.slug]);
    expect(commands.createProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonId: 'season-1',
        proposalId: 'direct:create-1',
        proposerPlayerId: 'player-a',
        counterpartyPlayerId: 'player-b',
        proposerPropertyIds: ['property-id-1'],
        counterpartyPropertyIds: [],
        transactionTaxBps: 500,
        propertyTradeCooldownMinutes: 60,
        maxAssetsPerSide: 4,
        idempotencyKey: 'create-1',
      }),
    );
    expect(result).not.toHaveProperty('counterpartyPlayerId');
    expect(result).not.toHaveProperty('seasonId');
    expect(result).not.toHaveProperty('propertyId');
  });

  it('sanitizes proposal inbox/outbox to callsign and viewer-relative terms', async () => {
    const market = marketPort({
      listOpenProposals: vi.fn().mockResolvedValue([
        {
          proposalId: 'deal-1',
          seasonId: 'season-1',
          cityId: 'city-1',
          proposerPlayerId: 'player-a',
          counterpartyPlayerId: 'player-b',
          proposerCredits: 100,
          counterpartyCredits: 250,
          proposerPropertyIds: ['property-id-1'],
          counterpartyPropertyIds: [],
          transactionTaxBps: 500,
          propertyTradeCooldownMinutes: 60,
          maxAssetsPerSide: 4,
          createdAt: now,
          expiresAt: later,
          status: 'open',
        },
      ]),
      readPlayerLabels: vi.fn().mockResolvedValue([
        { playerId: 'player-a', callsign: 'ALPHA' },
        { playerId: 'player-b', callsign: 'BRAVO' },
      ]),
      readProperties: vi.fn().mockResolvedValue([
        {
          propertyId: 'property-id-1',
          propertySlug: property.slug,
          baseValueCredits: 1000,
          tradable: true,
          majorLandmark: false,
          ownerPlayerId: 'player-a',
          acquiredAt: '2026-09-18T05:00:00.000Z',
        },
      ]),
    });

    const deals = await listGridDirectDeals(market, pkg, 'player-b', now);

    expect(deals).toEqual([
      expect.objectContaining({
        proposalId: 'deal-1',
        role: 'received',
        counterpartyCallsign: 'ALPHA',
        yourCredits: 250,
        theirCredits: 100,
        yourProperties: [],
        theirProperties: [
          { slug: property.slug, name: property.publicNameSafe ? property.name : 'Grid Property' },
        ],
      }),
    ]);
    expect(JSON.stringify(deals)).not.toContain('player-a');
    expect(JSON.stringify(deals)).not.toContain('player-b');
    expect(JSON.stringify(deals)).not.toContain('property-id-1');
  });

  it('rebuilds a canonical transaction from current server state before acceptance', async () => {
    const stored = {
      proposalId: 'deal-1',
      seasonId: 'season-1',
      cityId: 'city-1',
      proposerPlayerId: 'player-a',
      counterpartyPlayerId: 'player-b',
      proposerCredits: 100,
      counterpartyCredits: 0,
      proposerPropertyIds: [],
      counterpartyPropertyIds: [],
      transactionTaxBps: 500,
      propertyTradeCooldownMinutes: 60,
      maxAssetsPerSide: 4,
      createdAt: '2026-09-18T06:00:00.000Z',
      expiresAt: later,
      status: 'open' as const,
    };
    const market = marketPort({
      readProposal: vi.fn().mockResolvedValue(stored),
      readPlayerStates: vi.fn().mockResolvedValue([
        { playerId: 'player-a', credits: 1000 },
        { playerId: 'player-b', credits: 1000 },
      ]),
      readProperties: vi.fn().mockResolvedValue([]),
    });
    const commands = commandPort();

    const result = await acceptGridPlayerDirectDeal(market, commands, {
      playerId: 'player-b',
      proposalId: 'deal-1',
      idempotencyKey: 'accept-1',
      now,
    });

    expect(commands.acceptProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonId: 'season-1',
        proposalId: 'deal-1',
        acceptingPlayerId: 'player-b',
        idempotencyKey: 'accept-1',
        transaction: expect.objectContaining({
          transactionId: 'direct-deal:accept-1',
          source: 'direct-deal',
          sourceId: 'deal-1',
          participantIds: ['player-a', 'player-b'],
          creditTransfers: [
            {
              fromPlayerId: 'player-a',
              toPlayerId: 'player-b',
              amountCredits: 100,
            },
          ],
        }),
      }),
    );
    expect(result).toEqual({
      proposalId: 'deal-1',
      status: 'accepted',
      acceptedAt: now,
      transactionId: 'direct-deal:accept-1',
    });
  });

  it('rejects acceptance by anyone except the named counterparty', async () => {
    const market = marketPort({
      readProposal: vi.fn().mockResolvedValue({
        proposalId: 'deal-1',
        seasonId: 'season-1',
        cityId: 'city-1',
        proposerPlayerId: 'player-a',
        counterpartyPlayerId: 'player-b',
        proposerCredits: 100,
        counterpartyCredits: 0,
        proposerPropertyIds: [],
        counterpartyPropertyIds: [],
        transactionTaxBps: 500,
        propertyTradeCooldownMinutes: 60,
        maxAssetsPerSide: 4,
        createdAt: now,
        expiresAt: later,
        status: 'open',
      }),
    });
    const commands = commandPort();

    await expect(
      acceptGridPlayerDirectDeal(market, commands, {
        playerId: 'player-c',
        proposalId: 'deal-1',
        idempotencyKey: 'accept-bad',
        now,
      }),
    ).rejects.toThrow('named Direct Deal counterparty');
    expect(commands.acceptProposal).not.toHaveBeenCalled();
  });
});
