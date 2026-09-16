import { describe, expect, it } from 'vitest';
import {
  missingGridPlatformCapabilities,
  validateGridPlatformAdapter,
} from '../lib/grid/platform/capabilities';
import {
  gridPlatformFeatureSupport,
  listGridPlatformFeatureSupport,
} from '../lib/grid/platform/features';
import type { GridPlatformAdapter, GridLocationPort } from '../lib/grid/platform/types';

const location: GridLocationPort = {
  getPermission: async () => 'granted',
  requestPermission: async () => 'granted',
  getCurrentPosition: async () => ({
    latitude: 40.7989,
    longitude: -81.3784,
    accuracyMeters: 5,
    capturedAt: '2026-09-16T11:00:00.000Z',
  }),
};

describe('GRID platform capability validation', () => {
  it('accepts a capability-consistent adapter', () => {
    const adapter: GridPlatformAdapter = {
      kind: 'ios',
      capabilities: ['foreground-location'],
      location,
    };
    expect(validateGridPlatformAdapter(adapter)).toEqual([]);
  });
  it('detects missing ports, duplicate capabilities, and background dependency errors', () => {
    const adapter: GridPlatformAdapter = {
      kind: 'android',
      capabilities: ['background-location', 'background-location'],
    };
    expect(validateGridPlatformAdapter(adapter).map((issue) => issue.code)).toEqual([
      'DUPLICATE_CAPABILITY',
      'MISSING_DEPENDENCY',
      'MISSING_PORT',
      'MISSING_PORT',
    ]);
  });

  it('detects undeclared ports instead of silently exposing native functionality', () => {
    const adapter: GridPlatformAdapter = {
      kind: 'web',
      capabilities: [],
      location,
    };
    expect(validateGridPlatformAdapter(adapter)).toEqual([
      {
        code: 'UNDECLARED_PORT',
        message: 'Adapter port location exists without declaring a matching capability',
      },
    ]);
  });
  it('computes reusable feature availability without platform-specific branching', () => {
    const adapter: GridPlatformAdapter = {
      kind: 'ios',
      capabilities: ['foreground-location', 'camera'],
      location,
      camera: {
        getPermission: async () => 'granted',
        requestPermission: async () => 'granted',
        capturePhoto: async () => ({
          id: 'photo-1',
          mimeType: 'image/jpeg',
          byteLength: 100,
          capturedAt: '2026-09-16T11:00:00.000Z',
          localReference: 'native://photo/1',
        }),
      },
    };
    expect(gridPlatformFeatureSupport(adapter, 'player-location').available).toBe(true);
    expect(gridPlatformFeatureSupport(adapter, 'photo-proof').available).toBe(true);
    expect(gridPlatformFeatureSupport(adapter, 'live-alerts')).toEqual({
      feature: 'live-alerts',
      available: false,
      missingCapabilities: ['push-notifications'],
    });
    expect(listGridPlatformFeatureSupport(adapter)).toHaveLength(8);
    expect(missingGridPlatformCapabilities(adapter, ['camera', 'share'])).toEqual(['share']);
  });
});
