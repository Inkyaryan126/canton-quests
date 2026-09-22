import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('The Grid playable public entry', () => {
  it('mounts the existing rich Canton city board on /grid', () => {
    const page = read('app/grid/page.tsx');

    expect(page).toContain('buildGridWorldProjection');
    expect(page).toContain('cantonFoundingSeasonPackage');
    expect(page).toContain('GridWorldClient');
    expect(page).not.toContain('COMING SOON');
  });

  it('preserves the rich gameplay client instead of replacing it with a preview-only shell', () => {
    const client = read('app/grid/grid-world-client.tsx');

    expect(client).toContain('GridCityMap');
    expect(client).toContain('claimTerritory');
    expect(client).toContain('acquireProperty');
    expect(client).toContain('developProperty');
    expect(client).toContain('collectIncome');
    expect(client).toContain('launchContest');
    expect(client).toContain('Player Economy');
    expect(client).toContain('Contests');
    expect(client).toContain('NPC STRONGHOLD');
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
