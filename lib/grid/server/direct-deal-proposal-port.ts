import type { GridMarketTransactionRecord } from '../core/market-transaction-types';
import type { GridMarketSettlementResult } from './market-settlement-port';

export type GridDirectDealProposalStatus = 'open' | 'accepted' | 'cancelled';

export interface GridDirectDealProposalCreateCommand {
  seasonId: string;
  proposalId: string;
  proposerPlayerId: string;
  counterpartyPlayerId: string;
  proposerCredits: number;
  counterpartyCredits: number;
  proposerPropertyIds: string[];
  counterpartyPropertyIds: string[];
  transactionTaxBps: number;
  propertyTradeCooldownMinutes: number;
  maxAssetsPerSide: number;
  createdAt: string;
  expiresAt: string;
  idempotencyKey: string;
  now: string;
}

export interface GridDirectDealProposalRecord {
  proposalId: string;
  seasonId: string;
  cityId: string;
  proposerPlayerId: string;
  counterpartyPlayerId: string;
  proposerCredits: number;
  counterpartyCredits: number;
  proposerPropertyIds: string[];
  counterpartyPropertyIds: string[];
  transactionTaxBps: number;
  propertyTradeCooldownMinutes: number;
  maxAssetsPerSide: number;
  createdAt: string;
  expiresAt: string;
  status: 'open';
  eventId: string;
}

export interface GridDirectDealProposalCancelCommand {
  seasonId: string;
  proposalId: string;
  proposerPlayerId: string;
  idempotencyKey: string;
  now: string;
}

export interface GridDirectDealProposalCancelResult {
  proposalId: string;
  seasonId: string;
  status: 'cancelled';
  cancelledAt: string;
  eventId: string;
}

export interface GridDirectDealProposalAcceptCommand {
  seasonId: string;
  proposalId: string;
  acceptingPlayerId: string;
  transaction: GridMarketTransactionRecord;
  idempotencyKey: string;
  now: string;
}

export interface GridDirectDealProposalAcceptResult {
  proposalId: string;
  seasonId: string;
  status: 'accepted';
  acceptedAt: string;
  settlement: GridMarketSettlementResult;
  eventId: string;
}

export interface GridDirectDealProposalCommandPort {
  createProposal(command: GridDirectDealProposalCreateCommand): Promise<GridDirectDealProposalRecord>;
  cancelProposal(command: GridDirectDealProposalCancelCommand): Promise<GridDirectDealProposalCancelResult>;
  acceptProposal(command: GridDirectDealProposalAcceptCommand): Promise<GridDirectDealProposalAcceptResult>;
}
