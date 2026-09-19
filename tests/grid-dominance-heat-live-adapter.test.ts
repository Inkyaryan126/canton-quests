import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-dominance-heat.ts'),
  'utf8',
);

describe('Supabase live Dominance Heat adapter contract', () => {
  it('resolves the configured city and season server-side', () => {
    expect(source).toContain(".from('grid_cities')");
    expect(source).toContain(".eq('slug', pkg.city.slug)");
    expect(source).toContain(".from('grid_seasons')");
    expect(source).toContain(".eq('slug', pkg.seasonTemplate.slug)");
  });

  it('counts eligible Canton territories and only the viewer-owned territory state', () => {
    expect(source).toContain(".from('grid_territories')");
    expect(source).toContain("count: 'exact'");
    expect(source).toContain(".eq('city_id', cityId)");
    expect(source).toContain(".from('grid_season_territory_state')");
    expect(source).toContain(".eq('owner_player_id', playerId)");
  });

  it('builds alliance concentration from active membership and member-owned territories', () => {
    expect(source).toContain(".from('grid_alliance_memberships')");
    expect(source).toContain(".is('left_at', null)");
    expect(source).toContain(".from('grid_alliances')");
    expect(source).toContain("allianceRow.status !== 'active'");
    expect(source).toContain(".in('owner_player_id', memberIds)");
  });

  it('contains no mutation path and does not read rival public profiles', () => {
    expect(source).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
    expect(source).not.toContain(".from('players')");
    expect(source).not.toContain('display_name');
    expect(source).not.toContain('avatar_url');
  });
});
