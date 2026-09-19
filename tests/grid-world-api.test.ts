import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Grid world API Surge timing boundary', () => {
  it('passes an explicit server clock into the world projection', () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), 'app/api/grid/world/route.ts'),
      'utf8',
    );

    expect(route).toContain('const now = new Date().toISOString()');
    expect(route).toContain('generatedAt: now');
  });
});
