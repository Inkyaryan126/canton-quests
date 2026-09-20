import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Grid world API Surge timing boundary', () => {
  it('captures one explicit server clock and reuses it in the world projection', () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), 'app/api/grid/world/route.ts'),
      'utf8',
    );

    expect(route).toContain('const now = new Date().toISOString();');
    expect(route.match(/new Date\(\)\.toISOString\(\)/g)).toHaveLength(1);
    expect(route).toMatch(
      /buildGridWorldProjection\([\s\S]*?\{[\s\S]*?\bnow,[\s\S]*?generatedAt: now,[\s\S]*?\}\)/,
    );
  });
});

describe('Grid world API runtime-not-activated fallback', () => {
  it('falls back to the compiled Canton package with a warning instead of a hard failure when no runtime row exists yet', () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), 'app/api/grid/world/route.ts'),
      'utf8',
    );

    const ifMissingRuntimeBlock = route.slice(
      route.indexOf('if (!runtime) {'),
      route.indexOf('const projection = buildGridWorldProjection('),
    );

    expect(ifMissingRuntimeBlock).toContain(
      "runtimeWarning = 'Grid world runtime is not activated for this environment yet'",
    );
    // The projection must still be built (using the neutral compiled package)
    // rather than the route returning early with an error response.
    expect(ifMissingRuntimeBlock).not.toMatch(/return respond/);
  });
});
