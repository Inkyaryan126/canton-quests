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
