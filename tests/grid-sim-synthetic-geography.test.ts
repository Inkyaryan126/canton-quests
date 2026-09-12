import { describe, expect, it } from 'vitest';
import { generateSyntheticGeography } from '../lib/grid/sim/synthetic-geography';
import { computeAdjacency, type AdjacencyInput } from '../lib/grid/geo/adjacency';

const SEED = 42;
const SIZES = [10, 100, 500];

describe('generateSyntheticGeography', () => {
  it.each(SIZES)('is deterministic for count=%i -- same seed produces identical output', (count) => {
    const first = generateSyntheticGeography(count, SEED);
    const second = generateSyntheticGeography(count, SEED);
    expect(second).toEqual(first);
  });

  it.each(SIZES)('generates exactly %i territories', (count) => {
    const { territories } = generateSyntheticGeography(count, SEED);
    expect(territories).toHaveLength(count);
  });

  it.each(SIZES)('computeAdjacency completes and every territory has at least one neighbor (count=%i)', (count) => {
    const { territories } = generateSyntheticGeography(count, SEED);
    const inputs: AdjacencyInput[] = territories.map((t) => ({ slug: t.slug, geometry: t.geometry }));

    const start = performance.now();
    const edges = computeAdjacency(inputs);
    const elapsedMs = performance.now() - start;

    if (count === 500) {
      console.info(`computeAdjacency(500 territories) took ${elapsedMs.toFixed(2)}ms`);
    }

    const neighborCounts = new Map<string, number>();
    for (const input of inputs) {
      neighborCounts.set(input.slug, 0);
    }
    for (const edge of edges) {
      neighborCounts.set(edge.a, (neighborCounts.get(edge.a) ?? 0) + 1);
      neighborCounts.set(edge.b, (neighborCounts.get(edge.b) ?? 0) + 1);
    }

    for (const [slug, neighbors] of neighborCounts) {
      expect(neighbors, `territory ${slug} should have at least one neighbor`).toBeGreaterThanOrEqual(1);
    }
    expect(edges.length).toBeGreaterThanOrEqual(count - 1);
  });
});
