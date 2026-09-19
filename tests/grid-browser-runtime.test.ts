import { describe, expect, it } from 'vitest';
import {
  collectGridBrowserRuntimeEvidence,
  evaluateGridBrowserRuntimeReport,
  stopGridRuntimeProcess,
  type GridBrowserRuntimeCase,
  type GridBrowserRuntimePage,
  type GridBrowserRuntimeReport,
} from '@/lib/grid/ops/browser-runtime-verification';

function fakeLocator(count: number, text: string | null = null) {
  return {
    count: async () => count,
    first: () => ({ textContent: async () => text }),
  };
}

function fakePage(): GridBrowserRuntimePage {
  return {
    url: () => 'http://127.0.0.1:43121/grid',
    title: async () => 'The Grid — Coming Soon | Canton Quests',
    locator: (selector: string) =>
      selector === 'h1' ? fakeLocator(1, 'THE GRID') : fakeLocator(0),
  };
}

function baseCase(overrides: Partial<GridBrowserRuntimeCase> = {}): GridBrowserRuntimeCase {
  return {
    name: 'grid-entry',
    requestedPath: '/grid/play',
    expectedPath: '/grid',
    finalUrl: 'http://127.0.0.1:43121/grid',
    finalPath: '/grid',
    httpStatus: 200,
    title: 'The Grid — Coming Soon | Canton Quests',
    heading: 'THE GRID',
    consoleErrors: [],
    pageErrors: [],
    overlayCount: 0,
    viewport: { width: 390, height: 844 },
    startedAt: '2026-09-19T15:00:00.000Z',
    finishedAt: '2026-09-19T15:00:01.000Z',
    ...overrides,
  };
}

function report(overrides: Partial<GridBrowserRuntimeReport> = {}): GridBrowserRuntimeReport {
  return {
    status: 'PENDING',
    verifiedAt: '2026-09-19T15:00:02.000Z',
    browser: { kind: 'playwright', executablePath: '/local/browser' },
    cases: [
      baseCase(),
      baseCase({
        name: 'grid-public-shell',
        requestedPath: '/grid',
        finalUrl: 'http://127.0.0.1:43121/grid',
      }),
      baseCase({
        name: 'grid-protected-contracts-shell',
        requestedPath: '/grid/contracts',
        expectedPath: '/grid/contracts',
        finalUrl: 'http://127.0.0.1:43121/grid/contracts',
        finalPath: '/grid/contracts',
        heading: 'CONTRACTS MOVE THE CITY.',
      }),
    ],
    skippedReasons: [],
    serverCleanup: { attempted: true, completed: true },
    ...overrides,
  };
}

describe('Grid browser runtime verification', () => {
  it('collects deterministic route, heading, viewport, and overlay evidence', async () => {
    const evidence = await collectGridBrowserRuntimeEvidence(
      fakePage(),
      {
        name: 'grid-entry',
        requestedPath: '/grid/play',
        expectedPath: '/grid',
        expectedHeading: 'THE GRID',
      },
      {
        httpStatus: 200,
        consoleErrors: ['ignored info is not an error'],
        pageErrors: [],
        timestamps: {
          startedAt: '2026-09-19T15:00:00.000Z',
          finishedAt: '2026-09-19T15:00:01.000Z',
        },
        viewport: { width: 390, height: 844 },
      },
    );

    expect(evidence).toMatchObject({
      finalPath: '/grid',
      httpStatus: 200,
      heading: 'THE GRID',
      consoleErrors: ['ignored info is not an error'],
      overlayCount: 0,
      viewport: { width: 390, height: 844 },
    });
  });

  it('fails closed when a page has browser errors or a Next overlay', () => {
    const result = evaluateGridBrowserRuntimeReport(
      report({
        cases: [
          baseCase({ consoleErrors: ['GET /_next/static/chunk.js failed'], overlayCount: 1 }),
          baseCase({ name: 'grid-public-shell', requestedPath: '/grid' }),
          baseCase({
            name: 'grid-protected-contracts-shell',
            requestedPath: '/grid/contracts',
            expectedPath: '/grid/contracts',
            finalUrl: 'http://127.0.0.1:43121/grid/contracts',
            finalPath: '/grid/contracts',
            heading: 'CONTRACTS MOVE THE CITY.',
          }),
        ],
      }),
    );

    expect(result.status).toBe('FAILED');
    expect(result.reasons).toEqual([
      'grid-entry: browser console errors were captured',
      'grid-entry: Next error overlay count was 1',
    ]);
  });

  it('keeps unavailable browser prerequisites distinct from failed runtime evidence', () => {
    const result = evaluateGridBrowserRuntimeReport(
      report({ status: 'SKIPPED', cases: [], skippedReasons: ['No local browser executable found'] }),
    );

    expect(result).toEqual({ status: 'SKIPPED', reasons: ['No local browser executable found'] });
  });

  it('falls back to SIGKILL when a local server ignores SIGTERM', async () => {
    const signals: NodeJS.Signals[] = [];
    let listener: (() => void) | undefined;
    const processLike = {
      exitCode: null,
      signalCode: null,
      kill: (signal: NodeJS.Signals) => {
        signals.push(signal);
        if (signal === 'SIGKILL') {
          processLike.exitCode = 137;
          listener?.();
        }
        return true;
      },
      once: (_event: 'exit', callback: () => void) => {
        listener = callback;
        return processLike;
      },
    };

    await stopGridRuntimeProcess(processLike, 1);

    expect(signals).toEqual(['SIGTERM', 'SIGKILL']);
  });
});
