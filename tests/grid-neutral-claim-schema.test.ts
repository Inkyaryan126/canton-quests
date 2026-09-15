import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function sql(): string {
  const file = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260914170000_grid_neutral_claims.sql',
  );
  if (!fs.existsSync(file)) throw new Error('Grid neutral claim migration not found');
  return fs.readFileSync(file, 'utf8').toLowerCase();
}

describe('GRID neutral claim SQL contract', () => {
  it('defines a service-role-only security-invoker claim RPC', () => {
    const text = sql();
    expect(text).toContain('create or replace function public.grid_claim_neutral_territory');
    expect(text).toContain('security invoker');
    expect(text).toContain("set search_path = ''");
    expect(text).not.toContain('security definer');
    expect(text).toContain('revoke all on function public.grid_claim_neutral_territory');
    expect(text).toContain('from public, anon, authenticated');
    expect(text).toContain('to service_role');
  });

  it('locks season, target territory, player state, and ownership state transactionally', () => {
    const text = sql();
    expect(text.match(/for update/g)?.length).toBeGreaterThanOrEqual(4);
    expect(text).toContain('grid_settle_player_resources');
    expect(text).toContain("'preclaim:' || p_idempotency_key");
  });

  it('enforces starter-first and adjacency-after-first rules', () => {
    const text = sql();
    expect(text).toContain('starterterritoryslugs');
    expect(text).toContain("raise exception 'territory_not_starter_eligible'");
    expect(text).toContain('public.grid_territory_edges');
    expect(text).toContain("raise exception 'territory_not_adjacent'");
  });

  it('rejects occupied/wrong-city targets and insufficient configured resources', () => {
    const text = sql();
    expect(text).toContain("raise exception 'territory_wrong_city'");
    expect(text).toContain("raise exception 'territory_not_neutral'");
    expect(text).toContain("raise exception 'insufficient_credits'");
    expect(text).toContain("raise exception 'insufficient_command_points'");
  });

  it('updates wallet and ownership before appending the immutable claim event', () => {
    const text = sql();
    expect(text).toContain('update public.grid_player_season_state');
    expect(text).toContain('update public.grid_season_territory_state');
    expect(text).toContain("'grid:territory_claimed'");
    expect(text).toContain('insert into public.grid_game_events');
  });

  it('checks the claim idempotency event before charging', () => {
    const text = sql();
    expect(text.indexOf('idempotency_key = p_idempotency_key')).toBeGreaterThan(-1);
    expect(text.indexOf('idempotency_key = p_idempotency_key')).toBeLessThan(
      text.indexOf('grid_settle_player_resources'),
    );
  });
});
