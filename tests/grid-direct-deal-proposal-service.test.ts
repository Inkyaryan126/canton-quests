import { describe, expect, it, vi } from 'vitest';
import type { GridMarketTransactionRecord } from '../lib/grid/core/market-transaction-types';
import type {
  GridDirectDealProposalCommandPort,
  GridDirectDealProposalRecord,
  GridDirectDealProposalAcceptResult,
} from '../lib/grid/server/direct-deal-proposal-port';
import {
  acceptGridDirectDealProposal,
  cancelGridDirectDealProposal,
  createGridDirectDealProposal,
} from '../lib/grid/server/direct-deal-proposal-service';
import { createSupabaseGridDirectDealProposalCommandPort } from '../lib/grid/server/supabase-direct-deal-proposal';

const seasonId = '10000000-0000-4000-8000-000000000001';
const cityId = '10000000-0000-4000-8000-000000000002';
const proposerId = '10000000-0000-4000-8000-000000000003';
const counterpartyId = '10000000-0000-4000-8000-000000000004';
const proposerPropertyId = '10000000-0000-4000-8000-000000000005';
const counterpartyPropertyId = '10000000-0000-4000-8000-000000000006';
const proposalId = 'deal-proposal-one';
const createdAt = '2026-09-17T20:00:00.000Z';
const expiresAt = '2026-09-18T20:00:00.000Z';

const createCommand = {
  seasonId,
  proposalId,
  proposerPlayerId: proposerId,
  counterpartyPlayerId: counterpartyId,
  proposerCredits: 300,
  counterpartyCredits: 125,
  proposerPropertyIds: [proposerPropertyId],
  counterpartyPropertyIds: [counterpartyPropertyId],
  transactionTaxBps: 500,
  propertyTradeCooldownMinutes: 60,
  maxAssetsPerSide: 4,
  createdAt,
  expiresAt,
  idempotencyKey: 'direct-deal:create:one',
  now: createdAt,
};

const proposal: GridDirectDealProposalRecord = {
  proposalId,
  seasonId,
  cityId,
  proposerPlayerId: proposerId,
  counterpartyPlayerId: counterpartyId,
  proposerCredits: 300,
  counterpartyCredits: 125,
  proposerPropertyIds: [proposerPropertyId],
  counterpartyPropertyIds: [counterpartyPropertyId],
  transactionTaxBps: 500,
  propertyTradeCooldownMinutes: 60,
  maxAssetsPerSide: 4,
  createdAt,
  expiresAt,
  status: 'open',
  eventId: '10000000-0000-4000-8000-000000000007',
};

const transaction: GridMarketTransactionRecord = {
  version: 1,
  transactionId: 'tx-direct-one',
  source: 'direct-deal',
  sourceId: proposalId,
  cityId,
  occurredAt: '2026-09-17T21:00:00.000Z',
  participantIds: [proposerId, counterpartyId],
  creditTransfers: [
    { fromPlayerId: proposerId, toPlayerId: counterpartyId, amountCredits: 300 },
    { fromPlayerId: counterpartyId, toPlayerId: proposerId, amountCredits: 125 },
  ],
  assetTransfers: [
    { assetId: proposerPropertyId, kind: 'property', fromPlayerId: proposerId, toPlayerId: counterpartyId, estimatedValueCredits: 1000 },
    { assetId: counterpartyPropertyId, kind: 'property', fromPlayerId: counterpartyId, toPlayerId: proposerId, estimatedValueCredits: 900 },
  ],
  taxCharges: [
    { playerId: proposerId, amountCredits: 15 },
    { playerId: counterpartyId, amountCredits: 6 },
  ],
  facts: {
    grossCreditsTransferred: 425,
    grossEstimatedAssetValue: 1900,
    grossEstimatedValue: 2325,
    totalTaxCredits: 21,
    propertyTransfers: 2,
    otherAssetTransfers: 0,
    zeroCreditTransaction: false,
    reciprocalCreditFlow: true,
  },
};

const accepted: GridDirectDealProposalAcceptResult = {
  proposalId,
  seasonId,
  status: 'accepted',
  acceptedAt: transaction.occurredAt,
  settlement: {
    transactionId: transaction.transactionId,
    seasonId,
    cityId,
    source: 'direct-deal',
    sourceId: proposalId,
    occurredAt: transaction.occurredAt,
    participantIds: transaction.participantIds,
    creditsAfter: { [proposerId]: 810, [counterpartyId]: 1169 },
    propertyOwnerPlayerIds: {
      [proposerPropertyId]: counterpartyId,
      [counterpartyPropertyId]: proposerId,
    },
    totalTaxCredits: 21,
    eventId: '10000000-0000-4000-8000-000000000008',
  },
  eventId: '10000000-0000-4000-8000-000000000009',
};

function port(): GridDirectDealProposalCommandPort {
  return {
    createProposal: vi.fn().mockResolvedValue(proposal),
    cancelProposal: vi.fn().mockResolvedValue({
      proposalId,
      seasonId,
      status: 'cancelled',
      cancelledAt: transaction.occurredAt,
      eventId: '10000000-0000-4000-8000-000000000010',
    }),
    acceptProposal: vi.fn().mockResolvedValue(accepted),
  };
}

describe('Grid Direct Deal proposal service', () => {
  it('validates and forwards an immutable bilateral proposal', async () => {
    const adapter = port();
    await expect(createGridDirectDealProposal(adapter, createCommand)).resolves.toEqual(proposal);
    expect(adapter.createProposal).toHaveBeenCalledWith(createCommand);
  });

  it('rejects invalid proposal identities, windows, and empty deals', async () => {
    const adapter = port();
    await expect(createGridDirectDealProposal(adapter, { ...createCommand, proposerPlayerId: counterpartyId })).rejects.toThrow('distinct players');
    await expect(createGridDirectDealProposal(adapter, { ...createCommand, expiresAt: createdAt })).rejects.toThrow('expiresAt');
    await expect(createGridDirectDealProposal(adapter, {
      ...createCommand,
      proposerCredits: 0,
      counterpartyCredits: 0,
      proposerPropertyIds: [],
      counterpartyPropertyIds: [],
    })).rejects.toThrow('value movement');
    expect(adapter.createProposal).not.toHaveBeenCalled();
  });

  it('rejects duplicate properties and side limits before persistence', async () => {
    const adapter = port();
    await expect(createGridDirectDealProposal(adapter, {
      ...createCommand,
      proposerPropertyIds: [proposerPropertyId, counterpartyPropertyId],
      counterpartyPropertyIds: [counterpartyPropertyId],
    })).rejects.toThrow('duplicate property');
    await expect(createGridDirectDealProposal(adapter, {
      ...createCommand,
      maxAssetsPerSide: 1,
      proposerPropertyIds: [proposerPropertyId, counterpartyPropertyId],
      counterpartyPropertyIds: [],
    })).rejects.toThrow('maxAssetsPerSide');
    expect(adapter.createProposal).not.toHaveBeenCalled();
  });

  it('bounds frozen tax and cooldown rules at proposal creation', async () => {
    const adapter = port();
    await expect(createGridDirectDealProposal(adapter, { ...createCommand, transactionTaxBps: 10001 })).rejects.toThrow('transactionTaxBps');
    await expect(createGridDirectDealProposal(adapter, { ...createCommand, propertyTradeCooldownMinutes: 2_147_483_648 })).rejects.toThrow('propertyTradeCooldownMinutes');
    await expect(createGridDirectDealProposal(adapter, { ...createCommand, maxAssetsPerSide: 0 })).rejects.toThrow('maxAssetsPerSide');
    expect(adapter.createProposal).not.toHaveBeenCalled();
  });

  it('requires proposal creation time to match authoritative command time', async () => {
    const adapter = port();
    await expect(createGridDirectDealProposal(adapter, { ...createCommand, now: '2026-09-17T20:00:01.000Z' })).rejects.toThrow('createdAt must equal now');
    expect(adapter.createProposal).not.toHaveBeenCalled();
  });

  it('validates proposer-only cancellation commands', async () => {
    const adapter = port();
    await cancelGridDirectDealProposal(adapter, {
      seasonId,
      proposalId,
      proposerPlayerId: proposerId,
      idempotencyKey: 'direct-deal:cancel:one',
      now: transaction.occurredAt,
    });
    expect(adapter.cancelProposal).toHaveBeenCalledTimes(1);
    await expect(cancelGridDirectDealProposal(adapter, {
      seasonId,
      proposalId: ' ',
      proposerPlayerId: proposerId,
      idempotencyKey: 'direct-deal:cancel:bad',
      now: transaction.occurredAt,
    })).rejects.toThrow('proposalId');
  });

  it('accepts only canonical Direct Deal transactions for the named proposal', async () => {
    const adapter = port();
    await expect(acceptGridDirectDealProposal(adapter, {
      seasonId,
      proposalId,
      acceptingPlayerId: counterpartyId,
      transaction,
      idempotencyKey: 'direct-deal:accept:one',
      now: transaction.occurredAt,
    })).resolves.toEqual(accepted);
    expect(adapter.acceptProposal).toHaveBeenCalledTimes(1);
  });

  it('rejects mismatched, stale-time, and non-property acceptance transactions', async () => {
    const adapter = port();
    await expect(acceptGridDirectDealProposal(adapter, {
      seasonId,
      proposalId,
      acceptingPlayerId: counterpartyId,
      transaction: { ...transaction, sourceId: 'other-proposal' },
      idempotencyKey: 'direct-deal:accept:bad-source',
      now: transaction.occurredAt,
    })).rejects.toThrow('sourceId');
    await expect(acceptGridDirectDealProposal(adapter, {
      seasonId,
      proposalId,
      acceptingPlayerId: counterpartyId,
      transaction,
      idempotencyKey: 'direct-deal:accept:bad-time',
      now: '2026-09-17T21:00:01.000Z',
    })).rejects.toThrow('occurredAt must equal now');
    await expect(acceptGridDirectDealProposal(adapter, {
      seasonId,
      proposalId,
      acceptingPlayerId: counterpartyId,
      transaction: {
        ...transaction,
        assetTransfers: [{ ...transaction.assetTransfers[0], kind: 'asset' }],
        facts: { ...transaction.facts, propertyTransfers: 0, otherAssetTransfers: 1, grossEstimatedAssetValue: 1000, grossEstimatedValue: 1425 },
      },
      idempotencyKey: 'direct-deal:accept:asset',
      now: transaction.occurredAt,
    })).rejects.toThrow('property');
    expect(adapter.acceptProposal).toHaveBeenCalledTimes(0);
  });
});

describe('Supabase Direct Deal proposal adapter', () => {
  it('requires service-role configuration', () => {
    expect(() => createSupabaseGridDirectDealProposalCommandPort(null as any)).toThrow('service-role');
  });

  it('uses only proposal command RPCs', async () => {
    const cancelled = {
      proposalId,
      seasonId,
      status: 'cancelled' as const,
      cancelledAt: transaction.occurredAt,
      eventId: '10000000-0000-4000-8000-000000000010',
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: proposal, error: null })
      .mockResolvedValueOnce({ data: cancelled, error: null })
      .mockResolvedValueOnce({ data: accepted, error: null });
    const adapter = createSupabaseGridDirectDealProposalCommandPort({ rpc } as any);

    await adapter.createProposal(createCommand);
    await adapter.cancelProposal({
      seasonId,
      proposalId,
      proposerPlayerId: proposerId,
      idempotencyKey: 'direct-deal:cancel:one',
      now: transaction.occurredAt,
    });
    await adapter.acceptProposal({
      seasonId,
      proposalId,
      acceptingPlayerId: counterpartyId,
      transaction,
      idempotencyKey: 'direct-deal:accept:one',
      now: transaction.occurredAt,
    });

    expect(rpc).toHaveBeenNthCalledWith(1, 'grid_create_direct_deal_proposal', expect.objectContaining({
      p_season_id: seasonId,
      p_proposal_id: proposalId,
      p_proposer_player_id: proposerId,
      p_counterparty_player_id: counterpartyId,
      p_transaction_tax_bps: 500,
      p_property_trade_cooldown_minutes: 60,
      p_max_assets_per_side: 4,
    }));
    expect(rpc).toHaveBeenNthCalledWith(2, 'grid_cancel_direct_deal_proposal', expect.objectContaining({
      p_season_id: seasonId,
      p_proposal_id: proposalId,
      p_proposer_player_id: proposerId,
    }));
    expect(rpc).toHaveBeenNthCalledWith(3, 'grid_accept_direct_deal_proposal', expect.objectContaining({
      p_season_id: seasonId,
      p_proposal_id: proposalId,
      p_accepting_player_id: counterpartyId,
      p_transaction: transaction,
    }));
  });
});
