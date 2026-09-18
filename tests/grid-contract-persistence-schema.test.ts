import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918070000_grid_contract_progress.sql'),
  'utf8',
);

describe('Grid contract persistence schema', () => {
  it('stores scoped definitions, player progress, replay keys, and durable reward outbox rows', () => {
    expect(sql).toContain('create table public.grid_contract_definitions');
    expect(sql).toContain('create table public.grid_contract_instances');
    expect(sql).toContain('create table public.grid_contract_progress_events');
    expect(sql).toContain('create table public.grid_contract_reward_outbox');
    expect(sql).toContain('unique (city_id, season_id, player_id, contract_id)');
    expect(sql).toContain('unique (season_id, idempotency_key)');
    expect(sql).toContain('unique (progress_event_id, reward_kind)');
  });

  it('makes progress and both reward intents one atomic, server-only RPC', () => {
    expect(sql).toContain('create or replace function public.grid_commit_contract_progress');
    expect(sql).toContain('insert into public.grid_contract_progress_events');
    expect(sql).toContain('insert into public.grid_contract_reward_outbox');
    expect(sql).toContain('update public.grid_contract_instances');
    expect(sql).toContain('revoke all on public.grid_contract_instances from anon, authenticated');
    expect(sql).toContain('grant execute on function public.grid_commit_contract_progress');
    expect(sql).not.toContain('p_reward_intent');
    expect(sql).not.toContain('p_completed boolean');
  });

  it('checks ownership, idempotency collisions, compare-and-swap versions, and malformed deltas', () => {
    expect(sql).toContain('CONTRACT_PLAYER_NOT_FOUND');
    expect(sql).toContain('CONTRACT_IDEMPOTENCY_COLLISION');
    expect(sql).toContain('if v_instance.version <> p_expected_version');
    expect(sql).toContain('CONTRACT_OBJECTIVE_NOT_FOUND');
    expect(sql).toContain('CONTRACT_AMOUNT_INVALID');
    expect(sql).toContain('CONTRACT_CITY_MISMATCH');
    expect(sql).toContain('for update');
  });
});
