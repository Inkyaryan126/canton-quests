export type GridMarketItemType = 'property' | 'asset';

export interface GridMarketConfig {
  transactionTaxBps: number;
  postCaptureTradeCooldownSeconds: number;
}

export interface GridMarketItem {
  itemType: GridMarketItemType;
  itemId: string;
  ownerPlayerId: string;
  acquiredAtMs: number;
  tradable: boolean;
  majorLandmark: boolean;
}

export interface GridMarketTaxQuote {
  grossCredits: number;
  taxCredits: number;
  sellerNetCredits: number;
}

export interface GridFixedPriceTradeInput {
  sellerPlayerId: string;
  buyerPlayerId: string;
  sellerCredits: number;
  buyerCredits: number;
  priceCredits: number;
  item: GridMarketItem;
  nowMs: number;
}

export interface GridFixedPriceTradeSettlement extends GridMarketTaxQuote {
  sellerCreditsAfter: number;
  buyerCreditsAfter: number;
  itemOwnerPlayerIdAfter: string;
}
