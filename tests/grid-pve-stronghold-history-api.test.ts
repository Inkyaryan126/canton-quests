import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const source = fs.readFileSync(
  path.join(process.cwd(), 'app/api/grid/stronghold-contests/[contestId]/history/route.ts'),
  'utf8',
);
describe('Grid PvE stronghold history API', () => {
  it('requires world-read feature and authentication', () => {
    expect(source).toContain('isGridWorldReadEnabled()');
    expect(source).toContain('if (!session.player)');
  });
  it('derives viewer identity from the authenticated player only', () => {
    expect(source).toContain('viewerPlayerId: session.player.id');
    expect(source).not.toMatch(/body\.viewerPlayerId|searchParams.*viewerPlayerId/);
  });
  it('scopes history to the current package city and season', () => {
    expect(source).toContain('cantonFoundingSeasonPackage.city.slug');
    expect(source).toContain('cantonFoundingSeasonPackage.seasonTemplate.slug');
  });
  it('maps missing/unauthorized opaque ids to the same 404 surface', () => {
    expect(source).toContain("error.code === 'INVALID_REQUEST' ? 400 : 404");
  });
});
