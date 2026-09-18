import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const baseSql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918070000_grid_contract_progress.sql'),
  'utf8',
);
const additiveSql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918090000_grid_contract_persistence.sql'),
  'utf8',
);

describe('Grid contract persistence schema', () => {
  it('stores scoped definitions, player progress, replay keys, and durable reward outbox rows', () => {
    expect(baseSql).toContain('create table public.grid_contract_definitions');
    expect(baseSql).toContain('create table public.grid_contract_instances');
    expect(baseSql).toContain('create table public.grid_contract_progress_events');
    expect(baseSql).toContain('create table public.grid_contract_reward_outbox');
    expect(baseSql).toContain('unique (city_id, season_id, player_id, contract_id)');
    expect(baseSql).toContain('unique (season_id, idempotency_key)');
    expect(baseSql).toContain('unique (progress_event_id, reward_kind)');
    expect(additiveSql).toContain('add column if not exists reward_key text');
    expect(additiveSql).toContain('create trigger grid_contract_reward_key');
    expect(additiveSql).toContain('grid_contract_reward_outbox_reward_key_uq');
    expect(additiveSql).toContain('grid_contract_reward_outbox_contract_reward_uq');
  });

  it('makes progress and both reward intents one atomic, server-only RPC', () => {
    expect(baseSql).toContain('create or replace function public.grid_commit_contract_progress');
    expect(baseSql).toContain('insert into public.grid_contract_progress_events');
    expect(baseSql).toContain('insert into public.grid_contract_reward_outbox');
    expect(baseSql).toContain('update public.grid_contract_instances');
    expect(baseSql).toContain('revoke all on public.grid_contract_instances from anon, authenticated');
    expect(baseSql).toContain('grant execute on function public.grid_commit_contract_progress');
    expect(baseSql).not.toContain('p_reward_intent');
    expect(baseSql).not.toContain('p_completed boolean');
    expect(additiveSql).toContain('revoke all on public.grid_contract_reward_outbox from anon, authenticated');
  });

  it('checks ownership, idempotency collisions, compare-and-swap versions, and malformed deltas', () => {
    expect(baseSql).toContain('CONTRACT_PLAYER_NOT_FOUND');
    expect(baseSql).toContain('CONTRACT_IDEMPOTENCY_COLLISION');
    expect(baseSql).toContain('if v_instance.version <> p_expected_version');
    expect(baseSql).toContain('CONTRACT_OBJECTIVE_NOT_FOUND');
    expect(baseSql).toContain('CONTRACT_AMOUNT_INVALID');
    expect(baseSql).toContain('CONTRACT_CITY_MISMATCH');
    expect(baseSql).toContain('for update');
  });
});
