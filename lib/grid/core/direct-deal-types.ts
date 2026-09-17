export type GridDirectDealAssetKind = 'property' | 'asset';

export interface GridDirectDealRules {
  transactionTaxBps: number;
  propertyTradeCooldownMinutes: number;
  maxAssetsPerSide: number;
}

export interface GridDirectDealSide {
  playerId: string;
  cityId: string;
  creditBalance: number;
  offeredCredits: number;
  offeredAssetIds: string[];
}

export interface GridDirectDealProposal {
  cityId: string;
  proposer: GridDirectDealSide;
  counterparty: GridDirectDealSide;
  createdAt: string;
  expiresAt: string;
}

export interface GridDirectDealAssetSnapshot {
  assetId: string;
  kind: GridDirectDealAssetKind;
  cityId: string;
  ownerPlayerId: string;
  tradable: boolean;
  majorLandmark: boolean;
  acquiredAt?: string | null;
}

export type GridDirectDealRejectionReason =
  | 'same-player'
  | 'city-mismatch'
  | 'outside-deal-window'
  | 'empty-deal'
  | 'too-many-assets'
  | 'insufficient-credits'
  | 'duplicate-asset'
  | 'asset-not-found'
  | 'asset-owner-mismatch'
  | 'asset-city-mismatch'
  | 'asset-not-tradable'
  | 'major-landmark'
  | 'property-cooldown-unverifiable'
  | 'property-cooldown-active';

export interface GridDirectDealCreditTransfer {
  fromPlayerId: string;
  toPlayerId: string;
  amountCredits: number;
}

export interface GridDirectDealAssetTransfer {
  assetId: string;
  kind: GridDirectDealAssetKind;
  fromPlayerId: string;
  toPlayerId: string;
}

export interface GridDirectDealTaxCharge {
  playerId: string;
  amountCredits: number;
}

export interface GridDirectDealAuditFacts {
  grossCreditsTransferred: number;
  totalTaxCredits: number;
  propertyTransfers: number;
  otherAssetTransfers: number;
  zeroCreditDeal: boolean;
  reciprocalCreditFlow: boolean;
}

export interface GridDirectDealSettlementPlan {
  settleable: boolean;
  reason?: GridDirectDealRejectionReason;
  cityId: string;
  settledAt: string;
  proposerTotalDebitCredits: number;
  counterpartyTotalDebitCredits: number;
  creditTransfers: GridDirectDealCreditTransfer[];
  assetTransfers: GridDirectDealAssetTransfer[];
  taxCharges: GridDirectDealTaxCharge[];
  playerCreditDeltas: Record<string, number>;
  audit: GridDirectDealAuditFacts;
}
