export type GridRoadClass = 'primary' | 'secondary' | 'local';

export interface GridRoadSourceProperties {
  oid: string;
  name: string | null;
  mtfcc: string | null;
  routeType: string | null;
}

export interface GridRoadSourceFeature {
  roadClass: GridRoadClass;
  properties: GridRoadSourceProperties;
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString;
}

export interface GridRoadSegment {
  id: string;
  roadClass: GridRoadClass;
  sourceOid: string;
  sourcePartIndex: number;
  name: string | null;
  mtfcc: string | null;
  routeType: string | null;
  coordinates: GeoJSON.Position[];
}
