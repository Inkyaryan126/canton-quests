import type { GridRoadSegment, GridRoadSourceFeature } from './types';

function normalizeName(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function positionsFor(feature: GridRoadSourceFeature): GeoJSON.Position[][] {
  return feature.geometry.type === 'LineString'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
}

export function normalizeRoadSourceFeatures(
  features: GridRoadSourceFeature[],
): GridRoadSegment[] {
  const segments: GridRoadSegment[] = [];

  for (const feature of features) {
    const parts = positionsFor(feature);
    parts.forEach((coordinates, sourcePartIndex) => {
      if (coordinates.length < 2) return;
      segments.push({
        id: `${feature.roadClass}:${feature.properties.oid}:${sourcePartIndex}`,
        roadClass: feature.roadClass,
        sourceOid: feature.properties.oid,
        sourcePartIndex,
        name: normalizeName(feature.properties.name),
        mtfcc: normalizeName(feature.properties.mtfcc),
        routeType: normalizeName(feature.properties.routeType),
        coordinates: coordinates.map((position) => [...position]),
      });
    });
  }
  return segments.sort((a, b) => {
    const classOrder = { primary: 0, secondary: 1, local: 2 } as const;
    const classDelta = classOrder[a.roadClass] - classOrder[b.roadClass];
    if (classDelta !== 0) return classDelta;
    const oidDelta = a.sourceOid.localeCompare(b.sourceOid);
    if (oidDelta !== 0) return oidDelta;
    return a.sourcePartIndex - b.sourcePartIndex;
  });
}
