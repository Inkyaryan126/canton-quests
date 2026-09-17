import type {
  GridTradeIntegrityConfig,
  GridTradeIntegrityPairQuery,
  GridTradeIntegrityProjection,
  GridTradeIntegritySignalResult,
  GridTradeIntegrityTransaction,
} from './trade-integrity-types';

const BASIS_POINTS = 10_000;

function requireNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function requirePositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function requireBps(value: number, label: string): void {
  requireNonNegativeSafeInteger(value, label);
  if (value > BASIS_POINTS) {
    throw new Error(`${label} cannot exceed 10000 basis points`);
  }
}

function parseTimestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid timestamp`);
  }
  return parsed;
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds safe integer range`);
  }
  return result;
}

function ratioBps(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number(
    (BigInt(numerator) * BigInt(BASIS_POINTS)) / BigInt(denominator),
  );
}

export function validateGridTradeIntegrityConfig(
  config: GridTradeIntegrityConfig,
): void {
  requirePositiveSafeInteger(
    config.analysisWindowMinutes,
    'analysisWindowMinutes',
  );
  if (!Number.isSafeInteger(config.analysisWindowMinutes * 60_000)) {
    throw new Error('analysisWindowMinutes is too large');
  }

  requirePositiveSafeInteger(
    config.pairTransactionCountThreshold,
    'pairTransactionCountThreshold',
  );
  requirePositiveSafeInteger(config.rapidRepeatMinutes, 'rapidRepeatMinutes');
  if (!Number.isSafeInteger(config.rapidRepeatMinutes * 60_000)) {
    throw new Error('rapidRepeatMinutes is too large');
  }
  requirePositiveSafeInteger(
    config.rapidRepeatCountThreshold,
    'rapidRepeatCountThreshold',
  );
  requirePositiveSafeInteger(
    config.pairGrossValueThresholdCredits,
    'pairGrossValueThresholdCredits',
  );
  requireBps(
    config.oneWayImbalanceBpsThreshold,
    'oneWayImbalanceBpsThreshold',
  );
  requirePositiveSafeInteger(
    config.oneWayMinimumGrossValueCredits,
    'oneWayMinimumGrossValueCredits',
  );
  requirePositiveSafeInteger(
    config.zeroCreditAssetValueThresholdCredits,
    'zeroCreditAssetValueThresholdCredits',
  );
  requireBps(config.reviewThresholdBps, 'reviewThresholdBps');

  const weights = config.weights;
  for (const [key, value] of Object.entries(weights)) {
    requireBps(value, `weights.${key}`);
  }

  const totalWeight = Object.values(weights).reduce(
    (sum, value) => checkedAdd(sum, value, 'trade integrity weight total'),
    0,
  );
  if (totalWeight !== BASIS_POINTS) {
    throw new Error('Grid trade integrity weights must total exactly 10000');
  }
}

function validateQuery(query: GridTradeIntegrityPairQuery): number {
  if (!query.cityId.trim()) {
    throw new Error('Grid trade integrity query requires cityId');
  }
  if (!query.playerAId.trim() || !query.playerBId.trim()) {
    throw new Error('Grid trade integrity query requires two player ids');
  }
  if (query.playerAId === query.playerBId) {
    throw new Error('Grid trade integrity pair requires two distinct players');
  }

  return parseTimestamp(query.now, 'now');
}

function validateTransaction(
  transaction: GridTradeIntegrityTransaction,
  nowMs: number,
): number {
  if (!transaction.transactionId.trim()) {
    throw new Error('Grid trade integrity transactionId cannot be blank');
  }
  if (!transaction.cityId.trim()) {
    throw new Error(
      `Grid trade integrity transaction ${transaction.transactionId} requires cityId`,
    );
  }
  if (
    !transaction.participantAId.trim() ||
    !transaction.participantBId.trim()
  ) {
    throw new Error(
      `Grid trade integrity transaction ${transaction.transactionId} requires two participants`,
    );
  }
  if (transaction.participantAId === transaction.participantBId) {
    throw new Error(
      `Grid trade integrity transaction ${transaction.transactionId} cannot be self-trading`,
    );
  }

  for (const [key, value] of [
    ['creditsToA', transaction.creditsToA],
    ['creditsToB', transaction.creditsToB],
    ['estimatedAssetValueToA', transaction.estimatedAssetValueToA],
    ['estimatedAssetValueToB', transaction.estimatedAssetValueToB],
    ['assetTransfers', transaction.assetTransfers],
    ['taxCredits', transaction.taxCredits],
  ] as const) {
    requireNonNegativeSafeInteger(
      value,
      `transaction ${transaction.transactionId} ${key}`,
    );
  }

  const occurredAtMs = parseTimestamp(
    transaction.occurredAt,
    `transaction ${transaction.transactionId} occurredAt`,
  );
  if (occurredAtMs > nowMs) {
    throw new Error(
      `Grid trade integrity transaction ${transaction.transactionId} cannot occur in the future`,
    );
  }
  return occurredAtMs;
}

function isRequestedPair(
  transaction: GridTradeIntegrityTransaction,
  query: GridTradeIntegrityPairQuery,
): boolean {
  return (
    (transaction.participantAId === query.playerAId &&
      transaction.participantBId === query.playerBId) ||
    (transaction.participantAId === query.playerBId &&
      transaction.participantBId === query.playerAId)
  );
}

function valuesForRequestedOrientation(
  transaction: GridTradeIntegrityTransaction,
  query: GridTradeIntegrityPairQuery,
): {
  creditsToPlayerA: number;
  creditsToPlayerB: number;
  assetsToPlayerA: number;
  assetsToPlayerB: number;
} {
  if (transaction.participantAId === query.playerAId) {
    return {
      creditsToPlayerA: transaction.creditsToA,
      creditsToPlayerB: transaction.creditsToB,
      assetsToPlayerA: transaction.estimatedAssetValueToA,
      assetsToPlayerB: transaction.estimatedAssetValueToB,
    };
  }

  return {
    creditsToPlayerA: transaction.creditsToB,
    creditsToPlayerB: transaction.creditsToA,
    assetsToPlayerA: transaction.estimatedAssetValueToB,
    assetsToPlayerB: transaction.estimatedAssetValueToA,
  };
}

export function analyzeGridTradeIntegrityPair(
  transactions: readonly GridTradeIntegrityTransaction[],
  query: GridTradeIntegrityPairQuery,
  config: GridTradeIntegrityConfig,
): GridTradeIntegrityProjection {
  validateGridTradeIntegrityConfig(config);
  const nowMs = validateQuery(query);
  const windowMs = config.analysisWindowMinutes * 60_000;
  const windowStartsAtMs = nowMs - windowMs;

  const seenTransactionIds = new Set<string>();
  const matched = transactions
    .map((transaction) => {
      if (seenTransactionIds.has(transaction.transactionId)) {
        throw new Error(
          `Duplicate Grid trade integrity transactionId: ${transaction.transactionId}`,
        );
      }
      seenTransactionIds.add(transaction.transactionId);
      return {
        transaction,
        occurredAtMs: validateTransaction(transaction, nowMs),
      };
    })
    .filter(
      ({ transaction, occurredAtMs }) =>
        transaction.cityId === query.cityId &&
        isRequestedPair(transaction, query) &&
        occurredAtMs >= windowStartsAtMs &&
        occurredAtMs <= nowMs,
    )
    .sort(
      (left, right) =>
        left.occurredAtMs - right.occurredAtMs ||
        left.transaction.transactionId.localeCompare(
          right.transaction.transactionId,
        ),
    );

  let grossCredits = 0;
  let grossEstimatedAssetValue = 0;
  let valueToPlayerA = 0;
  let valueToPlayerB = 0;
  let zeroCreditAssetValue = 0;
  let taxCredits = 0;

  for (const { transaction } of matched) {
    const oriented = valuesForRequestedOrientation(transaction, query);
    const transactionCredits = checkedAdd(
      oriented.creditsToPlayerA,
      oriented.creditsToPlayerB,
      'transaction gross Credits',
    );
    const transactionAssets = checkedAdd(
      oriented.assetsToPlayerA,
      oriented.assetsToPlayerB,
      'transaction gross estimated asset value',
    );

    grossCredits = checkedAdd(
      grossCredits,
      transactionCredits,
      'grossCredits',
    );
    grossEstimatedAssetValue = checkedAdd(
      grossEstimatedAssetValue,
      transactionAssets,
      'grossEstimatedAssetValue',
    );
    valueToPlayerA = checkedAdd(
      valueToPlayerA,
      checkedAdd(
        oriented.creditsToPlayerA,
        oriented.assetsToPlayerA,
        'value to player A transaction total',
      ),
      'valueToPlayerA',
    );
    valueToPlayerB = checkedAdd(
      valueToPlayerB,
      checkedAdd(
        oriented.creditsToPlayerB,
        oriented.assetsToPlayerB,
        'value to player B transaction total',
      ),
      'valueToPlayerB',
    );
    taxCredits = checkedAdd(
      taxCredits,
      transaction.taxCredits,
      'taxCredits',
    );

    if (transactionCredits === 0 && transactionAssets > 0) {
      zeroCreditAssetValue = checkedAdd(
        zeroCreditAssetValue,
        transactionAssets,
        'zeroCreditAssetValue',
      );
    }
  }

  let rapidRepeatCount = 0;
  const rapidRepeatMs = config.rapidRepeatMinutes * 60_000;
  for (let index = 1; index < matched.length; index += 1) {
    const gap = matched[index].occurredAtMs - matched[index - 1].occurredAtMs;
    if (gap <= rapidRepeatMs) rapidRepeatCount += 1;
  }

  const grossEstimatedValue = checkedAdd(
    grossCredits,
    grossEstimatedAssetValue,
    'grossEstimatedValue',
  );
  const absoluteImbalance = Math.abs(valueToPlayerA - valueToPlayerB);
  const imbalanceBps = ratioBps(absoluteImbalance, grossEstimatedValue);

  const pairFrequencyTriggered =
    matched.length >= config.pairTransactionCountThreshold;
  const rapidRepeatTriggered =
    rapidRepeatCount >= config.rapidRepeatCountThreshold;
  const pairVolumeTriggered =
    grossEstimatedValue >= config.pairGrossValueThresholdCredits;
  const oneWayTriggered =
    grossEstimatedValue >= config.oneWayMinimumGrossValueCredits &&
    imbalanceBps >= config.oneWayImbalanceBpsThreshold;
  const zeroCreditAssetTriggered =
    zeroCreditAssetValue >= config.zeroCreditAssetValueThresholdCredits;

  const signals: GridTradeIntegritySignalResult[] = [
    {
      signal: 'pair-frequency',
      triggered: pairFrequencyTriggered,
      weightBps: config.weights.pairFrequencyBps,
      observedValue: matched.length,
      thresholdValue: config.pairTransactionCountThreshold,
    },
    {
      signal: 'rapid-repeat',
      triggered: rapidRepeatTriggered,
      weightBps: config.weights.rapidRepeatBps,
      observedValue: rapidRepeatCount,
      thresholdValue: config.rapidRepeatCountThreshold,
    },
    {
      signal: 'pair-volume',
      triggered: pairVolumeTriggered,
      weightBps: config.weights.pairVolumeBps,
      observedValue: grossEstimatedValue,
      thresholdValue: config.pairGrossValueThresholdCredits,
    },
    {
      signal: 'one-way-value-flow',
      triggered: oneWayTriggered,
      weightBps: config.weights.oneWayValueFlowBps,
      observedValue: imbalanceBps,
      thresholdValue: config.oneWayImbalanceBpsThreshold,
    },
    {
      signal: 'high-value-zero-credit-assets',
      triggered: zeroCreditAssetTriggered,
      weightBps: config.weights.highValueZeroCreditAssetsBps,
      observedValue: zeroCreditAssetValue,
      thresholdValue: config.zeroCreditAssetValueThresholdCredits,
    },
  ];

  const riskScoreBps = signals.reduce(
    (sum, signal) =>
      signal.triggered
        ? checkedAdd(sum, signal.weightBps, 'riskScoreBps')
        : sum,
    0,
  );

  return {
    cityId: query.cityId,
    playerAId: query.playerAId,
    playerBId: query.playerBId,
    windowStartsAt: new Date(windowStartsAtMs).toISOString(),
    windowEndsAt: new Date(nowMs).toISOString(),
    transactionCount: matched.length,
    rapidRepeatCount,
    grossCredits,
    grossEstimatedAssetValue,
    grossEstimatedValue,
    valueToPlayerA,
    valueToPlayerB,
    imbalanceBps,
    zeroCreditAssetValue,
    taxCredits,
    riskScoreBps,
    reviewRecommended: riskScoreBps >= config.reviewThresholdBps,
    signals,
    transactionIds: matched.map(
      ({ transaction }) => transaction.transactionId,
    ),
  };
}
