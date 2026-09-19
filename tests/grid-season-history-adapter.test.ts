import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-season-history.ts'),
  'utf8',
);

describe('Supabase Grid season history adapter contract', () => {
  it('resolves city and season server-side and only exposes archived seasons', () => {
    expect(source).toContain(".from('grid_cities')");
    expect(source).toContain(".from('grid_seasons')");
    expect(source).toContain("season.status !== 'archived'");
    expect(source).toContain(".from('grid_season_archives')");
  });

  it('reads immutable final standings in final rank order', () => {
    expect(source).toContain(".from('grid_season_final_standings')");
    expect(source).toContain(
      "'player_id,final_rank,city_power_bps,grid_rating,total_xp'",
    );
    expect(source).toContain(".order('final_rank', { ascending: true })");
    expect(source).not.toContain('city_power_breakdown');
  });

  it('reads public profile labels in bounded chunks', () => {
    expect(source).toContain('PROFILE_CHUNK_SIZE = 200');
    expect(source).toContain(".from('players')");
    expect(source).toContain(".select('id,display_name,avatar_url')");
    expect(source).toContain(".in('id', ids)");
  });

  it('contains no write path', () => {
    expect(source).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(source).not.toContain('.rpc(');
  });
});
