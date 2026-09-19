import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const route = fs.readFileSync(
  path.join(
    process.cwd(),
    'app/api/admin/grid/season/reconcile/route.ts',
  ),
  'utf8',
);

describe('Grid season lifecycle admin API contract', () => {
  it('requires admin authentication before reconciliation', () => {
    const auth = route.indexOf('resolveAdminSessionFromRequest(request)');
    const reconcile = route.indexOf('reconcileGridSeasonLifecycle(');
    expect(auth).toBeGreaterThanOrEqual(0);
    expect(reconcile).toBeGreaterThan(auth);
    expect(route).toContain("error: 'Unauthorized'");
  });

  it('stays unavailable while Grid runtime reads are disabled', () => {
    expect(route).toContain('isGridWorldReadEnabled()');
    expect(route).toContain("error: 'Grid runtime is not enabled.'");
  });

  it('derives city, season, and Surge duration from the configured package', () => {
    expect(route).toContain('cantonFoundingSeasonPackage.city.slug');
    expect(route).toContain(
      'cantonFoundingSeasonPackage.seasonTemplate.slug',
    );
    expect(route).toContain(
      'cantonFoundingSeasonPackage.seasonTemplate.surgeHours',
    );
    expect(route).not.toContain('request.json');
    expect(route).not.toContain('body.');
  });

  it('uses server time and never accepts caller-supplied target status', () => {
    expect(route).toContain('now: new Date().toISOString()');
    expect(route).not.toContain('targetStatus');
    expect(route).not.toContain('seasonId');
  });

  it('never caches lifecycle command responses', () => {
    expect(route).toContain("'Cache-Control', 'no-store, max-age=0'");
  });
});
