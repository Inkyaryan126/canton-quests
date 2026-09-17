import type { GridDirectDealAssetKind, GridDirectDealSettlementPlan } from './direct-deal-types';
import type { GridFixedPricePurchasePlan } from './market-listing-types';

export type GridMarketTransactionSource = 'direct-deal' | 'fixed-price';

export interface GridMarketTransactionCreditTransfer {
  fromPlayerId: string;
  toPlayerId: string;
  amountCredits: number;
}

export interface GridMarketTransactionAssetTransfer {
  assetId: string;
  kind: GridDirectDealAssetKind;
  fromPlayerId: string;
  toPlayerId: string;
  estimatedValueCredits: number;
}

export interface GridMarketTransactionTaxCharge {
  playerId: string;
  amountCredits: number;
}

export interface GridMarketTransactionFacts {
  grossCreditsTransferred: number;
  grossEstimatedAssetValue: number;
  grossEstimatedValue: number;
  totalTaxCredits: number;
  propertyTransfers: number;
  otherAssetTransfers: number;
  zeroCreditTransaction: boolean;
  reciprocalCreditFlow: boolean;
}

export interface GridMarketTransactionRecord {
  version: 1;
  transactionId: string;
  source: GridMarketTransactionSource;
  sourceId: string;
  cityId: string;
  occurredAt: string;
  participantIds: [string, string];
  creditTransfers: GridMarketTransactionCreditTransfer[];
  assetTransfers: GridMarketTransactionAssetTransfer[];
  taxCharges: GridMarketTransactionTaxCharge[];
  facts: GridMarketTransactionFacts;
}

export interface BuildGridMarketTransactionFromDirectDealInput {
  transactionId: string;
  sourceId: string;
  plan: GridDirectDealSettlementPlan;
  estimatedAssetValueCreditsById: Record<string, number>;
}

export interface BuildGridMarketTransactionFromFixedPricePurchaseInput {
  transactionId: string;
  cityId: string;
  plan: GridFixedPricePurchasePlan;
  estimatedAssetValueCredits: number;
}
