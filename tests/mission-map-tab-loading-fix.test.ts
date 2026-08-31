/**
 * Canton Quests — Mission MAP tab stuck on "Loading Mission Grid..."
 *
 * Root cause: app/events/[slug]/page.tsx's refreshData() forced
 * `isPreLaunch` permanently `true` for any known Canton launch slug
 * (`data.isPreLaunch || isKnownCantonLaunchSlug(eventSlug)`), regardless of
 * what the server's own authoritative isPreLaunchEvent() computation said.
 * That OR-clause made sense back when the Founder's Cipher event didn't
 * exist in the database yet (there was no real data to trust, so "known
 * launch slug" was the only signal available) — but now that a real event
 * record exists with a real startTime/status, this stale client-side
 * override permanently overrides the server's correct answer, gating the
 * entire tabbed dashboard (Quests/MAP/Leaderboard/Rewards/Safety) behind
 * the "Mission Upcoming" shell forever, even once the real Sept 11 launch
 * arrives — the tab bar (and the MAP button specifically) becomes
 * permanently unreachable.
 *
 * Separately, nothing guaranteed the loading fetch itself could never hang:
 * a dropped connection or a non-OK response with a bad JSON body used to
 * either loop back through isPreLaunch (misleadingly labeling a real outage
 * as "hasn't started yet") or — in the worst case — never call
 * setIsLoading(false) at all. Fixed with an AbortController timeout and an
 * honest loadError state with a retry action.
 *
 * The fix does not touch the URL architecture: /events/[slug]/map still
 * redirects to /events/[slug]?tab=map (components/CantonMap.tsx and
 * CantonMapWrapper.tsx are reused unchanged, not duplicated).
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const PAGE_SOURCE = readSource('app/events/[slug]/page.tsx');

describe('Mission MAP tab — no longer permanently gated behind a stale client-side pre-launch override', () => {
  it('map is a valid tab, alongside the other 4 dashboard tabs', () => {
    expect(PAGE_SOURCE).toMatch(/const VALID_TABS: DashboardTab\[\] = \['quests', 'map', 'leaderboard', 'collectibles', 'rules'\];/);
  });

  it('the successful-fetch branch trusts the server-computed data.isPreLaunch alone — no redundant slug-based override', () => {
    // The exact buggy pattern that used to permanently force isPreLaunch
    // true for any known Canton launch slug on every successful response.
    expect(PAGE_SOURCE).not.toMatch(/if \(data\.isPreLaunch \|\| isKnownCantonLaunchSlug\(eventSlug\)\)/);
    // The success-path check now reads only the server's own value.
    expect(PAGE_SOURCE).toMatch(/if \(data\.isPreLaunch\) \{\s*\n\s*setIsPreLaunch\(true\);/);
  });

  it('the 404 (event truly does not exist) fallback still legitimately treats a known launch slug as pre-launch', () => {
    // This is the one case where there is no real event data to trust at
    // all, so falling back to "hasn't started yet" for a recognized Canton
    // launch slug remains correct — left intentionally unchanged.
    const notFoundBlock = PAGE_SOURCE.slice(
      PAGE_SOURCE.indexOf("if (!res.ok && res.status === 404)"),
      PAGE_SOURCE.indexOf("return null;") + 20
    );
    expect(notFoundBlock).toContain('isKnownCantonLaunchSlug(eventSlug)');
    expect(notFoundBlock).toContain('setIsPreLaunch(true)');
  });

  it('the server API route computes isPreLaunch from the real event record, not a static slug list', () => {
    const routeSource = readSource('app/api/game/events/[slug]/route.ts');
    expect(routeSource).toMatch(/isPreLaunch: isPreLaunchEvent\(event, slug\)/);
  });
});

describe('Mission MAP tab — loading always resolves to content, an honest error, or the pre-launch shell; never stuck forever', () => {
  it('the fetch is wrapped in an AbortController with a timeout, so a hung request cannot spin forever', () => {
    expect(PAGE_SOURCE).toMatch(/new AbortController\(\)/);
    expect(PAGE_SOURCE).toMatch(/setTimeout\(\(\) => controller\.abort\(\), 15000\)/);
    expect(PAGE_SOURCE).toMatch(/signal: controller\.signal/);
  });

  it('every branch of the fetch chain resolves isLoading to false (success, 404, non-OK, and network failure)', () => {
    const refreshDataBody = PAGE_SOURCE.slice(
      PAGE_SOURCE.indexOf('const refreshData = useCallback'),
      PAGE_SOURCE.indexOf("}, [authenticatedPlayer, eventSlug]);")
    );
    const setIsLoadingFalseCount = (refreshDataBody.match(/setIsLoading\(false\)/g) || []).length;
    // One in the success .then(), one in the .catch() — both required.
    expect(setIsLoadingFalseCount).toBeGreaterThanOrEqual(2);
  });

  it('a genuine load failure sets an honest loadError instead of silently relabeling it as pre-launch', () => {
    const catchBlock = PAGE_SOURCE.slice(
      PAGE_SOURCE.indexOf('.catch((err) => {'),
      PAGE_SOURCE.indexOf('.finally(() => {')
    );
    expect(catchBlock).toContain('setIsLoading(false)');
    expect(catchBlock).toContain('setLoadError(');
    expect(catchBlock).not.toContain('setIsPreLaunch(true)');
  });

  it('a non-OK, non-404 response (e.g. a 500) is thrown into the error path rather than silently parsed as if it were real data', () => {
    expect(PAGE_SOURCE).toMatch(/if \(!res\.ok\) \{\s*\n\s*throw new Error\(`Mission data request failed \(\$\{res\.status\}\)`\);/);
  });

  it('the error state renders a clear, distinct message with a retry action — never a bare permanent spinner', () => {
    const errorBlock = PAGE_SOURCE.slice(
      PAGE_SOURCE.indexOf('if (loadError && !event) {'),
      PAGE_SOURCE.indexOf('const isCipher = isKnownCantonLaunchSlug(eventSlug);')
    );
    expect(errorBlock).toContain('{loadError}');
    expect(errorBlock).toMatch(/onClick=\{\(\) => refreshData\(\)\}/);
    expect(errorBlock).toContain('RETRY');
  });

  it('the error state only interrupts the page when there is nothing already loaded — a background poll failure never yanks away working content', () => {
    expect(PAGE_SOURCE).toMatch(/if \(loadError && !event\) \{/);
  });

  it('refreshData clears any previous loadError at the start of each attempt, so a successful retry recovers cleanly', () => {
    const refreshDataStart = PAGE_SOURCE.slice(
      PAGE_SOURCE.indexOf('const refreshData = useCallback'),
      PAGE_SOURCE.indexOf('const controller = new AbortController()')
    );
    expect(refreshDataStart).toContain('setLoadError(null);');
  });
});

describe('Mission MAP tab — reuses the existing map system, no duplicate implementation, no URL architecture change', () => {
  it('exactly one Canton map component pair exists (CantonMap + CantonMapWrapper), nothing new added', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'components/CantonMap.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'components/CantonMapWrapper.tsx'))).toBe(true);
    // No parallel "CantonMapV2" / "CantonFieldMap" / etc. duplicate of the
    // SAME Founder's Cipher map. (SectorMap[Wrapper].tsx is a pre-existing,
    // unrelated map used elsewhere — not part of this tab, left alone.)
    const componentsDir = fs.readdirSync(path.join(process.cwd(), 'components'));
    const cantonMapLikeFiles = componentsDir.filter((f) => /^CantonMap/.test(f) && f.endsWith('.tsx'));
    expect(cantonMapLikeFiles.sort()).toEqual(['CantonMap.tsx', 'CantonMapWrapper.tsx']);
  });

  it('the MAP tab still renders the existing CantonMapWrapper, unchanged', () => {
    const mapTabBlock = PAGE_SOURCE.slice(
      PAGE_SOURCE.indexOf("{/* TAB 2: CANTON MAP */}"),
      PAGE_SOURCE.indexOf("{/* TAB 3: LEADERBOARD */}")
    );
    expect(mapTabBlock).toContain("activeTab === 'map'");
    expect(mapTabBlock).toContain('<CantonMapWrapper');
  });

  it('CantonMapWrapper still dynamically imports CantonMap with ssr disabled (required for the Leaflet-based map)', () => {
    const wrapperSource = readSource('components/CantonMapWrapper.tsx');
    expect(wrapperSource).toMatch(/dynamic\(\(\) => import\('\.\/CantonMap'\), \{\s*\n\s*ssr: false,/);
  });

  it('/events/[slug]/map still redirects to the same ?tab=map single-page dashboard URL — architecture unchanged', () => {
    const mapRedirectSource = readSource('app/events/[slug]/map/page.tsx');
    expect(mapRedirectSource).toMatch(/redirect\(`\/events\/\$\{params\.slug\}\?tab=map`\)/);
  });

  it('the mission map uses a production-safe no-key OpenStreetMap basemap, never the CARTO URL that overlays "API KEY REQUIRED"', () => {
    const mapSource = readSource('components/CantonMap.tsx');
    expect(mapSource).toContain('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(mapSource).toContain('OpenStreetMap');
    expect(mapSource).not.toContain('basemaps.cartocdn.com');
    expect(mapSource).not.toContain('CARTO');
  });

  it('the mission map keeps its responsive full-width container for mobile tab rendering', () => {
    const mapSource = readSource('components/CantonMap.tsx');
    expect(mapSource).toContain('className="relative w-full h-[420px]');
    expect(mapSource).toContain('className="w-full h-full z-0"');
  });
});
