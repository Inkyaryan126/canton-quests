import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function migrationText(): string {
  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  const file = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('_grid_season_economy.sql'))
    .sort()
    .at(-1);

  if (!file) throw new Error('grid_season_economy migration not found');
  return fs.readFileSync(path.join(dir, file), 'utf8').toLowerCase();
}

describe('GRID season economy schema contract', () => {
  it('creates season-scoped territory and property state with unique ownership rows', () => {
    const sql = migrationText();
    expect(sql).toContain('create table public.grid_season_territory_state');
    expect(sql).toContain('unique (season_id, territory_id)');
    expect(sql).toContain('create table public.grid_season_property_state');
    expect(sql).toContain('unique (season_id, property_id)');
  });
  it('structurally enforces season-city and asset-city consistency', () => {
    const sql = migrationText();
    expect(sql).toContain('grid_seasons_id_city_uq unique (id, city_id)');
    expect(sql).toContain('grid_properties_id_city_uq unique (id, city_id)');
    expect(sql).toContain('references public.grid_seasons(id, city_id)');
    expect(sql).toContain('references public.grid_territories(id, city_id)');
    expect(sql).toContain('references public.grid_properties(id, city_id)');
  });

  it('constrains development branch, level, and condition', () => {
    const sql = migrationText();
    for (const branch of ['commerce', 'influence', 'fortress', 'intel', 'prestige']) {
      expect(sql).toContain(`'${branch}'`);
    }
    expect(sql).toContain('check (development_level >= 0)');
    expect(sql).toContain('check (condition_bps between 0 and 10000)');
    expect(sql).toContain('(development_level = 0 and development_branch is null)');
    expect(sql).toContain('(development_level > 0 and development_branch is not null)');
  });
  it('adds deterministic resource settlement remainder state', () => {
    const sql = migrationText();
    expect(sql).toContain('resources_settled_at timestamptz not null default now()');
    expect(sql).toContain('credits_accrual_remainder integer not null default 0');
    expect(sql).toContain('credits_accrual_remainder < 3600000');
    expect(sql).toContain('influence_accrual_remainder integer not null default 0');
    expect(sql).toContain('influence_accrual_remainder < 3600000');
  });

  it('enables RLS and denies browser mutations on new state tables', () => {
    const sql = migrationText();
    for (const table of ['grid_season_territory_state', 'grid_season_property_state']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke insert, update, delete on public.${table} from anon, authenticated`);
    }
  });

  it('does not introduce a security-definer public function', () => {
    expect(migrationText()).not.toContain('security definer');
  });
});
