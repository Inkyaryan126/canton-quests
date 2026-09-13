import { describe, expect, it } from 'vitest';
import {
  isValidPolygonGeometry,
  computeCentroid,
  computeBBox,
  isWithinBounds,
  polygonsIntersect,
  overlapAreaRatio,
  toLngLatTuple,
  fromLngLatTuple,
} from '../lib/grid/geo/geometry';

// Fixtures follow canonical GeoJSON coordinate order: [longitude, latitude]

const validSquarePolygon: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0],
      [0, 0],
    ],
  ],
};

const validSquareMultiPolygon: GeoJSON.MultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [0, 0],
        [0, 4],
        [4, 4],
        [4, 0],
        [0, 0],
      ],
    ],
  ],
};

const multiPolygonWithHole: GeoJSON.MultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [
      // Outer ring
      [
        [0, 0],
        [0, 10],
        [10, 10],
        [10, 0],
        [0, 0],
      ],
      // Hole ring
      [
        [2, 2],
        [2, 8],
        [8, 8],
        [8, 2],
        [2, 2],
      ],
    ],
  ],
};

const bowtiePolygon: GeoJSON.Polygon = {
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

const bowtieMultiPolygon: GeoJSON.MultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [0, 0],
        [2, 2],
        [2, 0],
        [0, 2],
        [0, 0],
      ],
    ],
  ],
};

const openRingPolygon: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0],
    ],
  ],
};

const openRingMultiPolygon: GeoJSON.MultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [0, 0],
        [0, 2],
        [2, 2],
        [2, 0],
      ],
    ],
  ],
};

const degenerateRingPolygon: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 1],
      [0, 0],
    ],
  ],
};

describe('isValidPolygonGeometry', () => {
  it('returns true for a valid square polygon and multipolygon', () => {
    expect(isValidPolygonGeometry(validSquarePolygon)).toBe(true);
    expect(isValidPolygonGeometry(validSquareMultiPolygon)).toBe(true);
  });

  it('returns true for a valid polygon with an interior hole', () => {
    expect(isValidPolygonGeometry(multiPolygonWithHole)).toBe(true);
  });

  it('returns false for a self-intersecting bowtie polygon without mutating it', () => {
    expect(isValidPolygonGeometry(bowtiePolygon)).toBe(false);
    expect(isValidPolygonGeometry(bowtieMultiPolygon)).toBe(false);
  });

  it('returns false for an open ring (first coord != last coord)', () => {
    expect(isValidPolygonGeometry(openRingPolygon)).toBe(false);
    expect(isValidPolygonGeometry(openRingMultiPolygon)).toBe(false);
  });

  it('returns false for degenerate rings with fewer than 4 coordinates', () => {
    expect(isValidPolygonGeometry(degenerateRingPolygon)).toBe(false);
  });

  it('returns false for empty coordinates array', () => {
    expect(isValidPolygonGeometry({ type: 'Polygon', coordinates: [] })).toBe(false);
    expect(isValidPolygonGeometry({ type: 'MultiPolygon', coordinates: [] })).toBe(false);
  });

  it('returns false for null, undefined, or non-polygon types', () => {
    expect(isValidPolygonGeometry(null as unknown as GeoJSON.Polygon)).toBe(false);
    expect(isValidPolygonGeometry(undefined as unknown as GeoJSON.Polygon)).toBe(false);
    expect(isValidPolygonGeometry({ type: 'Point', coordinates: [0, 0] } as unknown as GeoJSON.Polygon)).toBe(false);
  });

  it('returns false for non-finite or non-numeric coordinate values', () => {
    const nanPolygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [NaN, 0],
          [0, 2],
          [2, 2],
          [2, 0],
          [NaN, 0],
        ],
      ],
    };
    expect(isValidPolygonGeometry(nanPolygon)).toBe(false);
  });
});

describe('computeCentroid', () => {
  it('computes correct centroid for a fixed square MultiPolygon', () => {
    const center = computeCentroid(validSquareMultiPolygon);
    expect(center.lat).toBeCloseTo(2, 5);
    expect(center.lng).toBeCloseTo(2, 5);
  });

  it('computes correct centroid for a city-scale bounding box polygon', () => {
    // Downtown Riverside rough bounds: lng ~ -81.38 to -81.36, lat ~ 40.79 to 40.81
    const downtownArea: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [-81.38, 40.79],
            [-81.38, 40.81],
            [-81.36, 40.81],
            [-81.36, 40.79],
            [-81.38, 40.79],
          ],
        ],
      ],
    };
    const center = computeCentroid(downtownArea);
    expect(center.lng).toBeCloseTo(-81.37, 4);
    expect(center.lat).toBeCloseTo(40.8, 4);
  });
});

describe('computeBBox', () => {
  it('computes correct [minLng, minLat, maxLng, maxLat] bounding box in GeoJSON coordinate order', () => {
    const geom: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [-81.4, 40.75],
            [-81.4, 40.85],
            [-81.3, 40.85],
            [-81.3, 40.75],
            [-81.4, 40.75],
          ],
        ],
      ],
    };
    const box = computeBBox(geom);
    expect(box).toEqual([-81.4, 40.75, -81.3, 40.85]);
  });
});

describe('isWithinBounds', () => {
  const cityBounds: GeoJSON.MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
          [0, 0],
        ],
      ],
    ],
  };

  it('returns true when geometry is entirely inside the bounds', () => {
    const insideGeom: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [2, 2],
            [2, 5],
            [5, 5],
            [5, 2],
            [2, 2],
          ],
        ],
      ],
    };
    expect(isWithinBounds(insideGeom, cityBounds)).toBe(true);
  });

  it('returns true when geometry shares an edge with the boundary on the inside', () => {
    const touchingGeom: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [0, 5],
            [5, 5],
            [5, 0],
            [0, 0],
          ],
        ],
      ],
    };
    expect(isWithinBounds(touchingGeom, cityBounds)).toBe(true);
  });

  it('returns false when geometry extends partially outside the bounds', () => {
    const partialGeom: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [8, 8],
            [8, 12],
            [12, 12],
            [12, 8],
            [8, 8],
          ],
        ],
      ],
    };
    expect(isWithinBounds(partialGeom, cityBounds)).toBe(false);
  });

  it('returns false when geometry is completely disjoint from bounds', () => {
    const disjointGeom: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [20, 20],
            [20, 25],
            [25, 25],
            [25, 20],
            [20, 20],
          ],
        ],
      ],
    };
    expect(isWithinBounds(disjointGeom, cityBounds)).toBe(false);
  });

  it('returns false when geometry or bounds is empty', () => {
    expect(isWithinBounds({ type: 'MultiPolygon', coordinates: [] }, cityBounds)).toBe(false);
    expect(isWithinBounds(validSquareMultiPolygon, { type: 'MultiPolygon', coordinates: [] })).toBe(false);
  });
});

describe('polygonsIntersect', () => {
  const polyA: GeoJSON.MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [0, 0],
          [0, 2],
          [2, 2],
          [2, 0],
          [0, 0],
        ],
      ],
    ],
  };

  it('returns true for two polygons sharing a touching edge', () => {
    const polyTouchingEdge: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [2, 0],
            [2, 2],
            [4, 2],
            [4, 0],
            [2, 0],
          ],
        ],
      ],
    };
    expect(polygonsIntersect(polyA, polyTouchingEdge)).toBe(true);
  });

  it('returns true for overlapping polygons', () => {
    const polyOverlap: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [1, 0],
            [1, 2],
            [3, 2],
            [3, 0],
            [1, 0],
          ],
        ],
      ],
    };
    expect(polygonsIntersect(polyA, polyOverlap)).toBe(true);
  });

  it('returns false for completely disjoint polygons', () => {
    const polyDisjoint: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [5, 0],
            [5, 2],
            [7, 2],
            [7, 0],
            [5, 0],
          ],
        ],
      ],
    };
    expect(polygonsIntersect(polyA, polyDisjoint)).toBe(false);
  });
});

describe('overlapAreaRatio', () => {
  const squareA: GeoJSON.MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [0, 0],
          [0, 2],
          [2, 2],
          [2, 0],
          [0, 0],
        ],
      ],
    ],
  };

  it('returns 0 for disjoint polygons', () => {
    const disjoint: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [10, 10],
            [10, 12],
            [12, 12],
            [12, 10],
            [10, 10],
          ],
        ],
      ],
    };
    expect(overlapAreaRatio(squareA, disjoint)).toBe(0);
  });

  it('returns 0 for edge-touching polygons that share zero area', () => {
    const touching: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [2, 0],
            [2, 2],
            [4, 2],
            [4, 0],
            [2, 0],
          ],
        ],
      ],
    };
    expect(overlapAreaRatio(squareA, touching)).toBe(0);
  });

  it('returns approximately 0.5 when half of the smaller polygon overlaps', () => {
    const halfOverlap: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [1, 0],
            [1, 2],
            [3, 2],
            [3, 0],
            [1, 0],
          ],
        ],
      ],
    };
    const ratio = overlapAreaRatio(squareA, halfOverlap);
    expect(ratio).toBeCloseTo(0.5, 2);
  });

  it('returns 1.0 for identical overlapping polygons', () => {
    const identical = structuredClone(squareA);
    expect(overlapAreaRatio(squareA, identical)).toBeCloseTo(1.0, 4);
  });

  it('returns 1.0 when a smaller polygon is entirely inside a larger polygon', () => {
    const larger: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [-5, -5],
            [-5, 10],
            [10, 10],
            [10, -5],
            [-5, -5],
          ],
        ],
      ],
    };
    expect(overlapAreaRatio(squareA, larger)).toBeCloseTo(1.0, 4);
  });
});

describe('coordinate tuple conversions (toLngLatTuple / fromLngLatTuple)', () => {
  it('converts between GridLatLng and [lng, lat] coordinate tuples', () => {
    const latLng = { lat: 40.7989, lng: -81.3784 };
    const tuple = toLngLatTuple(latLng);
    expect(tuple).toEqual([-81.3784, 40.7989]);

    const roundtrip = fromLngLatTuple(tuple);
    expect(roundtrip.lat).toBeCloseTo(40.7989, 5);
    expect(roundtrip.lng).toBeCloseTo(-81.3784, 5);
  });
});
