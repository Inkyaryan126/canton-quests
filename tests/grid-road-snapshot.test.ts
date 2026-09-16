import { describe, expect, it } from 'vitest';
import { loadCantonRoadSourceFeatures } from '../lib/grid/cities/canton/roads/source';
import { buildRoadNetwork } from '../lib/grid/roads/network';
import {
  createRoadNetworkSnapshot,
  parseRoadNetworkSnapshot,
  serializeRoadNetworkSnapshot,
  verifyRoadNetworkSnapshot,
} from '../lib/grid/roads/snapshot';

const cantonNetwork = buildRoadNetwork(loadCantonRoadSourceFeatures(), {
  cellSizeDegrees: 0.002,
});

describe('GRID road network snapshots', () => {
  it('produces a deterministic versioned checksum for the real Canton network', () => {
    const first = createRoadNetworkSnapshot(cantonNetwork, 'canton-roads-v1');
    const second = createRoadNetworkSnapshot(cantonNetwork, 'canton-roads-v1');
    expect(second.checksum).toBe(first.checksum);
    expect(second).toEqual(first);
    expect(first.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyRoadNetworkSnapshot(first).ok).toBe(true);
  });

  it('round-trips the full road snapshot through canonical JSON', () => {
    const snapshot = createRoadNetworkSnapshot(cantonNetwork, 'canton-roads-v1');
    const serialized = serializeRoadNetworkSnapshot(snapshot);
    const restored = parseRoadNetworkSnapshot(serialized);
    expect(restored).toEqual(snapshot);
    expect(serializeRoadNetworkSnapshot(restored)).toBe(serialized);
  });
  it('detects tampering anywhere inside the network payload', () => {
    const snapshot = createRoadNetworkSnapshot(cantonNetwork, 'canton-roads-v1');
    const tampered = structuredClone(snapshot);
    tampered.network.graph.edges[0].lengthMillimeters += 1;
    const verification = verifyRoadNetworkSnapshot(tampered);
    expect(verification.ok).toBe(false);
    expect(verification.actualChecksum).not.toBe(verification.expectedChecksum);
    expect(() => parseRoadNetworkSnapshot(JSON.stringify(tampered))).toThrow(/checksum mismatch/i);
  });

  it('rejects unsupported schema versions during parsing', () => {
    const snapshot = createRoadNetworkSnapshot(cantonNetwork, 'canton-roads-v1');
    const incompatible = { ...snapshot, schemaVersion: 2 };
    expect(() => parseRoadNetworkSnapshot(JSON.stringify(incompatible))).toThrow(
      /unsupported road network snapshot schema version/i,
    );
  });
});
