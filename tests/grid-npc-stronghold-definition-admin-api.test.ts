import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
}
const route = read('app/api/admin/grid/strongholds/route.ts');
const enabled = read('app/api/admin/grid/strongholds/[strongholdId]/enabled/route.ts');
describe('Grid NPC stronghold definition admin API', () => {
  it('requires canonical admin auth and the Grid runtime feature on every action', () => {
    for (const source of [route, enabled]) {
      expect(source).toContain('resolveAdminSessionFromRequest(request)');
      expect(source).toContain('isGridWorldReadEnabled()');
      expect(source).toContain('Unauthorized');
    }
  });
  it('provides operator list and explicit configuration mutation without defaults', () => {
    expect(route).toContain('listGridNpcStrongholdDefinitionsForAdmin');
    expect(route).toContain('upsertGridNpcStrongholdDefinition');
    expect(route).toContain("text(body.strongholdId, 'strongholdId')");
    expect(route).toContain("integer(body.baseGarrisonInfluence, 'baseGarrisonInfluence')");
    expect(route).not.toMatch(/baseGarrisonInfluence:\s*\d/);
  });
  it('keeps enabled state a separate explicit operation', () => {
    expect(enabled).toContain('setGridNpcStrongholdDefinitionEnabled');
    expect(enabled).toContain("typeof body.enabled !== 'boolean'");
    expect(enabled).toContain('strongholdId: params.strongholdId');
  });
  it('marks admin responses no-store', () => {
    expect(route).toContain("Cache-Control', 'no-store, max-age=0'");
    expect(enabled).toContain("Cache-Control', 'no-store, max-age=0'");
  });
});
