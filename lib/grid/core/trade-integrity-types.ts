export type GridTradeIntegritySignal =
  | 'pair-frequency'
  | 'rapid-repeat'
  | 'pair-volume'
  | 'one-way-value-flow'
  | 'high-value-zero-credit-assets';

export interface GridTradeIntegrityWeights {
  pairFrequencyBps: number;
  rapidRepeatBps: number;
  pairVolumeBps: number;
  oneWayValueFlowBps: number;
  highValueZeroCreditAssetsBps: number;
}

export interface GridTradeIntegrityConfig {
  analysisWindowMinutes: number;
  pairTransactionCountThreshold: number;
  rapidRepeatMinutes: number;
  rapidRepeatCountThreshold: number;
  pairGrossValueThresholdCredits: number;
  oneWayImbalanceBpsThreshold: number;
  oneWayMinimumGrossValueCredits: number;
  zeroCreditAssetValueThresholdCredits: number;
  reviewThresholdBps: number;
  weights: GridTradeIntegrityWeights;
}

export interface GridTradeIntegrityTransaction {
  transactionId: string;
  cityId: string;
  occurredAt: string;
  participantAId: string;
  participantBId: string;
  creditsToA: number;
  creditsToB: number;
  estimatedAssetValueToA: number;
  estimatedAssetValueToB: number;
  assetTransfers: number;
  taxCredits: number;
}

export interface GridTradeIntegrityPairQuery {
  cityId: string;
  playerAId: string;
  playerBId: string;
  now: string;
}

export interface GridTradeIntegritySignalResult {
  signal: GridTradeIntegritySignal;
  triggered: boolean;
  weightBps: number;
  observedValue: number;
  thresholdValue: number;
}

export interface GridTradeIntegrityProjection {
  cityId: string;
  playerAId: string;
  playerBId: string;
  windowStartsAt: string;
  windowEndsAt: string;
  transactionCount: number;
  rapidRepeatCount: number;
  grossCredits: number;
  grossEstimatedAssetValue: number;
  grossEstimatedValue: number;
  valueToPlayerA: number;
  valueToPlayerB: number;
  imbalanceBps: number;
  zeroCreditAssetValue: number;
  taxCredits: number;
  riskScoreBps: number;
  reviewRecommended: boolean;
  signals: GridTradeIntegritySignalResult[];
  transactionIds: string[];
}
