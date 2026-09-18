import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'app/grid/grid-world-client.tsx'),
  'utf8',
);

describe('Grid City Board visual polish contract', () => {
  it('frames present-day Canton as the starting world and player development as the future', () => {
    expect(source).toContain('PRESENT-DAY CANTON');
    expect(source).toContain('PLAYER-CREATED FUTURE');
    expect(source).toContain('THE CITY EXISTS. NOW PLAYERS CHANGE IT.');
  });

  it('supports focused territory inspection instead of a passive static map', () => {
    expect(source).toContain('selectedTerritorySlug');
    expect(source).toContain('setSelectedTerritorySlug');
    expect(source).toContain('SELECTED TERRITORY');
    expect(source).toContain('data-grid-territory');
  });

  it('adds premium map treatment for selection, glow, and active fronts', () => {
    expect(source).toContain('territory-glow');
    expect(source).toContain('map-vignette');
    expect(source).toContain('ACTIVE FRONT');
  });
});
