export interface GridAuctionSettlementSweepPort {
  listExpiredAuctionIds(
    seasonId: string,
    now: string,
    limit: number,
  ): Promise<string[]>;
}
