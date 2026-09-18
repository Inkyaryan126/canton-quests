import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function sql(): string {
  const file = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260916052000_grid_progression_projection_rebuild.sql',
  );
  if (!fs.existsSync(file)) throw new Error('Grid progression projection migration not found');
  return fs.readFileSync(file, 'utf8').toLowerCase();
}

describe('GRID progression projection rebuild SQL contract', () => {
  it('adds monotonic event-set and policy source guards to both projections', () => {
    const text = sql();
    for (const table of ['grid_player_season_progression', 'grid_player_lifetime_progression']) {
      expect(text).toContain(`alter table public.${table}`);
    }
    expect(text).toContain('source_event_count');
    expect(text).toContain('source_event_fingerprint');
    expect(text).toContain('policy_fingerprint');
    expect(text).toContain('source_last_event_at');
  });

  it('defines server-only season and lifetime projection replacement RPCs', () => {
    const text = sql();
    expect(text).toContain('create or replace function public.grid_replace_season_progression_projection');
    expect(text).toContain('create or replace function public.grid_replace_lifetime_progression_projection');
    expect(text.match(/security invoker/g)?.length).toBeGreaterThanOrEqual(2);
    expect(text.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(2);
    expect(text).not.toContain('security definer');
    expect(text).toContain('from public, anon, authenticated');
    expect(text).toContain('to service_role');
  });

  it('rejects stale rebuilds and detects equal-count event-set divergence', () => {
    const text = sql();
    expect(text).toContain('if v_existing_event_count > p_source_event_count then');
    expect(text).toContain("raise exception 'progression_projection_divergence'");
    expect(text).toContain('v_existing_event_fingerprint <> p_source_event_fingerprint');
  });

  it('allows policy changes over the same immutable event set', () => {
    const text = sql();
    expect(text).toContain('policy_fingerprint = excluded.policy_fingerprint');
    expect(text).not.toContain("raise exception 'progression_policy_changed'");
  });

  it('validates snapshot shape and bounded derived fields before persistence', () => {
    const text = sql();
    expect(text).toContain("jsonb_typeof(p_snapshot) <> 'object'");
    expect(text).toContain("jsonb_typeof(p_snapshot -> 'stats') <> 'object'");
    expect(text).toContain("jsonb_typeof(p_snapshot -> 'categoryscores') <> 'object'");
    expect(text).toContain("jsonb_typeof(p_snapshot -> 'titles') <> 'array'");
    expect(text).toContain("raise exception 'progression_snapshot_invalid'");
    expect(text).toContain('between 0 and 10000');
  });
});
