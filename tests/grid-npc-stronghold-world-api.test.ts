import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const routePath = path.join(root, 'app/api/grid/world/route.ts');

function readWorldRoute(): string {
  return fs.readFileSync(routePath, 'utf8');
}

describe('Grid NPC strongholds world API wiring', () => {
  it('exposes a strongholds collection through the existing read-only world response', () => {
    const route = readWorldRoute();

    expect(route).toContain(
      "import { buildGridNpcStrongholdWorldProjection } from '@/lib/grid/server/npc-stronghold-world';",
    );
    expect(route).toContain('const strongholds = buildGridNpcStrongholdWorldProjection(');
    expect(route).toContain('strongholds,');
  });

  it('keeps stronghold exposure additive and leaves the world endpoint read-only', () => {
    const route = readWorldRoute();

    expect(route).toContain('projection,');
    expect(route).toContain('runtimeEnabled,');
    expect(route).toContain('runtimeWarning,');
    expect(route).toContain('export async function GET');
    expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
  });
});
