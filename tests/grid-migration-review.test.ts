import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { reviewGridMigrations } from '../scripts/grid-migration-review';

const tempDirs: string[] = [];
function tempMigrations(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-migration-review-'));
  tempDirs.push(dir);
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
  return dir;
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const FOUNDATION = `
create table public.grid_game_events (id uuid primary key);
create or replace function public.grid_reject_game_event_mutation() returns trigger language plpgsql as $$ begin return null; end; $$;
`;

const SAFE_DEFINER = `
create or replace function public.grid_safe_command() returns void
language plpgsql
security definer
set search_path = public, extensions
as $$ begin return; end; $$;
revoke all on function public.grid_safe_command() from public, anon, authenticated;
grant execute on function public.grid_safe_command() to service_role;
`;

describe('Grid production migration review', () => {
  it('passes the repository Grid migrations at the current checkpoint', () => {
    const report = reviewGridMigrations(path.join(process.cwd(), 'supabase/migrations'));
    expect(report.gridMigrationCount).toBeGreaterThan(10);
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('rejects duplicate migration versions even when the collision is non-Grid', () => {
    const report = reviewGridMigrations(tempMigrations({
      '20260912000000_grid_foundation.sql': FOUNDATION,
      '20260913000000_grid_feature.sql': SAFE_DEFINER,
      '20260913000000_other_feature.sql': 'select 1;',
    }));
    expect(report.issues.some((issue) => issue.code === 'duplicate-migration-version')).toBe(true);
  });

  it('requires Grid foundation to be the earliest Grid migration', () => {
    const report = reviewGridMigrations(tempMigrations({
      '20260911000000_grid_feature.sql': 'select 1;',
      '20260912000000_grid_foundation.sql': FOUNDATION,
    }));
    expect(report.issues.some((issue) => issue.code === 'foundation-order')).toBe(true);
  });

  it('rejects SECURITY DEFINER functions without pinned search_path or service-role isolation', () => {
    const report = reviewGridMigrations(tempMigrations({
      '20260912000000_grid_foundation.sql': FOUNDATION,
      '20260913000000_grid_unsafe.sql': `
        create or replace function public.grid_unsafe() returns void
        language plpgsql security definer as $$ begin return; end; $$;
        grant execute on function public.grid_unsafe() to authenticated;
      `,
    }));
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'security-definer-missing-search-path',
      'security-definer-browser-executable',
      'security-definer-missing-service-role',
    ]));
  });

  it('accepts a locked-down SECURITY DEFINER function', () => {
    const report = reviewGridMigrations(tempMigrations({
      '20260912000000_grid_foundation.sql': FOUNDATION,
      '20260913000000_grid_safe.sql': SAFE_DEFINER,
    }));
    expect(report.issues).toEqual([]);
  });

  it('rejects direct ledger mutation and attempts to weaken append-only protection', () => {
    const report = reviewGridMigrations(tempMigrations({
      '20260912000000_grid_foundation.sql': FOUNDATION,
      '20260913000000_grid_bad_ledger.sql': `
        update public.grid_game_events set event_type = 'rewritten';
        alter table public.grid_game_events disable trigger all;
      `,
    }));
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'ledger-direct-mutation',
      'ledger-append-only-protection-weakened',
    ]));
  });

  it('allows normal append-only event inserts', () => {
    const report = reviewGridMigrations(tempMigrations({
      '20260912000000_grid_foundation.sql': FOUNDATION,
      '20260913000000_grid_event.sql': `insert into public.grid_game_events (id) values (gen_random_uuid());`,
    }));
    expect(report.issues).toEqual([]);
  });
});
