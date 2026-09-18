import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-npc-stronghold-definition-admin.ts'),
  'utf8',
);
describe('Supabase Grid NPC stronghold definition admin adapter', () => {
  it('resolves operator slugs to canonical city/season/territory/landmark ids', () => {
    expect(source).toContain(".from('grid_cities')");
    expect(source).toContain(".from('grid_seasons')");
    expect(source).toContain(".from('grid_territories')");
    expect(source).toContain(".from('grid_landmarks')");
    expect(source).toContain('landmark.territory_id !== territoryId');
  });
  it('uses only dedicated definition mutation RPCs', () => {
    expect(source).toContain("db.rpc('grid_upsert_npc_stronghold_definition'");
    expect(source).toContain("'grid_set_npc_stronghold_definition_enabled'");
  });
  it('lists all definitions and annotates contest-history/active state for operators', () => {
    expect(source).toContain(".from('grid_npc_stronghold_definitions')");
    expect(source).toContain(".from('grid_pve_stronghold_contests')");
    expect(source).toContain('hasContestHistory: history.has');
    expect(source).toContain('activeContest: active.has');
  });
});
