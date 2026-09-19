import { calculateDistanceMeters } from '../../geo';

export interface GridLocationPresenceZone {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
}

export interface GridLocationPresenceMeasurement {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

export type GridLocationPresenceDecision =
  | { verified: true; reason: 'verified' }
  | {
      verified: false;
      reason: 'accuracy-insufficient' | 'outside-zone';
    };

function finiteNumber(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Grid location presence requires finite ${field}`);
  }
  return value;
}

function positiveFinite(value: number, field: string): number {
  finiteNumber(value, field);
  if (value <= 0) {
    throw new Error(`Grid location presence requires positive ${field}`);
  }
  return value;
}

export function validateGridLocationPresenceZone(
  zone: GridLocationPresenceZone,
): void {
  if (!zone.id.trim()) {
    throw new Error('Grid location presence requires zone id');
  }
  finiteNumber(zone.latitude, 'zone latitude');
  finiteNumber(zone.longitude, 'zone longitude');
  if (zone.latitude < -90 || zone.latitude > 90) {
    throw new Error('Grid location presence zone latitude is invalid');
  }
  if (zone.longitude < -180 || zone.longitude > 180) {
    throw new Error('Grid location presence zone longitude is invalid');
  }
  positiveFinite(zone.radiusMeters, 'zone radiusMeters');
  positiveFinite(zone.maxAccuracyMeters, 'zone maxAccuracyMeters');
  if (zone.maxAccuracyMeters > zone.radiusMeters) {
    throw new Error(
      'Grid location presence zone maxAccuracyMeters cannot exceed radiusMeters',
    );
  }
}

function validateMeasurement(
  measurement: GridLocationPresenceMeasurement,
): void {
  finiteNumber(measurement.latitude, 'latitude');
  finiteNumber(measurement.longitude, 'longitude');
  if (measurement.latitude < -90 || measurement.latitude > 90) {
    throw new Error('Grid location presence latitude is invalid');
  }
  if (measurement.longitude < -180 || measurement.longitude > 180) {
    throw new Error('Grid location presence longitude is invalid');
  }
  finiteNumber(measurement.accuracyMeters, 'accuracyMeters');
  if (measurement.accuracyMeters < 0) {
    throw new Error('Grid location presence accuracyMeters is invalid');
  }
}

export function verifyGridLocationPresence(
  zone: GridLocationPresenceZone,
  measurement: GridLocationPresenceMeasurement,
): GridLocationPresenceDecision {
  validateGridLocationPresenceZone(zone);
  validateMeasurement(measurement);

  if (measurement.accuracyMeters > zone.maxAccuracyMeters) {
    return { verified: false, reason: 'accuracy-insufficient' };
  }

  const distanceMeters = calculateDistanceMeters(
    measurement.latitude,
    measurement.longitude,
    zone.latitude,
    zone.longitude,
  );

  // Fail closed unless the entire reported accuracy envelope is inside the
  // configured game zone. A weak edge measurement cannot become a proof.
  if (distanceMeters + measurement.accuracyMeters > zone.radiusMeters) {
    return { verified: false, reason: 'outside-zone' };
  }

  return { verified: true, reason: 'verified' };
}
