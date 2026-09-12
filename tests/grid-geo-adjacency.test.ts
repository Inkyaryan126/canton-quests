import { describe, expect, it } from 'vitest';
import { computeAdjacency, type AdjacencyInput } from '../lib/grid/geo/adjacency';

function square(x0: number, y0: number, x1: number, y1: number): GeoJSON.MultiPolygon {
  return {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
          [x0, y0],
        ],
      ],
    ],
  };
}

// Two separate rows of squares, far apart in latitude, so the only touching
// pairs are the horizontal edge-adjacent neighbors within each row.
const fixture: AdjacencyInput[] = [
  { slug: 't1', geometry: square(0, 0, 1, 1) },
  { slug: 't2', geometry: square(1, 0, 2, 1) }, // shares edge with t1
  { slug: 't3', geometry: square(2, 0, 3, 1) }, // shares edge with t2, disjoint from t1
  { slug: 't4', geometry: square(0, 5, 1, 6) }, // far from t1-t3
  { slug: 't5', geometry: square(1, 5, 2, 6) }, // shares edge with t4
];

function edgeKey(a: string, b: string): string {
  return [a, b].sort().join('-');
}

describe('computeAdjacency', () => {
  it('finds the correct pairs on the 5-territory fixture', () => {
    const edges = computeAdjacency(fixture);
    const keys = new Set(edges.map((e) => edgeKey(e.a, e.b)));

    expect(keys).toEqual(new Set(['t1-t2', 't2-t3', 't4-t5']));
    expect(edges).toHaveLength(3);
  });

  it('produces no self-adjacency', () => {
    const edges = computeAdjacency(fixture);
    for (const edge of edges) {
      expect(edge.a).not.toBe(edge.b);
    }
  });

  it('produces no duplicate pairs, order-independent', () => {
    const edges = computeAdjacency(fixture);
    const keys = edges.map((e) => edgeKey(e.a, e.b));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('excludes disjoint territories', () => {
    const edges = computeAdjacency(fixture);
    const keys = new Set(edges.map((e) => edgeKey(e.a, e.b)));

    expect(keys.has(edgeKey('t1', 't3'))).toBe(false);
    expect(keys.has(edgeKey('t1', 't4'))).toBe(false);
    expect(keys.has(edgeKey('t1', 't5'))).toBe(false);
    expect(keys.has(edgeKey('t3', 't4'))).toBe(false);
  });

  it('is symmetric regardless of input order', () => {
    const reversed = computeAdjacency([...fixture].reverse());
    const keys = new Set(reversed.map((e) => edgeKey(e.a, e.b)));
    expect(keys).toEqual(new Set(['t1-t2', 't2-t3', 't4-t5']));
  });
});
