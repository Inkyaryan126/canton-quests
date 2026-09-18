import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSupabaseGridNpcStrongholdRuntimeAdminScopePort } from '../lib/grid/server/supabase-npc-stronghold-runtime-admin';
const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-npc-stronghold-runtime-admin.ts'),
  'utf8',
);
describe('Supabase Grid NPC runtime admin scope', () => {
  it('resolves only server-configured city/season slugs to ids', () => {
    expect(source).toContain(".from('grid_cities')");
    expect(source).toContain(".eq('slug', options.citySlug)");
    expect(source).toContain(".from('grid_seasons')");
    expect(source).toContain(".eq('slug', options.seasonSlug)");
    expect(source).toContain(".eq('city_id', city.id)");
  });
  it('rejects missing service-role configuration', () => {
    expect(() => createSupabaseGridNpcStrongholdRuntimeAdminScopePort({
      client: null, citySlug: 'canton-oh', seasonSlug: 'founding-season',
    })).toThrow('requires Supabase service-role configuration');
  });
});
