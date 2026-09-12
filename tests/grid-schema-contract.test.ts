import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function migrationText(): string {
  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  const file = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('_grid_foundation.sql'))
    .sort()
    .at(-1);

  if (!file) throw new Error('grid_foundation migration not found');
  return fs.readFileSync(path.join(dir, file), 'utf8').toLowerCase();
}

function hardeningMigrationText(): string {
  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  const file = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('_grid_foundation_hardening.sql'))
    .sort()
    .at(-1);

  if (!file) throw new Error('grid_foundation_hardening migration not found');
  return fs.readFileSync(path.join(dir, file), 'utf8').toLowerCase();
}

describe('Grid foundation migration contract', () => {
  it('creates the required isolated Grid tables', () => {
    const sql = migrationText();

    for (const table of [
      'grid_cities',
      'grid_seasons',
      'grid_districts',
      'grid_territories',
      'grid_territory_edges',
      'grid_properties',
      'grid_landmarks',
      'grid_player_profiles',
      'grid_player_season_state',
      'grid_game_events',
    ]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('uses PostGIS and makes event history immutable', () => {
    const sql = migrationText();

    expect(sql).toContain('create extension if not exists postgis');
    expect(sql).toContain('using gist');
    expect(sql).toContain('grid_reject_game_event_mutation');
    expect(sql).toContain('before update or delete on public.grid_game_events');
  });

  it('never creates a security-definer public function', () => {
    const sql = migrationText();

    expect(sql).not.toContain('security definer');
  });
});

describe('Grid foundation hardening migration contract', () => {
  it('closes the global (null season_id) idempotency-key gap', () => {
    const sql = hardeningMigrationText();

    expect(sql).toContain('grid_game_events_idempotency_uq');
    expect(sql).toContain('nulls not distinct');
  });

  it('structurally prevents a territory edge from spanning two cities', () => {
    const sql = hardeningMigrationText();

    expect(sql).toContain('grid_territories_id_city_uq unique (id, city_id)');
    expect(sql).toContain('references public.grid_territories(id, city_id)');
  });

  it('never creates a security-definer public function', () => {
    const sql = hardeningMigrationText();

    expect(sql).not.toContain('security definer');
  });
});
