import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260918060000_grid_dynamic_event_instances.sql',
  ),
  'utf8',
);
const adapter = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-dynamic-events.ts'),
  'utf8',
);

describe('Grid dynamic event persistence contract', () => {
  it('stores season-scoped event projections with retry idempotency', () => {
    expect(sql).toContain('create table if not exists public.grid_dynamic_event_instances');
    expect(sql).toContain('unique (season_id, instance_key)');
    expect(sql).toContain('unique (season_id, idempotency_key)');
    expect(sql).toContain('check (ends_at > starts_at)');
    expect(sql).toContain("jsonb_typeof(modifiers) = 'array'");
  });

  it('starts projection and immutable ledger event in one database function', () => {
    expect(sql).toContain('create or replace function public.grid_start_dynamic_event_instance');
    expect(sql).toContain('insert into public.grid_dynamic_event_instances');
    expect(sql).toContain('insert into public.grid_game_events');
    expect(sql).toContain("'grid:dynamic_event_started'");
    expect(sql).toContain("'dynamic-event:' || btrim(p_idempotency_key)");
  });

  it('keeps writes behind service-role authority', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toContain(
      'revoke all on public.grid_dynamic_event_instances from anon, authenticated',
    );
    expect(sql).toContain('security definer');
    expect(sql).toContain('to service_role');
  });

  it('queries only active instances for the resolved city and season', () => {
    expect(adapter).toContain(".from('grid_dynamic_event_instances')");
    expect(adapter).toContain(".eq('city_id', cityId)");
    expect(adapter).toContain(".eq('season_id', seasonId)");
    expect(adapter).toContain(".lte('starts_at', now)");
    expect(adapter).toContain(".gt('ends_at', now)");
    expect(adapter).toContain(".rpc('grid_start_dynamic_event_instance'");
  });
});
