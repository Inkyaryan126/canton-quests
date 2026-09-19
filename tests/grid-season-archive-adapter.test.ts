import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-season-archive.ts'),
  'utf8',
);

describe('Supabase Grid season archive adapter contract', () => {
  it('starts candidate discovery from every joined season player', () => {
    expect(source).toContain(".from('grid_player_season_state')");
    expect(source).toContain(".select('player_id')");
    expect(source).toContain(".eq('season_id', seasonId)");
  });

  it('left-fills players without progression using a zero snapshot', () => {
    expect(source).toContain(".from('grid_player_season_progression')");
    expect(source).toContain("buildGridProgressionSnapshot({}, 0)");
    expect(source).toContain('progressionByPlayerId.get(playerId)');
  });

  it('paginates both season-state and progression reads', () => {
    expect(source.match(/\.range\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain('PAGE_SIZE = 500');
  });

  it('persists only through the dedicated atomic archive RPC', () => {
    expect(source).toContain("db.rpc('grid_archive_season'");
    expect(source).not.toMatch(/\.from\('grid_season_archives'\).*\.(insert|update|upsert)/s);
    expect(source).not.toMatch(/\.from\('grid_season_final_standings'\).*\.(insert|update|upsert)/s);
  });
});
