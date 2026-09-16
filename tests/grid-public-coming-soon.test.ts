import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('The Grid public coming-soon surface', () => {
  it('does not expose internal build/progress notes on /grid', () => {
    const page = read('app/grid/page.tsx');

    expect(page).toContain('THE GRID');
    expect(page).toContain('COMING SOON');
    expect(page).toContain('THE CITY IS THE BOARD');
    expect(page).not.toContain('buildGridWorldProjection');
    expect(page).not.toContain('GridWorldClient');
    expect(page).not.toMatch(/read-only|runtime|package preview|build status/i);
  });

  it('presents the homepage Grid block as a game teaser, not a dev dashboard', () => {
    const page = read('app/page.tsx');

    expect(page).toContain('ENTER THE GRID');
    expect(page).toContain('COMING SOON');
    expect(page).not.toContain('ENTER THE GRID BUILD');
    expect(page).not.toContain('BUILD SIGNAL ACTIVE');
    expect(page).not.toContain('BUILDING IN PUBLIC');
    expect(page).not.toContain('CITY COMPILER');
  });
});
