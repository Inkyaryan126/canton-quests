import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260916070000_grid_property_auctions.sql',
    ),
    'utf8',
  )
  .toLowerCase();

describe('Grid property auction persistence schema', () => {
  it('stores auctions, append-only bid history, and one active auction per property', () => {
    expect(sql).toContain('create table public.grid_property_auctions');
    expect(sql).toContain('create table public.grid_property_auction_bids');
    expect(sql).toContain('grid_property_auctions_active_property_uq');
    expect(sql).toContain("where status in ('scheduled', 'open')");
  });

  it('blocks direct property ownership changes while an auction is active', () => {
    expect(sql).toContain('grid_guard_property_auction_ownership');
    expect(sql).toContain('grid_season_property_state_auction_guard');
    expect(sql).toContain("raise exception 'property_auction_active'");
    expect(sql).toContain("current_setting('grid.auction_settlement_id', true)");
  });

  it('escrows the new leading bid and refunds an outbid leader atomically', () => {
    expect(sql).toContain('credits = credits - v_escrow_delta');
    expect(sql).toContain('credits = credits + v_refund');
    expect(sql).toContain('previous_leader_refunded_credits');
    expect(sql).toContain('v_escrow_delta := p_amount_credits - v_previous_bid');
    expect(sql).toContain("perform public.grid_settle_player_resources(");
  });

  it('enforces reserve, increment, timing, and safe bigint bid math', () => {
    expect(sql).toContain('reserve_credits bigint not null');
    expect(sql).toContain('minimum_bid_increment_credits bigint not null');
    expect(sql).toContain("raise exception 'auction_outside_bid_window'");
    expect(sql).toContain("raise exception 'auction_bid_too_low'");
    expect(sql).toContain("raise exception 'auction_bid_overflow'");
  });

  it('settles a winning escrow into neutral property ownership without charging twice', () => {
    expect(sql).toContain('create or replace function public.grid_settle_property_auction');
    expect(sql).toContain("set_config('grid.auction_settlement_id'");
    expect(sql).toContain('set owner_player_id = v_auction.leading_bidder_player_id');
    expect(sql).toContain("v_sold := v_auction.leading_bidder_player_id is not null");
    expect(sql).not.toContain('credits = credits - v_auction.leading_bid_credits');
  });

  it('records schedule, bid, and settlement in the immutable event ledger', () => {
    expect(sql).toContain("'grid:auction_scheduled'");
    expect(sql).toContain("'grid:auction_bid_placed'");
    expect(sql).toContain("'grid:auction_settled'");
    expect(sql.match(/insert into public\.grid_game_events/g)?.length)
      .toBeGreaterThanOrEqual(3);
    expect(sql).toContain('idempotency_key = p_idempotency_key');
  });

  it('keeps auction mutations service-role only and avoids security definer', () => {
    for (const fn of [
      'grid_schedule_property_auction',
      'grid_place_property_auction_bid',
      'grid_settle_property_auction',
    ]) {
      expect(sql).toContain(`revoke all on function public.${fn}`);
      expect(sql).toContain(`grant execute on function public.${fn}`);
    }
    expect(sql.match(/to service_role;/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).not.toContain('security definer');
  });
});
