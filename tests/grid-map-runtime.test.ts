import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fetchGridMapRuntimeProbe } from '../lib/grid/ops/map-runtime';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/api/grid/world/route.ts'), 'utf8');
const probe = fs.readFileSync(path.join(root, 'lib/grid/ops/map-runtime.ts'), 'utf8');
const script = fs.readFileSync(path.join(root, 'scripts/grid-map-runtime.ts'), 'utf8');

describe('Grid authenticated world/map runtime contract', () => {
  it('fails closed for disabled and unauthenticated reads, while preserving the success projection', () => {
    expect(route).toContain("status: 404");
    expect(route).toContain("status: 401");
    expect(route).toContain("error: 'Authentication required.'");
    expect(route).toContain('runtime = await readSupabaseGridWorldRuntime');
    expect(route).toContain("status: 503");
    expect(route).toContain(": 'Grid runtime read failed.'");
    expect(route).toContain(
      "runtimeWarning = 'Grid world runtime is not activated for this environment yet'",
    );
    expect(route).toContain('projection,');
  });

  it('keeps the authenticated response private and read-only', () => {
    expect(route).toContain("'Cache-Control', 'private, no-store, max-age=0'");
    expect(route).toContain("'Vary', 'Cookie'");
    expect(route).toContain('setAuthCookies');
    expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
  });

  it('aborts a readiness probe that accepts a socket but never responds', async () => {
    const stalledFetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error('missing abort signal'));
          return;
        }
        signal.addEventListener('abort', () => reject(new Error('probe aborted')), { once: true });
      })) as typeof fetch;

    await expect(
      fetchGridMapRuntimeProbe('http://127.0.0.1:65535/api/grid/world', 20, stalledFetch),
    ).rejects.toThrow('probe aborted');
  });

  it('probes only localhost with remote Supabase configuration cleared', () => {
    expect(probe).toContain('resolvePreferredLocalNodeBinary');
    expect(probe).toContain('spawn(nodeBin');
    expect(probe).not.toContain('spawn(process.execPath');
    expect(probe).toContain("GRID_WORLD_READ_ENABLED: '0'");
    expect(probe).toContain("GRID_WORLD_READ_ENABLED: '1'");
    expect(probe).toContain('NEXT_PUBLIC_SUPABASE_URL: \'\'');
    expect(probe).toContain("SUPABASE_SERVICE_ROLE_KEY: ''");
    expect(script).toContain("status !== 404 || unauthenticated?.status !== 401");
  });
});
