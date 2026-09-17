import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260917183000_grid_market_settlement.sql'),
  'utf8',
).toLowerCase();

describe('Grid market settlement persistence schema', () => {
  it('persists fixed-price listings and immutable canonical transactions', () => {
    expect(sql).toContain('create table public.grid_market_fixed_price_listings');
    expect(sql).toContain('create table public.grid_market_transactions');
    expect(sql).toContain('grid_market_transactions_immutable');
    expect(sql).toContain('grid_market_transactions_idempotency_uq');
    expect(sql).toContain('grid_market_open_property_uq');
  });

  it('keeps all mutations behind service-role-only RPCs', () => {
    for (const fn of [
      'grid_open_fixed_price_property_listing',
      'grid_cancel_fixed_price_property_listing',
      'grid_settle_market_transaction',
    ]) {
      expect(sql).toContain(`revoke all on function public.${fn}`);
      expect(sql).toContain(`grant execute on function public.${fn}`);
    }
    expect(sql.match(/to service_role;/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).not.toContain('security definer');
  });

  it('settles accrued resources before locking and changing player balances', () => {
    expect(sql).toContain('perform public.grid_settle_player_resources');
    expect(sql).toContain("'premarket:' || p_idempotency_key");
    expect(sql).toContain('for update');
    expect(sql).toContain("raise exception 'market_insufficient_credits'");
  });

  it('bounds property cooldown minutes before converting them to a Postgres interval', () => {
    expect(sql.match(/p_property_trade_cooldown_minutes > 2147483647/g)?.length)
      .toBeGreaterThanOrEqual(2);
  });

  it('moves property ownership and taxes atomically for both market sources', () => {
    expect(sql).toContain("p_transaction ->> 'source' not in ('direct-deal', 'fixed-price')");
    expect(sql).toContain("transfer ->> 'kind' <> 'property'");
    expect(sql).toContain("raise exception 'market_asset_kind_unsupported'");
    expect(sql).toContain('set owner_player_id = v_to_player_id');
    expect(sql).toContain('acquired_at = p_now');
    expect(sql).toContain('v_expected_tax');
    expect(sql).toContain("raise exception 'market_tax_mismatch'");
  });

  it('verifies fixed-price listing identity, seller, buyer, price, and sale window', () => {
    expect(sql).toContain("raise exception 'market_listing_not_open'");
    expect(sql).toContain("raise exception 'market_listing_outside_window'");
    expect(sql).toContain("raise exception 'market_listing_transaction_mismatch'");
    expect(sql).toContain("set status = 'sold'");
  });

  it('blocks stale ownership, cross-city trade, non-tradable properties, landmarks, and cooldown bypass', () => {
    expect(sql).toContain("raise exception 'market_property_owner_mismatch'");
    expect(sql).toContain("raise exception 'market_city_mismatch'");
    expect(sql).toContain("raise exception 'market_property_not_tradable'");
    expect(sql).toContain("raise exception 'market_major_landmark'");
    expect(sql).toContain("raise exception 'market_property_cooldown_active'");
  });

  it('logs canonical facts and an immutable game event for audit and anti-collusion analysis', () => {
    expect(sql).toContain('credit_transfers jsonb not null');
    expect(sql).toContain('asset_transfers jsonb not null');
    expect(sql).toContain('tax_charges jsonb not null');
    expect(sql).toContain('facts jsonb not null');
    expect(sql).toContain("'grid:market_transaction_settled'");
    expect(sql).toContain('insert into public.grid_game_events');
  });
});
