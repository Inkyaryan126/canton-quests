import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const route = fs.readFileSync(
  path.join(
    process.cwd(),
    'app/api/admin/grid/runtime/sweep/route.ts',
  ),
  'utf8',
);

describe('Grid runtime maintenance sweep admin API contract', () => {
  it('authenticates admin before runtime work and keeps responses uncached', () => {
    const auth = route.indexOf('resolveAdminSessionFromRequest(request)');
    const sweep = route.indexOf('runGridRuntimeMaintenanceSweep(');

    expect(auth).toBeGreaterThanOrEqual(0);
    expect(sweep).toBeGreaterThan(auth);
    expect(route).toContain("status: 401");
    expect(route).toContain("isGridWorldReadEnabled()");
    expect(route).toContain("status: 404");
    expect(route).toContain("'Cache-Control', 'no-store, max-age=0'");
  });

  it('derives city, season, surge window, current time, and feature gates on the server', () => {
    expect(route).toContain('cantonFoundingSeasonPackage.city.slug');
    expect(route).toContain(
      'cantonFoundingSeasonPackage.seasonTemplate.slug',
    );
    expect(route).toContain(
      'cantonFoundingSeasonPackage.seasonTemplate.surgeHours',
    );
    expect(route).toContain('new Date().toISOString()');
    expect(route).toContain('isGridAuctionWriteEnabled()');
    expect(route).toContain('isGridContractRewardSettlementEnabled()');

    expect(route).not.toContain('body.citySlug');
    expect(route).not.toContain('body.seasonSlug');
    expect(route).not.toContain('body.seasonId');
    expect(route).not.toContain('body.now');
  });

  it('reuses the existing authoritative lifecycle, auction, and reward adapters', () => {
    expect(route).toContain('createSupabaseGridSeasonLifecyclePort()');
    expect(route).toContain(
      'createSupabaseGridAuctionSettlementSweepPort()',
    );
    expect(route).toContain('createSupabaseGridAuctionCommandPort()');
    expect(route).toContain(
      'createSupabaseGridContractRewardSettlementPort()',
    );
  });

  it('accepts only bounded work limits from the request body', () => {
    expect(route).toContain('body.auctionLimit');
    expect(route).toContain('body.contractRewardLimit');
    expect(route).not.toContain('body.auctionSettlementEnabled');
    expect(route).not.toContain('body.contractRewardSettlementEnabled');
  });

  it('returns the sweep result even when a phase reports partial failure', () => {
    expect(route).toContain(
      'return noStore({ success: result.success, result });',
    );
  });
});
