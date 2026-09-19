export interface GridContractRewardSettlementResult {
  outboxId: string;
  seasonId: string;
  playerId: string;
  contractId: string;
  rewardKind: 'contract' | 'location-bonus';
  outcome: 'applied' | 'duplicate';
  creditsGranted: number;
  influenceGranted: number;
  commandPointsGranted: number;
  credits: number;
  influence: number;
  commandPoints: number;
  processedAt: string;
  eventId: string;
}

export interface GridContractRewardSettlementPort {
  listPendingRewardIds(limit: number): Promise<string[]>;
  settleReward(input: {
    outboxId: string;
    now: string;
  }): Promise<GridContractRewardSettlementResult>;
}
