import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
}
const list = read('app/api/grid/stronghold-contests/route.ts');
const detail = read('app/api/grid/stronghold-contests/[contestId]/route.ts');
describe('Grid PvE stronghold read API', () => {
  it('requires authentication and the world-read feature for both endpoints', () => {
    for (const source of [list, detail]) {
      expect(source).toContain('isGridWorldReadEnabled()');
      expect(source).toContain('if (!session.player)');
      expect(source).toContain('Authentication required.');
    }
  });
  it('passes the authenticated player into list/detail authorization', () => {
    expect(list).toContain('session.player.id');
    expect(detail).toContain('viewerPlayerId: session.player.id');
  });
  it('uses current package city/season scoping rather than client-provided scope ids', () => {
    for (const source of [list, detail]) {
      expect(source).toContain('cantonFoundingSeasonPackage.city.slug');
      expect(source).toContain('cantonFoundingSeasonPackage.seasonTemplate.slug');
      expect(source).not.toContain('body.cityId');
      expect(source).not.toContain('body.seasonId');
    }
  });
  it('returns 404 for both missing and unauthorized opaque contest ids', () => {
    expect(detail).toContain("error.code === 'INVALID_REQUEST' ? 400 : 404");
  });
});
