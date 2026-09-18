import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GRID_REVISION_DEFAULT_POLL_MS,
  GRID_REVISION_HIDDEN_POLL_MS,
  normalizeGridRevisionPollMs,
} from '../lib/grid/client/world-revision-polling';

const client = fs.readFileSync(
  path.join(process.cwd(), 'app/grid/grid-world-client.tsx'),
  'utf8',
);

describe('Grid world revision polling policy', () => {
  it('accepts server cadence while clamping abusive or accidental extremes', () => {
    expect(normalizeGridRevisionPollMs('5000')).toBe(5_000);
    expect(normalizeGridRevisionPollMs('30000')).toBe(30_000);
    expect(normalizeGridRevisionPollMs('200')).toBe(3_000);
    expect(normalizeGridRevisionPollMs('999999')).toBe(60_000);
    expect(normalizeGridRevisionPollMs('nope')).toBe(GRID_REVISION_DEFAULT_POLL_MS);
    expect(GRID_REVISION_HIDDEN_POLL_MS).toBe(30_000);
  });

  it('polls the lightweight revision route only for an authenticated live runtime', () => {
    expect(client).toContain('if (!runtimeEnabled || !projection.player.authenticated) return;');
    expect(client).toContain("fetch('/api/grid/world/revision'");
    expect(client).toContain("fetch('/api/grid/world', { cache: 'no-store' })");
  });

  it('uses conditional requests and skips full-world refreshes on 304', () => {
    expect(client).toContain("'If-None-Match': revisionEtag");
    expect(client).toContain('if (response.status === 304)');
    expect(client).toContain('if (needsWorldRefresh) await loadWorld();');
  });

  it('backs off in background tabs and immediately checks again when visible', () => {
    expect(client).toContain("document.visibilityState === 'hidden'");
    expect(client).toContain('GRID_REVISION_HIDDEN_POLL_MS');
    expect(client).toContain("document.addEventListener('visibilitychange', handleVisibilityChange)");
    expect(client).toContain("document.visibilityState !== 'visible'");
  });

  it('stops retry noise when auth or runtime reads are unavailable', () => {
    expect(client).toContain('response.status === 401 || response.status === 404');
  });
});
