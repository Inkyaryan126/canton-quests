import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isGridSeasonArchiveEnabled } from '../lib/grid/server/season-archive-feature-flags';

const route = fs.readFileSync(
  path.join(process.cwd(), 'app/api/admin/grid/season/archive/route.ts'),
  'utf8',
);

describe('Grid season archive admin API contract', () => {
  it('is disabled unless the dedicated destructive-operation flag is enabled', () => {
    expect(isGridSeasonArchiveEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isGridSeasonArchiveEnabled({
        GRID_SEASON_ARCHIVE_ENABLED: '1',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(route).toContain('isGridSeasonArchiveEnabled()');
  });

  it('requires admin auth before any archive work', () => {
    const auth = route.indexOf('resolveAdminSessionFromRequest(request)');
    const archive = route.indexOf('archiveGridSeason(');
    expect(auth).toBeGreaterThanOrEqual(0);
    expect(archive).toBeGreaterThan(auth);
    expect(route).toContain("error: 'Unauthorized'");
  });

  it('requires explicit confirmation of the configured season slug', () => {
    expect(route).toContain('body.confirmSeasonSlug');
    expect(route).toContain('cantonFoundingSeasonPackage.seasonTemplate.slug');
    expect(route).toContain('Season confirmation does not match');
  });

  it('accepts only retry/confirmation metadata and derives season/city/config server-side', () => {
    expect(route).toContain('body.idempotencyKey');
    expect(route).toContain('citySlug: cantonFoundingSeasonPackage.city.slug');
    expect(route).toContain(
      'seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug',
    );
    expect(route).toContain(
      'cantonFoundingSeasonPackage.seasonTemplate.cityPower',
    );
    expect(route).not.toContain('body.seasonId');
    expect(route).not.toContain('body.cityId');
    expect(route).not.toContain('body.standings');
    expect(route).not.toContain('body.playerId');
  });

  it('returns conflict for unresolved gameplay/reward blockers', () => {
    expect(route).toContain('ACTIVE_PVP_CONTESTS');
    expect(route).toContain('ACTIVE_PVE_CONTESTS');
    expect(route).toContain('PENDING_CONTRACT_REWARDS');
    expect(route).toContain('return 409;');
  });

  it('never caches a destructive admin response', () => {
    expect(route).toContain("'Cache-Control', 'no-store, max-age=0'");
  });
});
