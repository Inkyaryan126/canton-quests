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
      "import { listGridNpcStrongholdLiveWorld } from '@/lib/grid/server/npc-stronghold-live-service';",
    );
    expect(route).toContain('createSupabaseGridNpcStrongholdRegistryPort()');
    expect(route).toContain('createSupabaseGridNpcStrongholdRuntimeEvidencePort()');
    expect(route).toContain('await listGridNpcStrongholdLiveWorld(');
    expect(route).toContain('strongholds = strongholdRuntime.strongholds');
    expect(route).toContain('strongholds,');
    expect(route).not.toContain('buildGridNpcStrongholdWorldProjection(\n    cantonFoundingSeasonPackage,\n    [],');
  });


  it('fails soft without exposing exact stronghold readiness facts on the world response', () => {
    const route = readWorldRoute();

    expect(route).toContain("const strongholdWarning = 'Grid stronghold runtime incomplete'");
    expect(route).toContain("'Grid stronghold runtime read failed'");
    expect(route).not.toContain('strongholdRuntime.missingFacts');
    expect(route).not.toContain('missingFacts: strongholdRuntime');
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
