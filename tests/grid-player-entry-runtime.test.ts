import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  classifyGridPlayerEntryRedirect,
  runtimeEvidenceFromGridPlayerEntryReport,
  type GridPlayerEntryRuntimeReport,
} from '../lib/grid/ops/player-entry-runtime';

const playerEntryRuntimeSource = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/ops/player-entry-runtime.ts'),
  'utf8',
);

describe('Grid player-entry runtime verification', () => {
  it('launches local Next with the preferred local Node toolchain', () => {
    expect(playerEntryRuntimeSource).toContain('resolvePreferredLocalNodeBinary');
    expect(playerEntryRuntimeSource).toContain('spawn(nodeBin');
    expect(playerEntryRuntimeSource).toContain('options.startupTimeoutMs ?? 90_000');
    expect(playerEntryRuntimeSource).toContain('options.fetchTimeoutMs ?? 60_000');
    expect(playerEntryRuntimeSource).not.toContain('spawn(process.execPath');
  });
  it('accepts only the staged public-shell redirect while world reads are disabled', () => {
    expect(
      classifyGridPlayerEntryRedirect({
        mode: 'staged',
        status: 307,
        location: 'http://127.0.0.1:31001/grid',
        origin: 'http://127.0.0.1:31001',
      }),
    ).toEqual({ destination: '/grid', status: 307 });
  });

  it('accepts Next localhost normalization only when it remains same-port loopback', () => {
    expect(
      classifyGridPlayerEntryRedirect({
        mode: 'staged',
        status: 307,
        location: 'http://localhost:31001/grid',
        origin: 'http://127.0.0.1:31001',
      }),
    ).toEqual({ destination: '/grid', status: 307 });

    expect(() =>
      classifyGridPlayerEntryRedirect({
        mode: 'staged',
        status: 307,
        location: 'http://localhost:31002/grid',
        origin: 'http://127.0.0.1:31001',
      }),
    ).toThrow(/origin/i);
  });

  it('accepts only the safe signed-out login return path while world reads are enabled', () => {
    expect(
      classifyGridPlayerEntryRedirect({
        mode: 'signed-out',
        status: 307,
        location:
          'http://127.0.0.1:31001/login?next=%2Fgrid%2Fplay',
        origin: 'http://127.0.0.1:31001',
      }),
    ).toEqual({
      destination: '/login?next=%2Fgrid%2Fplay',
      status: 307,
    });
  });

  it('rejects wrong status, wrong destination, and cross-origin redirects', () => {
    expect(() =>
      classifyGridPlayerEntryRedirect({
        mode: 'signed-out',
        status: 200,
        location:
          'http://127.0.0.1:31001/login?next=%2Fgrid%2Fplay',
        origin: 'http://127.0.0.1:31001',
      }),
    ).toThrow(/redirect status/i);

    expect(() =>
      classifyGridPlayerEntryRedirect({
        mode: 'signed-out',
        status: 307,
        location: 'http://127.0.0.1:31001/profile',
        origin: 'http://127.0.0.1:31001',
      }),
    ).toThrow(/destination/i);

    expect(() =>
      classifyGridPlayerEntryRedirect({
        mode: 'signed-out',
        status: 307,
        location: 'https://example.com/login?next=%2Fgrid%2Fplay',
        origin: 'http://127.0.0.1:31001',
      }),
    ).toThrow(/origin/i);
  });

  it('converts a complete two-mode runtime report into GREEN runtime evidence', () => {
    const report: GridPlayerEntryRuntimeReport = {
      verifiedAt: '2026-09-19T06:00:00.000Z',
      cases: [
        {
          mode: 'staged',
          status: 307,
          destination: '/grid',
          destinationStatus: 200,
        },
        {
          mode: 'signed-out',
          status: 307,
          destination: '/login?next=%2Fgrid%2Fplay',
          destinationStatus: 200,
        },
      ],
    };

    expect(runtimeEvidenceFromGridPlayerEntryReport(report)).toMatchObject({
      status: 'GREEN',
      source: 'runtime',
      runtimeVerified: true,
    });
  });
});
