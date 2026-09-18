import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relative: string): string {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function walk(dir: string): string[] {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(relative) : [relative];
  });
}

describe('Grid modern-city canon policy', () => {
  it('records present-day city state as the canonical playable world', () => {
    const decisions = read('DECISIONS.md');
    expect(decisions).toContain('[ADR-057]');
    expect(decisions).toContain('Present-Day City Is the Canonical Playable World');
    expect(decisions).toContain('History is content, not the economy timeline');
  });

  it('marks the old past-to-present progression concept as superseded', () => {
    const plan = read('docs/superpowers/plans/2026-09-12-the-grid-city-compiler-canton-geography.md');
    expect(plan).toContain('SUPERSEDED BY ADR-057');
    expect(plan).not.toContain('era-based unlocking) is explicitly a later gameplay-layer concern');
  });

  it('keeps historical metadata available without making it required', () => {
    const types = read('lib/grid/core/types.ts');
    expect(types).toContain('historical?: GridHistoricalMetadata;');
  });

  it('does not use historical dates or era gates in runtime gameplay modules', () => {
    const runtimeFiles = [
      ...walk('lib/grid/server'),
      ...walk('lib/grid/map'),
      ...walk('lib/grid/core'),
    ].filter((file) => /\.(ts|tsx)$/.test(file) && file !== 'lib/grid/core/types.ts');

    const forbidden = /\b(activationYear|builtYear|openedYear|retiredYear|demolishedYear|predecessorSlug|successorSlug|eraGate|eraUnlock|historicalGate)\b/;
    const violations = runtimeFiles.filter((file) => forbidden.test(read(file)));
    expect(violations).toEqual([]);
  });
});
