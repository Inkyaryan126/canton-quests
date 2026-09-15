import { describe, expect, it } from 'vitest';
import { projectTerritoryControl } from '../lib/grid/core/territory-control';

const territories = ['a', 'b', 'c', 'd'].map((slug) => ({ slug }));
const edges = [
  { a: 'a', b: 'b' },
  { a: 'b', b: 'c' },
  { a: 'c', b: 'd' },
];

describe('projectTerritoryControl', () => {
  it('limits the first claim to configured neutral starter territories', () => {
    expect(
      projectTerritoryControl({
        territories,
        edges,
        ownership: [],
        playerId: 'p1',
        starterTerritorySlugs: ['c', 'a'],
      }),
    ).toEqual({
      ownedTerritorySlugs: [],
      neutralTerritorySlugs: ['a', 'b', 'c', 'd'],
      validClaimSlugs: ['a', 'c'],
    });
  });

  it('after the first claim allows only neutral territories adjacent to player ownership', () => {
    expect(
      projectTerritoryControl({
        territories,
        edges,
        ownership: [
          { territorySlug: 'b', ownerPlayerId: 'p1' },
          { territorySlug: 'd', ownerPlayerId: 'rival' },
        ],
        playerId: 'p1',
        starterTerritorySlugs: ['d'],
      }),
    ).toEqual({
      ownedTerritorySlugs: ['b'],
      neutralTerritorySlugs: ['a', 'c'],
      validClaimSlugs: ['a', 'c'],
    });
  });

  it('treats explicit null ownership and absent state as neutral', () => {
    const result = projectTerritoryControl({
      territories,
      edges,
      ownership: [{ territorySlug: 'a', ownerPlayerId: null }],
      playerId: 'p1',
      starterTerritorySlugs: ['a'],
    });
    expect(result.neutralTerritorySlugs).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is deterministic regardless of input order', () => {
    const input = {
      territories,
      edges,
      ownership: [{ territorySlug: 'b', ownerPlayerId: 'p1' }],
      playerId: 'p1',
      starterTerritorySlugs: ['a'],
    };
    expect(
      projectTerritoryControl({
        ...input,
        territories: [...territories].reverse(),
        edges: [...edges].reverse(),
      }),
    ).toEqual(projectTerritoryControl(input));
  });
});
