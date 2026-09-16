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
export interface GridRoadNode {
  id: string;
  lng: number;
  lat: number;
}

export interface GridRoadGraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  roadClass: GridRoadClass;
  sourceSegmentId: string;
  sourceVertexIndex: number;
  name: string | null;
  mtfcc: string | null;
  routeType: string | null;
  lengthMillimeters: number;
}

export interface GridRoadGraphComponent {
  id: string;
  nodeIds: string[];
  edgeIds: string[];
}

export interface GridRoadGraph {
  coordinatePrecision: number;
  nodes: GridRoadNode[];
  edges: GridRoadGraphEdge[];
  components: GridRoadGraphComponent[];
}
export interface GridRoadGraphValidationIssue {
  code: 'DUPLICATE_NODE' | 'DUPLICATE_EDGE' | 'MISSING_ENDPOINT' | 'INVALID_LENGTH' | 'ORPHAN_NODE';
  message: string;
  assetId: string;
}

export interface GridRoadRoute {
  fromNodeId: string;
  toNodeId: string;
  nodeIds: string[];
  edgeIds: string[];
  totalLengthMillimeters: number;
}
export interface GridRoadSpatialIndex {
  cellSizeDegrees: number;
  cells: Record<string, string[]>;
}

export interface GridRoadPoint {
  lng: number;
  lat: number;
}

export interface GridRoadSnap {
  nodeId: string;
  lng: number;
  lat: number;
  distanceMillimeters: number;
}
export interface GridRoadSnappedRoute {
  fromSnap: GridRoadSnap;
  toSnap: GridRoadSnap;
  route: GridRoadRoute;
}
export interface GridRoadTerritoryDefinition {
  slug: string;
  geometry: GeoJSON.MultiPolygon;
}

export interface GridRoadTerritoryIndex {
  nodeTerritories: Record<string, string[]>;
  edgeTerritories: Record<string, string[]>;
  territoryNodeIds: Record<string, string[]>;
  territoryEdgeIds: Record<string, string[]>;
  unassignedNodeIds: string[];
  unassignedEdgeIds: string[];
}
export interface GridRoadNetwork {
  segments: GridRoadSegment[];
  graph: GridRoadGraph;
  routingIndex: GridRoadRoutingIndex;
  spatialIndex: GridRoadSpatialIndex;
  territoryIndex?: GridRoadTerritoryIndex;
}

export interface GridRoadRouteRoadStep {
  edgeIndex: number;
  roadClass: GridRoadClass;
  name: string | null;
}

export interface GridRoadRouteTerritoryStep {
  edgeIndex: number;
  territorySlugs: string[];
}

export interface GridRoadRouteContext {
  roadSteps: GridRoadRouteRoadStep[];
  territorySteps: GridRoadRouteTerritoryStep[];
  unassignedEdgeCount: number;
}
export type GridRoadAccessTargetKind = 'property' | 'landmark' | 'mission' | 'npc' | 'custom';

export interface GridRoadAccessTarget {
  id: string;
  kind: GridRoadAccessTargetKind;
  point: GridRoadPoint;
}

export interface GridRoadAccessRecord {
  targetId: string;
  kind: GridRoadAccessTargetKind;
  point: GridRoadPoint;
  snap: GridRoadSnap | null;
}

export interface GridRoadAccessIndex {
  maxSnapDistanceMeters: number;
  records: GridRoadAccessRecord[];
  resolvedTargetIds: string[];
  unresolvedTargetIds: string[];
}
export interface GridRoadAccessJourney {
  fromTargetId: string;
  toTargetId: string;
  fromSnap: GridRoadSnap;
  toSnap: GridRoadSnap;
  route: GridRoadRoute;
  context: GridRoadRouteContext;
}
export interface GridRoadRoutingArc {
  edgeId: string;
  toNodeId: string;
  lengthMillimeters: number;
}

export interface GridRoadRoutingIndex {
  adjacency: Record<string, GridRoadRoutingArc[]>;
  componentByNode: Record<string, string>;
}
export interface GridRoadAccessDistanceMatrix {
  targetIds: string[];
  distancesMillimeters: Record<string, Record<string, number | null>>;
}
