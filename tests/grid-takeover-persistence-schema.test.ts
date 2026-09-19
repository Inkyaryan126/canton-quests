import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonEconomy } from '../lib/grid/cities/canton/founding-season-economy';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260919014736_grid_takeover_persistence.sql'),
  'utf8',
);

describe('Grid takeover persistence schema', () => {
  it('keeps Canton takeover balance explicit and non-speculative', () => {
    expect(cantonFoundingSeasonEconomy.takeover).toEqual({
      developmentRetentionBps: 10_000,
      conditionDamageBps: 0,
      conditionFloorBps: 0,
    });
  });

  it('installs a security-invoker territory ownership trigger with restricted execution', () => {
    expect(migration).toContain('create or replace function public.grid_apply_territory_takeover_properties()');
    expect(migration).toContain('returns trigger');
    expect(migration).toContain('security invoker');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('after update of owner_player_id');
    expect(migration).toContain('on public.grid_season_territory_state');
    expect(migration).toContain('execute function public.grid_apply_territory_takeover_properties()');
    expect(migration).toContain('revoke all on function public.grid_apply_territory_takeover_properties()');
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('grant execute on function public.grid_apply_territory_takeover_properties()');
    expect(migration).toContain('to service_role');
    expect(migration).not.toContain('security definer');
  });

  it('fires only for player-to-player territory ownership changes and requires a capture timestamp', () => {
    expect(migration).toContain('old.owner_player_id is null');
    expect(migration).toContain('new.owner_player_id is null');
    expect(migration).toContain('new.owner_player_id is not distinct from old.owner_player_id');
    expect(migration).toContain("raise exception 'TAKEOVER_TIMESTAMP_REQUIRED'");
  });

  it('reads and bounds the season takeover policy instead of hardcoding damage in SQL', () => {
    expect(migration).toContain("v_takeover := v_season.config -> 'economy' -> 'takeover'");
    expect(migration).toContain("raise exception 'TAKEOVER_NOT_CONFIGURED'");
    expect(migration).toContain("v_takeover ->> 'developmentRetentionBps'");
    expect(migration).toContain("v_takeover ->> 'conditionDamageBps'");
    expect(migration).toContain("v_takeover ->> 'conditionFloorBps'");
    expect(migration).toContain('v_development_retention_bps > 10000');
    expect(migration).toContain('v_condition_damage_bps > 10000');
    expect(migration).toContain('v_condition_floor_bps > 10000');
  });

  it('transfers only the defeated owner properties inside the captured territory', () => {
    expect(migration).toContain('property.territory_id = new.territory_id');
    expect(migration).toContain('state.owner_player_id = old.owner_player_id');
    expect(migration).toContain('set owner_player_id = new.owner_player_id');
    expect(migration).toContain('acquired_at = new.claimed_at');
    expect(migration).toContain('development_level = v_retained_level');
    expect(migration).toContain("development_branch = case when v_retained_level = 0 then null");
    expect(migration).toContain('condition_bps = v_after_condition_bps');
  });

  it('uses the same deterministic damage arithmetic as takeover core', () => {
    expect(migration).toContain('(v_property_state.development_level::bigint * v_development_retention_bps) / 10000');
    expect(migration).toContain('greatest(v_condition_floor_bps, v_property_state.condition_bps - v_condition_damage_bps)');
    expect(migration).toContain('least(v_property_state.condition_bps,');
  });

  it('cancels stale fixed-price listings owned by the defeated player', () => {
    expect(migration).toContain('update public.grid_market_fixed_price_listings');
    expect(migration).toContain("set status = 'cancelled'");
    expect(migration).toContain('seller_player_id = old.owner_player_id');
    expect(migration).toContain("status = 'open'");
    expect(migration).toContain('cancelled_at = new.claimed_at');
  });

  it('appends a single immutable audit event with applied policy and per-property changes', () => {
    expect(migration).toContain("'grid:takeover_properties_applied'");
    expect(migration).toContain("'previousOwnerPlayerId', old.owner_player_id");
    expect(migration).toContain("'newOwnerPlayerId', new.owner_player_id");
    expect(migration).toContain("'propertyChanges', v_property_changes");
    expect(migration).toContain("'fixedListingsCancelled', v_fixed_listings_cancelled");
    expect(migration).toContain("'developmentRetentionBps', v_development_retention_bps");
  });

  it('backfills the neutral Canton policy without overwriting an existing explicit policy', () => {
    expect(migration).toContain("city.slug = 'canton-oh'");
    expect(migration).toContain("season.slug = 'founding-season'");
    expect(migration).toContain("season.config #> '{economy,takeover}' is null");
    expect(migration).toContain("'{economy,takeover}'");
    expect(migration).toContain("'developmentRetentionBps', 10000");
    expect(migration).toContain("'conditionDamageBps', 0");
    expect(migration).toContain("'conditionFloorBps', 0");
  });
});
