import { describe, expect, it } from 'vitest';
import type { GridSkylineRule } from '../lib/grid/core/economy-types';
import {
  computeSkylineComponents,
  matchSkylineRules,
  type GridSkylinePropertyState,
} from '../lib/grid/core/skyline';

const properties: GridSkylinePropertyState[] = [
  { propertySlug: 'p1', territorySlug: 't1', developmentBranch: 'commerce', developmentLevel: 1 },
  { propertySlug: 'p2', territorySlug: 't2', developmentBranch: 'commerce', developmentLevel: 2 },
  { propertySlug: 'p3', territorySlug: 't3', developmentBranch: 'influence', developmentLevel: 1 },
  { propertySlug: 'p4', territorySlug: 't9', developmentBranch: 'prestige', developmentLevel: 3 },
  { propertySlug: 'undeveloped', territorySlug: 't2', developmentBranch: null, developmentLevel: 0 },
];

const edges = [
  { a: 't1', b: 't2' },
  { a: 't2', b: 't3' },
];

const rules: GridSkylineRule[] = [
  { id: 'any-three', minDevelopedProperties: 3, branchMode: 'any', bonuses: { creditsPerHour: 1 } },
  { id: 'single-two', minDevelopedProperties: 2, branchMode: 'single-branch', bonuses: { prestigeBps: 100 } },
  { id: 'mixed-three', minDevelopedProperties: 3, branchMode: 'mixed', bonuses: { influencePerHour: 1 } },
];

describe('Skyline topology', () => {
  it('groups developed properties through same-territory or adjacent-territory connectivity', () => {
    const result = computeSkylineComponents(properties, edges);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      propertySlugs: ['p1', 'p2', 'p3'],
      territorySlugs: ['t1', 't2', 't3'],
      totalDevelopmentLevel: 4,
      distinctBranches: ['commerce', 'influence'],
    });
    expect(result[1]).toMatchObject({
      propertySlugs: ['p4'],
      territorySlugs: ['t9'],
      totalDevelopmentLevel: 3,
      distinctBranches: ['prestige'],
    });
  });

  it('connects multiple developed properties inside the same territory even without an edge', () => {
    const result = computeSkylineComponents(
      [
        { propertySlug: 'a', territorySlug: 'same', developmentBranch: 'commerce', developmentLevel: 1 },
        { propertySlug: 'b', territorySlug: 'same', developmentBranch: 'prestige', developmentLevel: 1 },
      ],
      []
    );

    expect(result).toHaveLength(1);
    expect(result[0].propertySlugs).toEqual(['a', 'b']);
  });

  it('is deterministic regardless of input ordering', () => {
    const forward = computeSkylineComponents(properties, edges);
    const reversed = computeSkylineComponents([...properties].reverse(), [...edges].reverse());

    expect(reversed).toEqual(forward);
  });

  it('matches Skyline rules from configuration rather than hardcoded thresholds', () => {
    const [mixedComponent] = computeSkylineComponents(properties, edges);
    expect(matchSkylineRules(mixedComponent, rules).map((rule) => rule.id)).toEqual([
      'any-three',
      'mixed-three',
    ]);

    const commerceOnly = computeSkylineComponents(properties.slice(0, 2), edges)[0];
    expect(matchSkylineRules(commerceOnly, rules).map((rule) => rule.id)).toEqual(['single-two']);
  });
});
