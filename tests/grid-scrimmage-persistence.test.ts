import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSupabaseGridScrimmagePort } from '../lib/grid/server/supabase-scrimmage';

const sql = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260916063000_grid_scrimmage_sessions.sql',
    ),
    'utf8',
  )
  .toLowerCase();

const matchSql = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260916080000_grid_scrimmage_match_state.sql',
    ),
    'utf8',
  )
  .toLowerCase();

const adapter = fs.readFileSync(
  path.join(
    process.cwd(),
    'lib/grid/server/supabase-scrimmage.ts',
  ),
  'utf8',
);

describe('GRID scrimmage persistence', () => {
  it('stores scrimmages in an isolated session-only table', () => {
    expect(sql).toContain(
      'create table public.grid_scrimmage_sessions',
    );
    expect(sql).toContain(
      "check (progression_scope = 'session-only')",
    );
    expect(sql).toContain(
      'references public.grid_cities(id)',
    );
    expect(sql).toContain(
      'references public.players(id)',
    );
  });

  it('caps the persisted small-group roster and validates lifecycle states', () => {
    expect(sql).toContain(
      'jsonb_array_length(participants) between 1 and 12',
    );
    expect(sql).toContain(
      "status in ('lobby', 'active', 'completed', 'cancelled')",
    );
    expect(sql).toContain(
      "status = 'active' and started_at is not null and ended_at is null",
    );
  });

  it('allows invite-code reuse only after the old session has ended', () => {
    expect(sql).toContain(
      'create unique index grid_scrimmage_active_invite_code_uq',
    );
    expect(sql).toContain(
      "where status in ('lobby', 'active')",
    );
  });

  it('keeps the table behind the trusted server boundary', () => {
    expect(sql).toContain(
      'alter table public.grid_scrimmage_sessions enable row level security',
    );
    expect(sql).toContain(
      'revoke all on public.grid_scrimmage_sessions from public, anon, authenticated',
    );
  });

  it('persists combat state only inside the isolated scrimmage row', () => {
    expect(matchSql).toContain('add column match_state jsonb');
    expect(matchSql).toContain('grid_scrimmage_match_state_shape_ck');
    expect(matchSql).toContain("status <> 'active'");
    expect(matchSql).not.toMatch(
      /(?:insert into|update)\s+public\.(?:grid_player_season_state|grid_territory_control)/,
    );
    expect(matchSql).not.toMatch(/(?:credits|xp)\s*=/);
    expect(adapter).toContain('match_state: state.match');
    expect(adapter).toContain('match_state: row.match_state');
  });

  it('uses revision compare-and-swap instead of blind session updates', () => {
    expect(adapter).toContain(".eq('id', sessionId)");
    expect(adapter).toContain(
      ".eq('revision', expectedRevision)",
    );
    expect(adapter).toContain(
      "return { updated: false, state: null }",
    );
  });

  it('only resolves active invite codes when players join by code', () => {
    expect(adapter).toContain(
      ".in('status', ['lobby', 'active'])",
    );
  });

  it('requires service-role configuration for persistence', () => {
    expect(() =>
      createSupabaseGridScrimmagePort(null as any),
    ).toThrow(
      'Grid scrimmage persistence requires Supabase service-role configuration',
    );
  });
});
