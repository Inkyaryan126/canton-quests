import { describe, expect, it } from 'vitest';
import {
  analyzeGridTradeIntegrityPair,
  validateGridTradeIntegrityConfig,
} from '../lib/grid/core/trade-integrity';
import type {
  GridTradeIntegrityConfig,
  GridTradeIntegrityTransaction,
} from '../lib/grid/core/trade-integrity-types';

const config: GridTradeIntegrityConfig = {
  analysisWindowMinutes: 24 * 60,
  pairTransactionCountThreshold: 4,
  rapidRepeatMinutes: 10,
  rapidRepeatCountThreshold: 2,
  pairGrossValueThresholdCredits: 10_000,
  oneWayImbalanceBpsThreshold: 8_000,
  oneWayMinimumGrossValueCredits: 5_000,
  zeroCreditAssetValueThresholdCredits: 5_000,
  reviewThresholdBps: 5_000,
  weights: {
    pairFrequencyBps: 2_000,
    rapidRepeatBps: 2_000,
    pairVolumeBps: 2_000,
    oneWayValueFlowBps: 2_000,
    highValueZeroCreditAssetsBps: 2_000,
  },
};

const tx = (
  transactionId: string,
  occurredAt: string,
  overrides: Partial<GridTradeIntegrityTransaction> = {},
): GridTradeIntegrityTransaction => ({
  transactionId,
  cityId: 'canton',
  occurredAt,
  participantAId: 'alpha',
  participantBId: 'beta',
  creditsToA: 500,
  creditsToB: 500,
  estimatedAssetValueToA: 0,
  estimatedAssetValueToB: 0,
  assetTransfers: 0,
  taxCredits: 50,
  ...overrides,
});

const query = {
  cityId: 'canton',
  playerAId: 'alpha',
  playerBId: 'beta',
  now: '2026-09-16T21:00:00.000Z',
};

describe('Grid trade integrity', () => {
  it('returns a clean projection for ordinary low-volume balanced trading', () => {
    const result = analyzeGridTradeIntegrityPair(
      [
        tx('t1', '2026-09-16T15:00:00.000Z'),
        tx('t2', '2026-09-16T18:00:00.000Z'),
      ],
      query,
      config,
    );

    expect(result.transactionCount).toBe(2);
    expect(result.grossCredits).toBe(2_000);
    expect(result.imbalanceBps).toBe(0);
    expect(result.riskScoreBps).toBe(0);
    expect(result.reviewRecommended).toBe(false);
    expect(result.signals.every(({ triggered }) => !triggered)).toBe(true);
  });

  it('flags repeated pair concentration at the configured transaction threshold', () => {
    const result = analyzeGridTradeIntegrityPair(
      [
        tx('t1', '2026-09-16T12:00:00.000Z'),
        tx('t2', '2026-09-16T14:00:00.000Z'),
        tx('t3', '2026-09-16T16:00:00.000Z'),
        tx('t4', '2026-09-16T18:00:00.000Z'),
      ],
      query,
      config,
    );

    expect(
      result.signals.find(({ signal }) => signal === 'pair-frequency'),
    ).toMatchObject({
      triggered: true,
      observedValue: 4,
      thresholdValue: 4,
    });
    expect(result.riskScoreBps).toBe(2_000);
  });

  it('flags rapid repeated transactions using chronological ordering, not input order', () => {
    const result = analyzeGridTradeIntegrityPair(
      [
        tx('t3', '2026-09-16T20:09:00.000Z'),
        tx('t1', '2026-09-16T20:00:00.000Z'),
        tx('t2', '2026-09-16T20:05:00.000Z'),
      ],
      query,
      config,
    );

    expect(result.rapidRepeatCount).toBe(2);
    expect(
      result.signals.find(({ signal }) => signal === 'rapid-repeat'),
    ).toMatchObject({
      triggered: true,
      observedValue: 2,
    });
    expect(result.transactionIds).toEqual(['t1', 't2', 't3']);
  });

  it('flags concentrated pair volume when estimated economic value crosses the threshold', () => {
    const result = analyzeGridTradeIntegrityPair(
      [
        tx('t1', '2026-09-16T15:00:00.000Z', {
          creditsToA: 5_000,
          creditsToB: 5_000,
        }),
      ],
      query,
      config,
    );

    expect(result.grossEstimatedValue).toBe(10_000);
    expect(
      result.signals.find(({ signal }) => signal === 'pair-volume'),
    ).toMatchObject({
      triggered: true,
      observedValue: 10_000,
    });
  });

  it('flags material one-way value flow without calling it proof of collusion', () => {
    const result = analyzeGridTradeIntegrityPair(
      [
        tx('gift', '2026-09-16T15:00:00.000Z', {
          creditsToA: 0,
          creditsToB: 6_000,
          taxCredits: 300,
        }),
      ],
      query,
      config,
    );

    expect(result.valueToPlayerA).toBe(0);
    expect(result.valueToPlayerB).toBe(6_000);
    expect(result.imbalanceBps).toBe(10_000);
    expect(
      result.signals.find(({ signal }) => signal === 'one-way-value-flow'),
    ).toMatchObject({
      triggered: true,
      observedValue: 10_000,
    });
  });

  it('flags high-value zero-Credit asset transfers as a review signal', () => {
    const result = analyzeGridTradeIntegrityPair(
      [
        tx('barter', '2026-09-16T15:00:00.000Z', {
          creditsToA: 0,
          creditsToB: 0,
          estimatedAssetValueToA: 0,
          estimatedAssetValueToB: 5_500,
          assetTransfers: 1,
          taxCredits: 0,
        }),
      ],
      query,
      config,
    );

    expect(result.zeroCreditAssetValue).toBe(5_500);
    expect(
      result.signals.find(
        ({ signal }) => signal === 'high-value-zero-credit-assets',
      ),
    ).toMatchObject({
      triggered: true,
      observedValue: 5_500,
    });
  });

  it('combines triggered signal weights into an explainable review score', () => {
    const transactions = [
      tx('t1', '2026-09-16T20:00:00.000Z', {
        creditsToA: 0,
        creditsToB: 4_000,
      }),
      tx('t2', '2026-09-16T20:04:00.000Z', {
        creditsToA: 0,
        creditsToB: 4_000,
      }),
      tx('t3', '2026-09-16T20:08:00.000Z', {
        creditsToA: 0,
        creditsToB: 4_000,
      }),
      tx('t4', '2026-09-16T20:12:00.000Z', {
        creditsToA: 0,
        creditsToB: 4_000,
      }),
    ];

    const result = analyzeGridTradeIntegrityPair(
      transactions,
      query,
      config,
    );

    expect(result.signals.filter(({ triggered }) => triggered).map(({ signal }) => signal)).toEqual([
      'pair-frequency',
      'rapid-repeat',
      'pair-volume',
      'one-way-value-flow',
    ]);
    expect(result.riskScoreBps).toBe(8_000);
    expect(result.reviewRecommended).toBe(true);
  });

  it('normalizes participant orientation so reversed transaction rows score identically', () => {
    const forward = tx('forward', '2026-09-16T15:00:00.000Z', {
      creditsToA: 100,
      creditsToB: 900,
    });
    const reversed: GridTradeIntegrityTransaction = {
      ...forward,
      transactionId: 'reversed',
      participantAId: 'beta',
      participantBId: 'alpha',
      creditsToA: 900,
      creditsToB: 100,
    };

    const a = analyzeGridTradeIntegrityPair([forward], query, config);
    const b = analyzeGridTradeIntegrityPair([reversed], query, config);

    expect(a.valueToPlayerA).toBe(b.valueToPlayerA);
    expect(a.valueToPlayerB).toBe(b.valueToPlayerB);
    expect(a.imbalanceBps).toBe(b.imbalanceBps);
  });

  it('isolates analysis by city and time window', () => {
    const result = analyzeGridTradeIntegrityPair(
      [
        tx('inside', '2026-09-16T20:00:00.000Z'),
        tx('old', '2026-09-15T20:59:59.999Z'),
        tx('other-city', '2026-09-16T20:00:00.000Z', {
          cityId: 'cleveland',
        }),
      ],
      query,
      config,
    );

    expect(result.transactionIds).toEqual(['inside']);
  });

  it('ignores transactions for unrelated player pairs while validating their shape', () => {
    const result = analyzeGridTradeIntegrityPair(
      [
        tx('pair', '2026-09-16T20:00:00.000Z'),
        tx('other', '2026-09-16T20:00:00.000Z', {
          participantAId: 'gamma',
          participantBId: 'delta',
        }),
      ],
      query,
      config,
    );

    expect(result.transactionIds).toEqual(['pair']);
  });

  it('rejects duplicate ids, self-trades, and future-dated transaction data', () => {
    expect(() =>
      analyzeGridTradeIntegrityPair(
        [
          tx('dup', '2026-09-16T20:00:00.000Z'),
          tx('dup', '2026-09-16T20:10:00.000Z'),
        ],
        query,
        config,
      ),
    ).toThrow(/Duplicate Grid trade integrity transactionId/);

    expect(() =>
      analyzeGridTradeIntegrityPair(
        [
          tx('self', '2026-09-16T20:00:00.000Z', {
            participantBId: 'alpha',
          }),
        ],
        query,
        config,
      ),
    ).toThrow(/cannot be self-trading/);

    expect(() =>
      analyzeGridTradeIntegrityPair(
        [tx('future', '2026-09-16T22:00:00.000Z')],
        query,
        config,
      ),
    ).toThrow(/cannot occur in the future/);
  });

  it('requires a distinct requested player pair and valid timestamps', () => {
    expect(() =>
      analyzeGridTradeIntegrityPair(
        [],
        { ...query, playerBId: 'alpha' },
        config,
      ),
    ).toThrow(/requires two distinct players/);

    expect(() =>
      analyzeGridTradeIntegrityPair(
        [],
        { ...query, now: 'not-a-date' },
        config,
      ),
    ).toThrow(/now must be a valid timestamp/);
  });

  it('requires weights to total exactly 10000 and thresholds to remain bounded', () => {
    expect(() =>
      validateGridTradeIntegrityConfig({
        ...config,
        weights: {
          ...config.weights,
          pairVolumeBps: 1_999,
        },
      }),
    ).toThrow(/must total exactly 10000/);

    expect(() =>
      validateGridTradeIntegrityConfig({
        ...config,
        oneWayImbalanceBpsThreshold: 10_001,
      }),
    ).toThrow(/cannot exceed 10000/);

    expect(() =>
      validateGridTradeIntegrityConfig({
        ...config,
        analysisWindowMinutes: Number.MAX_SAFE_INTEGER,
      }),
    ).toThrow(/too large/);
  });

  it('guards aggregate transaction value against unsafe integer overflow', () => {
    expect(() =>
      analyzeGridTradeIntegrityPair(
        [
          tx('huge-1', '2026-09-16T19:00:00.000Z', {
            creditsToA: Number.MAX_SAFE_INTEGER,
            creditsToB: 0,
          }),
          tx('huge-2', '2026-09-16T20:00:00.000Z', {
            creditsToA: 1,
            creditsToB: 0,
          }),
        ],
        query,
        config,
      ),
    ).toThrow(/grossCredits exceeds safe integer range/);
  });
});
