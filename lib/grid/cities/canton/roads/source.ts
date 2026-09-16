import fs from 'node:fs';
import path from 'node:path';
import type { GridRoadClass, GridRoadSourceFeature } from '../../../roads/types';

type RoadCollection = GeoJSON.FeatureCollection<
  GeoJSON.LineString | GeoJSON.MultiLineString,
  Record<string, unknown>
>;

const sourceRoot = path.resolve(
  process.cwd(),
  'research/grid/canton/source-data/processed',
);

function readCollection(roadClass: GridRoadClass): RoadCollection {
  const filename = path.join(sourceRoot, `canton-${roadClass}-roads.geojson`);
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as RoadCollection;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function featureOid(properties: Record<string, unknown>): string {
  const oid = properties.OID;
  if (typeof oid !== 'string' && typeof oid !== 'number') {
    throw new Error('Canton road source feature is missing OID');
  }
  return String(oid);
}
export function loadCantonRoadSourceFeatures(): GridRoadSourceFeature[] {
  const classes: GridRoadClass[] = ['primary', 'secondary', 'local'];
  return classes.flatMap((roadClass) =>
    readCollection(roadClass).features.map((feature) => ({
      roadClass,
      properties: {
        oid: featureOid(feature.properties ?? {}),
        name: nullableString(feature.properties?.NAME),
        mtfcc: nullableString(feature.properties?.MTFCC),
        routeType: nullableString(feature.properties?.RTTYP),
      },
      geometry: feature.geometry,
    })),
  );
}
