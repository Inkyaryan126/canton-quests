import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-npc-stronghold-registry.ts'),
  'utf8',
);
describe('Supabase Grid NPC stronghold registry adapter', () => {
  it('reads only enabled definitions for the resolved season/city', () => {
    expect(source).toContain(".from('grid_npc_stronghold_definitions')");
    expect(source).toContain(".eq('enabled', true)");
    expect(source).toContain(".eq('season_id', season.id)");
    expect(source).toContain(".eq('city_id', city.id)");
  });
  it('resolves database ids back to package-compatible territory/landmark slugs', () => {
    expect(source).toContain(".from('grid_territories')");
    expect(source).toContain(".from('grid_landmarks')");
    expect(source).toContain('territorySlug: territory.slug');
    expect(source).toContain('landmarkSlug: landmark.slug');
  });
  it('derives captured state from completed PvE contests', () => {
    expect(source).toContain(".from('grid_pve_stronghold_contests')");
    expect(source).toContain(".eq('status', 'captured')");
    expect(source).toContain('capturedStrongholdIds');
  });
});
