import crypto from 'node:crypto';
import type {
  GridRoadNetwork,
  GridRoadNetworkSnapshot,
  GridRoadSnapshotVerification,
} from './types';

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    result[key] = canonicalize(record[key]);
  }
  return result;
}

function snapshotPayload(
  snapshotVersion: string,
  network: GridRoadNetwork,
): Omit<GridRoadNetworkSnapshot, 'checksum'> {
  return {
    schemaVersion: 1,
    snapshotVersion,
    network,
  };
}

function checksumPayload(payload: Omit<GridRoadNetworkSnapshot, 'checksum'>): string {
  const serialized = JSON.stringify(canonicalize(payload));
  return crypto.createHash('sha256').update(serialized).digest('hex');
}
export function createRoadNetworkSnapshot(
  network: GridRoadNetwork,
  snapshotVersion: string,
): GridRoadNetworkSnapshot {
  if (!snapshotVersion.trim()) {
    throw new Error('road network snapshot version is required');
  }
  const payload = snapshotPayload(snapshotVersion, network);
  return { ...payload, checksum: checksumPayload(payload) };
}

export function verifyRoadNetworkSnapshot(
  snapshot: GridRoadNetworkSnapshot,
): GridRoadSnapshotVerification {
  const payload = snapshotPayload(snapshot.snapshotVersion, snapshot.network);
  const actualChecksum = checksumPayload(payload);
  return {
    ok: actualChecksum === snapshot.checksum,
    expectedChecksum: snapshot.checksum,
    actualChecksum,
  };
}

export function serializeRoadNetworkSnapshot(
  snapshot: GridRoadNetworkSnapshot,
): string {
  return JSON.stringify(canonicalize(snapshot));
}
export function parseRoadNetworkSnapshot(serialized: string): GridRoadNetworkSnapshot {
  const parsed = JSON.parse(serialized) as GridRoadNetworkSnapshot;
  if (parsed.schemaVersion !== 1) {
    throw new Error(`unsupported road network snapshot schema version: ${String(parsed.schemaVersion)}`);
  }
  const verification = verifyRoadNetworkSnapshot(parsed);
  if (!verification.ok) {
    throw new Error(
      `road network snapshot checksum mismatch: expected ${verification.expectedChecksum} got ${verification.actualChecksum}`,
    );
  }
  return parsed;
}
