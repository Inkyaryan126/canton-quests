import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260917204500_grid_direct_deal_proposals.sql'),
  'utf8',
).toLowerCase();

describe('Grid Direct Deal proposal persistence schema', () => {
  it('persists exact bilateral terms and frozen settlement rules', () => {
    expect(sql).toContain('create table public.grid_direct_deal_proposals');
    expect(sql).toContain('proposer_credits bigint not null');
    expect(sql).toContain('counterparty_credits bigint not null');
    expect(sql).toContain('proposer_property_ids uuid[] not null');
    expect(sql).toContain('counterparty_property_ids uuid[] not null');
    expect(sql).toContain('transaction_tax_bps integer not null');
    expect(sql).toContain('property_trade_cooldown_minutes bigint not null');
    expect(sql).toContain('max_assets_per_side integer not null');
    expect(sql).toContain('unique (season_id, proposal_id)');
  });

  it('makes proposal terms immutable while permitting resolution metadata', () => {
    expect(sql).toContain('grid_guard_direct_deal_proposal_terms');
    expect(sql).toContain('direct_deal_proposal_terms_immutable');
    expect(sql).toContain("raise exception 'direct_deal_proposal_terms_immutable'");
  });

  it('creates idempotent propose, cancel, and accept commands', () => {
    expect(sql).toContain('create or replace function public.grid_create_direct_deal_proposal');
    expect(sql).toContain('create or replace function public.grid_cancel_direct_deal_proposal');
    expect(sql).toContain('create or replace function public.grid_accept_direct_deal_proposal');
    expect(sql).toContain("'grid:direct_deal_proposed'");
    expect(sql).toContain("'grid:direct_deal_cancelled'");
    expect(sql).toContain("'grid:direct_deal_accepted'");
    expect(sql.match(/idempotency_key = p_idempotency_key/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('validates both players, city isolation, ownership, and proposal expiry', () => {
    expect(sql).toContain("raise exception 'direct_deal_same_player'");
    expect(sql).toContain("raise exception 'direct_deal_player_not_joined'");
    expect(sql).toContain("raise exception 'direct_deal_city_mismatch'");
    expect(sql).toContain("raise exception 'direct_deal_property_owner_mismatch'");
    expect(sql).toContain("raise exception 'direct_deal_proposal_expired'");
    expect(sql).toContain("raise exception 'direct_deal_counterparty_only'");
  });

  it('revalidates property tradability, landmarks, cooldowns, and fixed listings', () => {
    expect(sql).toContain("raise exception 'direct_deal_property_not_tradable'");
    expect(sql).toContain("raise exception 'direct_deal_major_landmark'");
    expect(sql).toContain("raise exception 'direct_deal_property_cooldown_active'");
    expect(sql).toContain("raise exception 'direct_deal_property_listed'");
    expect(sql).toContain('grid_market_fixed_price_listings');
  });

  it('binds acceptance to the persisted credit/property terms and authoritative values', () => {
    expect(sql).toContain("raise exception 'direct_deal_transaction_terms_mismatch'");
    expect(sql).toContain("raise exception 'direct_deal_property_value_mismatch'");
    expect(sql).toContain('v_property.base_value');
    expect(sql).toContain('v_proposer_transfer_ids');
    expect(sql).toContain('v_counterparty_transfer_ids');
  });

  it('settles acceptance through the Market 5 atomic transaction RPC using frozen rules', () => {
    expect(sql).toContain('public.grid_settle_market_transaction(');
    expect(sql).toContain('v_proposal.transaction_tax_bps');
    expect(sql).toContain('v_proposal.property_trade_cooldown_minutes');
    expect(sql).toContain("'direct-deal-settle:' || p_idempotency_key");
    expect(sql).toContain('settlement_transaction_id');
  });

  it('keeps Direct Deal proposal mutation service-role only and avoids security definer', () => {
    for (const fn of [
      'grid_create_direct_deal_proposal',
      'grid_cancel_direct_deal_proposal',
      'grid_accept_direct_deal_proposal',
    ]) {
      expect(sql).toContain(`revoke all on function public.${fn}`);
      expect(sql).toContain(`grant execute on function public.${fn}`);
    }
    expect(sql.match(/to service_role;/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).not.toContain('security definer');
    expect(sql).toContain('alter table public.grid_direct_deal_proposals enable row level security');
  });
});
