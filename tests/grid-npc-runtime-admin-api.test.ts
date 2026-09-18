import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
}
const status = read('app/api/admin/grid/stronghold-runtime/route.ts');
const surge = read('app/api/admin/grid/stronghold-runtime/surge/route.ts');
const pressure = read('app/api/admin/grid/stronghold-runtime/factions/[factionId]/pressure/route.ts');
const event = read('app/api/admin/grid/stronghold-runtime/strongholds/[strongholdId]/event/route.ts');

describe('Grid NPC runtime admin API', () => {
  it('requires canonical admin auth, Grid runtime feature, and no-store everywhere', () => {
    for (const source of [status, surge, pressure, event]) {
      expect(source).toContain('resolveAdminSessionFromRequest(request)');
      expect(source).toContain('isGridWorldReadEnabled()');
      expect(source).toContain("Cache-Control', 'no-store, max-age=0'");
    }
  });
  it('returns exact runtime readiness only on the admin status surface', () => {
    expect(status).toContain('getGridNpcStrongholdRuntimeAdminStatus');
    expect(status).toContain('runtime });');
  });
  it('never accepts city or season ids from mutation request bodies', () => {
    for (const source of [surge, pressure, event]) {
      expect(source).toContain('cantonFoundingSeasonPackage.city.slug');
      expect(source).toContain('cantonFoundingSeasonPackage.seasonTemplate.slug');
      expect(source).not.toContain('body.cityId');
      expect(source).not.toContain('body.seasonId');
    }
  });
  it('supports explicit Surge clear-to-unknown, faction pressure, and stronghold event state', () => {
    expect(surge).toContain('value !== null');
    expect(surge).toContain('surgeIntensityBps: value');
    expect(pressure).toContain('factionId: params.factionId');
    expect(pressure).toContain('pressureBps: body.pressureBps');
    expect(event).toContain('strongholdId: params.strongholdId');
    expect(event).toContain('active: body.active');
  });
  it('requires client-supplied idempotency keys for every mutation', () => {
    for (const source of [surge, pressure, event]) {
      expect(source).toContain('body.idempotencyKey');
      expect(source).toContain('idempotencyKey,');
    }
  });
});
