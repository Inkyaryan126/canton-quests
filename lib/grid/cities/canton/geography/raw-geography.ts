import fs from 'node:fs';
import path from 'node:path';
import type {
  GridPrivacyClass,
  GridProvenanceRecord,
  GridRawGeography,
} from '../../../compiler/types';

interface PolygonProps {
  slug?: string;
  name: string;
  districtSlug?: string;
  sourceRefs: string[];
}

interface PointProps {
  slug: string;
  name: string;
  territorySlug: string;
  privacyClass: GridPrivacyClass;
  publicNameSafe?: boolean;
  sourceRefs: string[];
}

type PolygonCollection = GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, PolygonProps>;
type PointCollection = GeoJSON.FeatureCollection<GeoJSON.Point, PointProps>;

const sourcesDir = path.resolve(process.cwd(), 'lib/grid/cities/canton/sources');

function readSourceJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(sourcesDir, filename), 'utf8')) as T;
}

const boundary = readSourceJson<GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>>('canton-boundary.geojson');
const districts = readSourceJson<PolygonCollection>('canton-downtown-districts.geojson');
const territories = readSourceJson<PolygonCollection>('canton-downtown-territories.geojson');
const properties = readSourceJson<PointCollection>('canton-downtown-properties.geojson');
const landmarks = readSourceJson<PointCollection>('canton-downtown-landmarks.geojson');
const provenanceJson = readSourceJson<GridProvenanceRecord[]>('provenance.json');

function requireFeature<T extends GeoJSON.Geometry>(
  collection: GeoJSON.FeatureCollection<T>,
  label: string,
): GeoJSON.Feature<T> {
  const feature = collection.features[0];
  if (!feature) throw new Error(`Missing Canton source feature: ${label}`);
  return feature;
}

function toPoint(feature: GeoJSON.Feature<GeoJSON.Point>): { lat: number; lng: number } {
  const [lng, lat] = feature.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Invalid Canton source point');
  }
  return { lat, lng };
}

export const cantonRawGeography: GridRawGeography = {
  citySlug: 'canton-oh',
  cityBoundary: requireFeature(boundary, 'municipal boundary').geometry,
  districts: districts.features.map((feature) => ({
    slug: feature.properties.slug!,
    name: feature.properties.name,
    geometry: feature.geometry,
    sourceRefs: [...feature.properties.sourceRefs],
  })),
  territories: territories.features.map((feature) => ({
    slug: feature.properties.slug!,
    name: feature.properties.name,
    districtSlug: feature.properties.districtSlug!,
    geometry: feature.geometry,
    sourceRefs: [...feature.properties.sourceRefs],
  })),

  properties: properties.features.map((feature) => ({
    slug: feature.properties.slug,
    name: feature.properties.name,
    territorySlug: feature.properties.territorySlug,
    point: toPoint(feature),
    privacyClass: feature.properties.privacyClass,
    publicNameSafe: feature.properties.publicNameSafe === true,
    sourceRefs: [...feature.properties.sourceRefs],
  })),
  landmarks: landmarks.features.map((feature) => ({
    slug: feature.properties.slug,
    name: feature.properties.name,
    territorySlug: feature.properties.territorySlug,
    point: toPoint(feature),
    privacyClass: feature.properties.privacyClass,
    sourceRefs: [...feature.properties.sourceRefs],
  })),
  provenance: provenanceJson as GridProvenanceRecord[],
};
