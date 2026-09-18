import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridDirectDealProposalAcceptResult,
  GridDirectDealProposalCancelResult,
  GridDirectDealProposalCommandPort,
  GridDirectDealProposalRecord,
} from './direct-deal-proposal-port';

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridDirectDealProposalCommandPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridDirectDealProposalCommandPort {
  if (!client) throw new Error('Grid Direct Deal proposals require Supabase service-role configuration');

  return {
    async createProposal(command) {
      const { data, error } = await client.rpc('grid_create_direct_deal_proposal', {
        p_season_id: command.seasonId,
        p_proposal_id: command.proposalId,
        p_proposer_player_id: command.proposerPlayerId,
        p_counterparty_player_id: command.counterpartyPlayerId,
        p_proposer_credits: command.proposerCredits,
        p_counterparty_credits: command.counterpartyCredits,
        p_proposer_property_ids: command.proposerPropertyIds,
        p_counterparty_property_ids: command.counterpartyPropertyIds,
        p_transaction_tax_bps: command.transactionTaxBps,
        p_property_trade_cooldown_minutes: command.propertyTradeCooldownMinutes,
        p_max_assets_per_side: command.maxAssetsPerSide,
        p_created_at: command.createdAt,
        p_expires_at: command.expiresAt,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) throw new Error(`Failed to create Grid Direct Deal proposal: ${error.message}`);
      return requireObject<GridDirectDealProposalRecord>(data, 'Grid Direct Deal proposal create');
    },

    async cancelProposal(command) {
      const { data, error } = await client.rpc('grid_cancel_direct_deal_proposal', {
        p_season_id: command.seasonId,
        p_proposal_id: command.proposalId,
        p_proposer_player_id: command.proposerPlayerId,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) throw new Error(`Failed to cancel Grid Direct Deal proposal: ${error.message}`);
      return requireObject<GridDirectDealProposalCancelResult>(data, 'Grid Direct Deal proposal cancel');
    },

    async acceptProposal(command) {
      const { data, error } = await client.rpc('grid_accept_direct_deal_proposal', {
        p_season_id: command.seasonId,
        p_proposal_id: command.proposalId,
        p_accepting_player_id: command.acceptingPlayerId,
        p_transaction: command.transaction,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) throw new Error(`Failed to accept Grid Direct Deal proposal: ${error.message}`);
      return requireObject<GridDirectDealProposalAcceptResult>(data, 'Grid Direct Deal proposal accept');
    },
  };
}
