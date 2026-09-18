import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-pve-stronghold-read.ts'),
  'utf8',
);
describe('Supabase Grid PvE stronghold read adapter', () => {
  it('scopes reads to configured city and season', () => {
    expect(source).toContain(".from('grid_cities')");
    expect(source).toContain(".eq('slug', options.citySlug)");
    expect(source).toContain(".from('grid_seasons')");
    expect(source).toContain(".eq('slug', options.seasonSlug)");
    expect(source).toContain(".eq('season_id', scope.seasonId)");
    expect(source).toContain(".eq('city_id', scope.cityId)");
  });
  it('filters active discovery by attacker player id at the database boundary', () => {
    expect(source).toContain(".eq('attacker_player_id', playerId)");
    expect(source).toContain(".eq('status', 'active')");
  });
  it('hydrates internal territory ids to slugs before returning rows', () => {
    expect(source).toContain(".from('grid_territories')");
    expect(source).toContain(".select('id,slug')");
    expect(source).toContain('sourceTerritorySlug');
    expect(source).toContain('targetTerritorySlug');
  });
  it('uses maybeSingle for detail so missing opaque ids are normal not-found state', () => {
    expect(source).toContain('.maybeSingle()');
  });
});
