import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, 'app/grid/play/route.ts'),
  'utf8',
);
const publicGrid = fs.readFileSync(
  path.join(root, 'app/grid/page.tsx'),
  'utf8',
);

describe('Grid private player entry gate', () => {
  it('stays off the public coming-soon page', () => {
    expect(publicGrid).not.toContain('href="/grid/play"');
    expect(publicGrid).not.toContain('href="/grid/onboarding"');
    expect(publicGrid).not.toContain('href="/grid/return"');
  });

  it('resolves the authenticated player and preserves refreshed auth cookies', () => {
    expect(route).toContain('resolveAuthenticatedSession(request)');
    expect(route).toContain(
      'setAuthCookies(response, session.refreshedSession, session.player?.id)',
    );
    expect(route).toContain("dynamic = 'force-dynamic'");
    expect(route).toContain("'Cache-Control', 'no-store, max-age=0'");
  });

  it('keeps staged Grid traffic on the public shell and signed-out players on a safe return path', () => {
    expect(route).toContain("return redirect('/grid')");
    expect(route).toContain("return redirect('/login?next=%2Fgrid%2Fplay')");
  });

  it('derives entry from authoritative onboarding state', () => {
    expect(route).toContain('readGridOnboardingStatus(');
    expect(route).toContain(
      'createSupabaseGridOnboardingStatusPort(cantonFoundingSeasonPackage)',
    );
    expect(route).toContain('session.player.id');
    expect(route).toContain(
      'onboarding.complete && onboarding.invariantViolations.length === 0',
    );
  });

  it('routes only to fixed private Grid destinations', () => {
    expect(route).toContain("return redirect('/grid/return')");
    expect(route).toContain("return redirect('/grid/onboarding')");
    expect(route).not.toContain('searchParams.get');
    expect(route).not.toContain('request.nextUrl.searchParams');
    expect(route).not.toContain('playerId=');
  });
});
