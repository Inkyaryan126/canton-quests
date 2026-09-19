import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-season-lifecycle.ts'),
  'utf8',
);

describe('Supabase Grid season lifecycle adapter contract', () => {
  it('resolves city and season identity on the server', () => {
    expect(source).toContain(".from('grid_cities')");
    expect(source).toContain(".eq('slug', citySlug)");
    expect(source).toContain(".from('grid_seasons')");
    expect(source).toContain(".eq('slug', seasonSlug)");
    expect(source).toContain(
      "'id,status,starts_at,surge_starts_at,ends_at'",
    );
  });

  it('writes only through the dedicated atomic lifecycle RPC', () => {
    expect(source).toContain("client.rpc('grid_reconcile_season_lifecycle'");
    expect(source).not.toMatch(/\.from\('grid_seasons'\).*\.update\(/s);
    expect(source).not.toMatch(/\.from\('grid_game_events'\).*\.insert\(/s);
  });

  it('validates persisted response status instead of trusting arbitrary strings', () => {
    expect(source).toContain('STATUSES');
    expect(source).toContain('lifecycleStatus');
    expect(source).toContain('invalid status');
  });
});
