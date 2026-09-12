import { createSeededRng } from './rng';
import type { GridRawDistrict, GridRawTerritory } from '../compiler/types';

export interface SyntheticGeography {
  districts: GridRawDistrict[];
  territories: GridRawTerritory[];
}

const DISTRICT_COUNT = 4;
const CELL_SIZE = 1;

interface Cell {
  col: number;
  row: number;
}

function square(x0: number, y0: number, size: number): GeoJSON.MultiPolygon {
  const x1 = x0 + size;
  const y1 = y0 + size;
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

function boundingSquare(cells: Cell[]): GeoJSON.MultiPolygon {
  const cols = cells.map((cell) => cell.col);
  const rows = cells.map((cell) => cell.row);
  const x0 = Math.min(...cols) * CELL_SIZE;
  const y0 = Math.min(...rows) * CELL_SIZE;
  const x1 = (Math.max(...cols) + 1) * CELL_SIZE;
  const y1 = (Math.max(...rows) + 1) * CELL_SIZE;
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

/**
 * Deterministically generates `count` roughly-square, non-overlapping, edge-adjacent
 * territory polygons filled row-major into a grid (so every territory has at least one
 * neighbor), grouped into a small fixed number of synthetic districts. City-agnostic --
 * synthetic test/simulation infrastructure, not compiler logic.
 */
export function generateSyntheticGeography(count: number, seed: number): SyntheticGeography {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('count must be a positive integer');
  }

  const rng = createSeededRng(seed);
  const cols = Math.ceil(Math.sqrt(count));
  const districtCount = Math.min(DISTRICT_COUNT, count);
  const districtSlugs = Array.from({ length: districtCount }, (_, i) => `synthetic-district-${i + 1}`);
  const districtCells: Cell[][] = districtSlugs.map(() => []);

  const territories: GridRawTerritory[] = Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const districtIndex = Math.min(Math.floor(rng() * districtCount), districtCount - 1);
    districtCells[districtIndex].push({ col, row });

    return {
      slug: `synthetic-territory-${i + 1}`,
      name: `Synthetic Territory ${i + 1}`,
      districtSlug: districtSlugs[districtIndex],
      geometry: square(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE),
      baseValue: Math.round(rng() * 100),
      sourceRefs: [],
    };
  });

  const districts: GridRawDistrict[] = districtSlugs.map((slug, i) => ({
    slug,
    name: `Synthetic District ${i + 1}`,
    geometry: districtCells[i].length > 0 ? boundingSquare(districtCells[i]) : square(0, 0, 0),
    sourceRefs: [],
  }));

  return { districts, territories };
}
