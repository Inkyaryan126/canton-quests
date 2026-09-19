import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

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
    expect(route).toContain("error: 'Grid runtime data is unavailable.'");
    expect(route).toContain('projection,');
  });

  it('keeps the authenticated response private and read-only', () => {
    expect(route).toContain("'Cache-Control', 'private, no-store, max-age=0'");
    expect(route).toContain("'Vary', 'Cookie'");
    expect(route).toContain('setAuthCookies');
    expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
  });

  it('probes only localhost with remote Supabase configuration cleared', () => {
    expect(probe).toContain("GRID_WORLD_READ_ENABLED: '0'");
    expect(probe).toContain("GRID_WORLD_READ_ENABLED: '1'");
    expect(probe).toContain('NEXT_PUBLIC_SUPABASE_URL: \'\'');
    expect(probe).toContain("SUPABASE_SERVICE_ROLE_KEY: ''");
    expect(script).toContain("status !== 404 || unauthenticated?.status !== 401");
  });
});
