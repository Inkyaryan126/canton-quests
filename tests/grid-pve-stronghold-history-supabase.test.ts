import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSupabaseGridPveStrongholdHistoryPort } from '../lib/grid/server/supabase-pve-stronghold-history';
const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-pve-stronghold-history.ts'),
  'utf8',
);
describe('Supabase Grid PvE stronghold history adapter', () => {
  it('scopes contest context to configured city and season', () => {
    expect(source).toContain(".eq('city_id', scope.cityId)");
    expect(source).toContain(".eq('season_id', scope.seasonId)");
    expect(source).toContain(".from('grid_pve_stronghold_contests')");
  });
  it('reads only PvE-contest ledger event types for the contest and season', () => {
    expect(source).toContain(".eq('entity_type', 'pve_stronghold_contest')");
    expect(source).toContain(".eq('entity_id', contestId)");
    expect(source).toContain(".eq('season_id', seasonId)");
    expect(source).toContain(".in('event_type', [...GRID_PVE_STRONGHOLD_HISTORY_EVENT_TYPES])");
  });
  it('does not select actor ids or idempotency keys from history events', () => {
    expect(source).toContain(".select('id,event_type,payload,created_at')");
    expect(source).not.toMatch(/select\([^)]*actor_player_id[^)]*\)/s);
    expect(source).not.toMatch(/select\([^)]*idempotency_key[^)]*\)/s);
  });
  it('requires service-role configuration', () => {
    expect(() => createSupabaseGridPveStrongholdHistoryPort({
      client: null, citySlug: 'canton-oh', seasonSlug: 'founding-season',
    })).toThrow('Grid PvE stronghold history requires Supabase service-role configuration');
  });
});
