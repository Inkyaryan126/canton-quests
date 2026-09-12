import { describe, expect, it } from 'vitest';
import {
  computeBBox,
  computeCentroid,
  fromLngLatTuple,
  isValidPolygonGeometry,
  isWithinBounds,
  overlapAreaRatio,
  polygonsIntersect,
  toLngLatTuple,
} from '../lib/grid/geo/geometry';

function square(
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number
): GeoJSON.MultiPolygon {
  return {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat],
        ],
      ],
    ],
  };
}

const VALID_SQUARE: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ],
  ],
};

const BOWTIE_POLYGON: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [2, 2],
      [2, 0],
      [0, 2],
      [0, 0],
    ],
  ],
};

const OPEN_RING_POLYGON: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ],
  ],
};

describe('isValidPolygonGeometry', () => {
  it('accepts a valid closed square', () => {
    expect(isValidPolygonGeometry(VALID_SQUARE)).toBe(true);
  });

  it('rejects a self-intersecting bowtie polygon', () => {
    expect(isValidPolygonGeometry(BOWTIE_POLYGON)).toBe(false);
  });

  it('rejects an unclosed ring', () => {
    expect(isValidPolygonGeometry(OPEN_RING_POLYGON)).toBe(false);
  });

  it('never repairs -- the input geometry is left untouched', () => {
    const before = JSON.parse(JSON.stringify(BOWTIE_POLYGON));
    expect(isValidPolygonGeometry(BOWTIE_POLYGON)).toBe(false);
    expect(BOWTIE_POLYGON).toEqual(before);
  });
});

describe('computeCentroid', () => {
  it('computes the mean-of-vertices centroid of a fixed square', () => {
    const result = computeCentroid(square(0, 0, 2, 2));
    // The closing vertex of a GeoJSON ring is listed twice (first === last),
    // so the mean of all 5 listed vertices is biased toward that corner --
    // this is @turf/centroid's documented "mean of all vertices" behavior,
    // not the polygon's true geometric center.
    expect(result.lng).toBeCloseTo(0.8, 5);
    expect(result.lat).toBeCloseTo(0.8, 5);
  });
});

describe('computeBBox', () => {
  it('computes the bounding box of a fixed square', () => {
    expect(computeBBox(square(0, 0, 2, 2))).toEqual([0, 0, 2, 2]);
  });
});

describe('isWithinBounds', () => {
  const bounds = square(-1, -1, 3, 3);

  it('returns true when the geometry is fully inside the bounds', () => {
    expect(isWithinBounds(square(0, 0, 2, 2), bounds)).toBe(true);
  });

  it('returns false when the geometry lies entirely outside the bounds', () => {
    expect(isWithinBounds(square(10, 10, 12, 12), bounds)).toBe(false);
  });

  it('returns false when the geometry only partially overlaps the bounds', () => {
    expect(isWithinBounds(square(2, 2, 5, 5), bounds)).toBe(false);
  });
});

describe('polygonsIntersect', () => {
  it('returns true for polygons that share a touching edge', () => {
    const a = square(0, 0, 2, 2);
    const b = square(2, 0, 4, 2);
    expect(polygonsIntersect(a, b)).toBe(true);
  });

  it('returns false for disjoint polygons', () => {
    const a = square(0, 0, 2, 2);
    const b = square(10, 10, 12, 12);
    expect(polygonsIntersect(a, b)).toBe(false);
  });
});

describe('overlapAreaRatio', () => {
  it('returns 0 for disjoint polygons', () => {
    const a = square(0, 0, 2, 2);
    const b = square(10, 10, 12, 12);
    expect(overlapAreaRatio(a, b)).toBe(0);
  });

  it('returns ~1 when the smaller polygon is fully contained in the larger one', () => {
    const outer = square(0, 0, 4, 4);
    const inner = square(1, 1, 2, 2);
    expect(overlapAreaRatio(outer, inner)).toBeCloseTo(1, 5);
  });

  it('returns a ratio strictly between 0 and 1 for a partial overlap', () => {
    const a = square(0, 0, 2, 2);
    const b = square(1, 1, 3, 3);
    const ratio = overlapAreaRatio(a, b);
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1);
  });
});

describe('toLngLatTuple / fromLngLatTuple', () => {
  it('round-trips a GridLatLng through the [lng, lat] tuple form', () => {
    const point = { lat: 40.8, lng: -81.37 };
    expect(toLngLatTuple(point)).toEqual([-81.37, 40.8]);
    expect(fromLngLatTuple(toLngLatTuple(point))).toEqual(point);
  });
});
