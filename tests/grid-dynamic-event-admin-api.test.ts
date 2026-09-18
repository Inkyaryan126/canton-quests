import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const route = fs.readFileSync(
  path.join(process.cwd(), 'app/api/admin/grid/events/route.ts'),
  'utf8',
);

describe('Grid dynamic event GM API', () => {
  it('requires the canonical GM session before reading or parsing event commands', () => {
    expect(route).toContain('resolveAdminSessionFromRequest(request)');
    expect(route).toContain("error: 'Unauthorized'");
    const authIndex = route.indexOf('resolveAdminSessionFromRequest(request)');
    const bodyIndex = route.indexOf('await request.json()');
    expect(authIndex).toBeGreaterThan(-1);
    expect(bodyIndex).toBeGreaterThan(authIndex);
    expect(route).not.toContain('resolveAuthenticatedSession');
  });

  it('derives city and season identity from the server package', () => {
    expect(route).toContain('cantonFoundingSeasonPackage.city.slug');
    expect(route).toContain('cantonFoundingSeasonPackage.seasonTemplate.slug');
    expect(route).not.toContain('body.citySlug');
    expect(route).not.toContain('body.seasonSlug');
  });

  it('uses the validated dynamic-event service for both listing and creation', () => {
    expect(route).toContain('listActiveGridDynamicEvents(');
    expect(route).toContain('startGridDynamicEvent(');
    expect(route).toContain('createSupabaseGridDynamicEventPort()');
    expect(route).toContain('parseTemplate(body.template)');
  });

  it('restricts event kinds, targets, and modifier operations at the HTTP boundary', () => {
    expect(route).toContain('const EVENT_KINDS');
    expect(route).toContain('const TARGET_TYPES');
    expect(route).toContain("operation === 'set-flag'");
    expect(route).toContain("operation !== 'add-bps'");
    expect(route).toContain("operation !== 'add-flat'");
  });

  it('keeps GM responses out of shared caches', () => {
    expect(route).toContain("'Cache-Control', 'no-store, max-age=0'");
  });
});
