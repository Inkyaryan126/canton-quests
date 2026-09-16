import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function migrationText(): string {
  const file = path.join(
    process.cwd(),
    'supabase/migrations/20260916030000_grid_player_progression.sql',
  );
  return fs.readFileSync(file, 'utf8').toLowerCase();
}

describe('Grid progression schema', () => {
  it('persists both season and lifetime progression snapshots', () => {
    const sql = migrationText();
    expect(sql).toContain('create table public.grid_player_season_progression');
    expect(sql).toContain('create table public.grid_player_lifetime_progression');
    expect(sql).toContain('grid_rating integer');
    expect(sql).toContain('stats jsonb');
    expect(sql).toContain('category_scores jsonb');
    expect(sql).toContain('primary_title text');
  });

  it('indexes the ranking path and prevents client-side score forgery', () => {
    const sql = migrationText();
    expect(sql).toContain('grid_player_season_progression_rank_idx');
    expect(sql).toContain('grid_rating desc');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain(
      'revoke insert, update, delete on public.grid_player_season_progression from anon, authenticated',
    );
    expect(sql).toContain(
      'revoke insert, update, delete on public.grid_player_lifetime_progression from anon, authenticated',
    );
  });

  it('does not create a security-definer public function', () => {
    expect(migrationText()).not.toContain('security definer');
  });
});
