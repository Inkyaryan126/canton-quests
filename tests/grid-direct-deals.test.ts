import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calculateGridDirectDealTax,
  planGridDirectDealSettlement,
  validateGridDirectDealRules,
} from '../lib/grid/core/direct-deals';
import type {
  GridDirectDealAssetSnapshot,
  GridDirectDealProposal,
  GridDirectDealRules,
} from '../lib/grid/core/direct-deal-types';

const rules: GridDirectDealRules = {
  transactionTaxBps: 500,
  propertyTradeCooldownMinutes: 60,
  maxAssetsPerSide: 4,
};

const proposal = (
  overrides: Partial<GridDirectDealProposal> = {},
): GridDirectDealProposal => ({
  cityId: 'canton',
  proposer: {
    playerId: 'seller',
    cityId: 'canton',
    creditBalance: 500,
    offeredCredits: 0,
    offeredAssetIds: ['property-1'],
  },
  counterparty: {
    playerId: 'buyer',
    cityId: 'canton',
    creditBalance: 2_000,
    offeredCredits: 1_000,
    offeredAssetIds: [],
  },
  createdAt: '2026-09-16T20:00:00.000Z',
  expiresAt: '2026-09-16T22:00:00.000Z',
  ...overrides,
});

const property = (
  overrides: Partial<GridDirectDealAssetSnapshot> = {},
): GridDirectDealAssetSnapshot => ({
  assetId: 'property-1',
  kind: 'property',
  cityId: 'canton',
  ownerPlayerId: 'seller',
  tradable: true,
  majorLandmark: false,
  acquiredAt: '2026-09-16T18:00:00.000Z',
  ...overrides,
});

describe('Grid direct deals', () => {
  it('plans an atomic property-for-Credits settlement with an economic sink', () => {
    const result = planGridDirectDealSettlement(
      proposal(),
      [property()],
      rules,
      '2026-09-16T21:00:00.000Z',
    );

    expect(result.settleable).toBe(true);
    expect(result.proposerTotalDebitCredits).toBe(0);
    expect(result.counterpartyTotalDebitCredits).toBe(1_050);
    expect(result.creditTransfers).toEqual([
      {
        fromPlayerId: 'buyer',
        toPlayerId: 'seller',
        amountCredits: 1_000,
      },
    ]);
    expect(result.assetTransfers).toEqual([
      {
        assetId: 'property-1',
        kind: 'property',
        fromPlayerId: 'seller',
        toPlayerId: 'buyer',
      },
    ]);
    expect(result.taxCharges).toEqual([
      { playerId: 'buyer', amountCredits: 50 },
    ]);
    expect(result.playerCreditDeltas).toEqual({
      seller: 1_000,
      buyer: -1_050,
    });
    expect(result.audit).toEqual({
      grossCreditsTransferred: 1_000,
      totalTaxCredits: 50,
      propertyTransfers: 1,
      otherAssetTransfers: 0,
      zeroCreditDeal: false,
      reciprocalCreditFlow: false,
    });
  });

  it('supports bilateral Credits and asset swaps while keeping transfers deterministic', () => {
    const deal = proposal({
      proposer: {
        playerId: 'alpha',
        cityId: 'canton',
        creditBalance: 1_000,
        offeredCredits: 300,
        offeredAssetIds: ['z-asset'],
      },
      counterparty: {
        playerId: 'beta',
        cityId: 'canton',
        creditBalance: 1_000,
        offeredCredits: 200,
        offeredAssetIds: ['a-asset'],
      },
    });
    const assets: GridDirectDealAssetSnapshot[] = [
      {
        assetId: 'z-asset',
        kind: 'asset',
        cityId: 'canton',
        ownerPlayerId: 'alpha',
        tradable: true,
        majorLandmark: false,
      },
      {
        assetId: 'a-asset',
        kind: 'asset',
        cityId: 'canton',
        ownerPlayerId: 'beta',
        tradable: true,
        majorLandmark: false,
      },
    ];

    const result = planGridDirectDealSettlement(
      deal,
      assets,
      rules,
      '2026-09-16T21:00:00.000Z',
    );

    expect(result.settleable).toBe(true);
    expect(result.proposerTotalDebitCredits).toBe(315);
    expect(result.counterpartyTotalDebitCredits).toBe(210);
    expect(result.assetTransfers.map(({ assetId }) => assetId)).toEqual([
      'a-asset',
      'z-asset',
    ]);
    expect(result.playerCreditDeltas).toEqual({
      alpha: -115,
      beta: 90,
    });
    expect(result.audit.reciprocalCreditFlow).toBe(true);
    expect(result.audit.totalTaxCredits).toBe(25);
  });

  it('allows zero-Credit barter and exposes it in audit facts', () => {
    const deal = proposal({
      proposer: {
        playerId: 'alpha',
        cityId: 'canton',
        creditBalance: 0,
        offeredCredits: 0,
        offeredAssetIds: ['a'],
      },
      counterparty: {
        playerId: 'beta',
        cityId: 'canton',
        creditBalance: 0,
        offeredCredits: 0,
        offeredAssetIds: ['b'],
      },
    });

    const result = planGridDirectDealSettlement(
      deal,
      [
        {
          assetId: 'a',
          kind: 'asset',
          cityId: 'canton',
          ownerPlayerId: 'alpha',
          tradable: true,
          majorLandmark: false,
        },
        {
          assetId: 'b',
          kind: 'asset',
          cityId: 'canton',
          ownerPlayerId: 'beta',
          tradable: true,
          majorLandmark: false,
        },
      ],
      rules,
      '2026-09-16T21:00:00.000Z',
    );

    expect(result.settleable).toBe(true);
    expect(result.creditTransfers).toEqual([]);
    expect(result.taxCharges).toEqual([]);
    expect(result.audit.zeroCreditDeal).toBe(true);
    expect(result.audit.otherAssetTransfers).toBe(2);
  });

  it('structurally excludes Influence and Command Points from direct-deal contracts', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/grid/core/direct-deal-types.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/\binfluence\b/i);
    expect(source).not.toMatch(/commandPoints/i);
  });

  it('keeps city economies isolated', () => {
    const result = planGridDirectDealSettlement(
      proposal({
        counterparty: {
          playerId: 'buyer',
          cityId: 'cleveland',
          creditBalance: 2_000,
          offeredCredits: 1_000,
          offeredAssetIds: [],
        },
      }),
      [property()],
      rules,
      '2026-09-16T21:00:00.000Z',
    );

    expect(result).toMatchObject({
      settleable: false,
      reason: 'city-mismatch',
    });
  });

  it('refuses self-dealing and settlements outside the proposal window', () => {
    const selfDeal = proposal({
      counterparty: {
        playerId: 'seller',
        cityId: 'canton',
        creditBalance: 2_000,
        offeredCredits: 1_000,
        offeredAssetIds: [],
      },
    });

    expect(
      planGridDirectDealSettlement(
        selfDeal,
        [property()],
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('same-player');

    expect(
      planGridDirectDealSettlement(
        proposal(),
        [property()],
        rules,
        '2026-09-16T19:59:59.999Z',
      ).reason,
    ).toBe('outside-deal-window');

    expect(
      planGridDirectDealSettlement(
        proposal(),
        [property()],
        rules,
        '2026-09-16T22:00:00.000Z',
      ).reason,
    ).toBe('outside-deal-window');
  });

  it('charges tax on outgoing Credits and requires the payer to cover it', () => {
    expect(calculateGridDirectDealTax(999, rules)).toBe(49);

    const result = planGridDirectDealSettlement(
      proposal({
        counterparty: {
          playerId: 'buyer',
          cityId: 'canton',
          creditBalance: 1_049,
          offeredCredits: 1_000,
          offeredAssetIds: [],
        },
      }),
      [property()],
      rules,
      '2026-09-16T21:00:00.000Z',
    );

    expect(result).toMatchObject({
      settleable: false,
      reason: 'insufficient-credits',
    });
  });

  it('fails closed when offered assets are missing, foreign, or not owned by the offering player', () => {
    expect(
      planGridDirectDealSettlement(
        proposal(),
        [],
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('asset-not-found');

    expect(
      planGridDirectDealSettlement(
        proposal(),
        [property({ ownerPlayerId: 'someone-else' })],
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('asset-owner-mismatch');

    expect(
      planGridDirectDealSettlement(
        proposal(),
        [property({ cityId: 'cleveland' })],
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('asset-city-mismatch');
  });

  it('blocks explicitly non-tradable assets and major landmarks', () => {
    expect(
      planGridDirectDealSettlement(
        proposal(),
        [property({ tradable: false })],
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('asset-not-tradable');

    expect(
      planGridDirectDealSettlement(
        proposal(),
        [property({ majorLandmark: true })],
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('major-landmark');
  });

  it('enforces the post-capture property cooldown and allows settlement exactly at expiry', () => {
    const recent = property({
      acquiredAt: '2026-09-16T20:30:00.000Z',
    });

    expect(
      planGridDirectDealSettlement(
        proposal(),
        [recent],
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('property-cooldown-active');

    const atExpiry = planGridDirectDealSettlement(
      proposal(),
      [recent],
      rules,
      '2026-09-16T21:30:00.000Z',
    );
    expect(atExpiry.settleable).toBe(true);

    expect(
      planGridDirectDealSettlement(
        proposal(),
        [property({ acquiredAt: null })],
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('property-cooldown-unverifiable');
  });

  it('rejects duplicate assets and asset-count abuse before settlement', () => {
    const duplicated = proposal({
      counterparty: {
        playerId: 'buyer',
        cityId: 'canton',
        creditBalance: 2_000,
        offeredCredits: 1_000,
        offeredAssetIds: ['property-1'],
      },
    });

    expect(
      planGridDirectDealSettlement(
        duplicated,
        [property()],
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('duplicate-asset');

    const tooMany = proposal({
      proposer: {
        playerId: 'seller',
        cityId: 'canton',
        creditBalance: 500,
        offeredCredits: 0,
        offeredAssetIds: ['1', '2', '3', '4', '5'],
      },
    });

    expect(
      planGridDirectDealSettlement(
        tooMany,
        [],
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('too-many-assets');
  });

  it('rejects empty deals instead of logging meaningless transactions', () => {
    const empty = proposal({
      proposer: {
        playerId: 'seller',
        cityId: 'canton',
        creditBalance: 0,
        offeredCredits: 0,
        offeredAssetIds: [],
      },
      counterparty: {
        playerId: 'buyer',
        cityId: 'canton',
        creditBalance: 0,
        offeredCredits: 0,
        offeredAssetIds: [],
      },
    });

    expect(
      planGridDirectDealSettlement(
        empty,
        [],
        rules,
        '2026-09-16T21:00:00.000Z',
      ).reason,
    ).toBe('empty-deal');
  });

  it('validates taxes, cooldown math, caps, and proposal timestamps', () => {
    expect(() =>
      validateGridDirectDealRules({
        ...rules,
        transactionTaxBps: 10_001,
      }),
    ).toThrow(/cannot exceed 10000/);

    expect(() =>
      validateGridDirectDealRules({
        ...rules,
        propertyTradeCooldownMinutes: Number.MAX_SAFE_INTEGER,
      }),
    ).toThrow(/too large/);

    expect(() =>
      validateGridDirectDealRules({
        ...rules,
        maxAssetsPerSide: 0,
      }),
    ).toThrow(/positive safe integer/);

    expect(() =>
      planGridDirectDealSettlement(
        proposal({
          expiresAt: '2026-09-16T19:00:00.000Z',
        }),
        [property()],
        rules,
        '2026-09-16T21:00:00.000Z',
      ),
    ).toThrow(/expiresAt must be after createdAt/);
  });

  it('rejects duplicate asset snapshots and unsafe credit arithmetic', () => {
    expect(() =>
      planGridDirectDealSettlement(
        proposal(),
        [property(), property()],
        rules,
        '2026-09-16T21:00:00.000Z',
      ),
    ).toThrow(/Duplicate Grid direct deal asset snapshot/);

    expect(() =>
      planGridDirectDealSettlement(
        proposal({
          proposer: {
            playerId: 'seller',
            cityId: 'canton',
            creditBalance: Number.MAX_SAFE_INTEGER,
            offeredCredits: Number.MAX_SAFE_INTEGER,
            offeredAssetIds: [],
          },
          counterparty: {
            playerId: 'buyer',
            cityId: 'canton',
            creditBalance: 0,
            offeredCredits: 0,
            offeredAssetIds: ['property-1'],
          },
        }),
        [
          property({
            ownerPlayerId: 'buyer',
          }),
        ],
        { ...rules, transactionTaxBps: 10_000 },
        '2026-09-16T21:00:00.000Z',
      ),
    ).toThrow(/proposerTotalDebitCredits exceeds safe integer range/);
  });
});
