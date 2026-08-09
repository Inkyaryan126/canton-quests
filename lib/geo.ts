// Canton Quests — Geolocation & Spatial Proximity Utilities

export interface GeolocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface ProximityResult {
  isWithinRadius: boolean;
  distanceMeters: number;
  radiusMeters: number;
  formattedDistance: string;
  message: string;
}

/**
 * Calculates the great-circle distance between two points in meters using the Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_METERS = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Formats distance in meters into human-readable string (e.g. "45m", "1.2km").
 */
export function formatDistance(meters: number): string {
  if (isNaN(meters) || meters < 0) return 'Unknown distance';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}

/**
 * Evaluates whether player coordinates are within a target location's radius.
 */
export function checkProximity(
  playerCoords: GeolocationCoords,
  targetLat: number,
  targetLon: number,
  radiusMeters: number = 100
): ProximityResult {
  const distance = calculateDistanceMeters(
    playerCoords.latitude,
    playerCoords.longitude,
    targetLat,
    targetLon
  );

  const isWithinRadius = distance <= radiusMeters;
  const formattedDist = formatDistance(distance);

  let message = '';
  if (isWithinRadius) {
    message = `Proximity signal verified! You are within ${formattedDist} of target (Required: ${radiusMeters}m).`;
  } else {
    const remaining = distance - radiusMeters;
    message = `Too far from target location. You are ${formattedDist} away (Move ${formatDistance(remaining)} closer to get within ${radiusMeters}m).`;
  }

  return {
    isWithinRadius,
    distanceMeters: distance,
    radiusMeters,
    formattedDistance: formattedDist,
    message,
  };
}
