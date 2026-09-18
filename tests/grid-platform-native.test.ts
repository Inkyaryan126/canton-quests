import { describe, expect, it, vi } from 'vitest';
import { createGridNativePlatformAdapter } from '../lib/grid/platform/native';
import { createGridPlatformRuntime } from '../lib/grid/platform/runtime';
import type { GridLocationPort } from '../lib/grid/platform/types';

const location: GridLocationPort = {
  getPermission: async () => 'granted',
  requestPermission: async () => 'granted',
  getCurrentPosition: async () => ({
    latitude: 40.7989,
    longitude: -81.3784,
    accuracyMeters: 3,
    capturedAt: '2026-09-16T23:00:00.000Z',
  }),
};

describe('GRID native platform adapter', () => {
  it('derives a complete iOS capability set from supplied native ports', () => {
    const adapter = createGridNativePlatformAdapter({
      kind: 'ios',
      location,
      backgroundLocation: true,
      camera: {
        getPermission: async () => 'granted',
        requestPermission: async () => 'granted',
        capturePhoto: async () => ({
          id: 'photo-1',
          mimeType: 'image/jpeg',
          byteLength: 2048,
          capturedAt: '2026-09-16T23:00:00.000Z',
          localReference: 'ph://asset-1',
        }),
      },
      notifications: {
        getPermission: async () => 'granted',
        requestPermission: async () => 'granted',
        getPushRegistration: async () => ({ provider: 'apns', token: 'opaque-apns-token' }),
      },
      haptics: { trigger: async () => undefined },
      secureStorage: {
        get: async () => null,
        set: async () => undefined,
        remove: async () => undefined,
      },
      share: { share: async () => 'shared' },
      deepLinks: { getInitialUrl: async () => 'thegrid://canton/mission/1' },
    });
    expect(adapter.kind).toBe('ios');
    expect(adapter.capabilities).toEqual([
      'foreground-location',
      'background-location',
      'camera',
      'push-notifications',
      'haptics',
      'secure-storage',
      'share',
      'deep-links',
    ]);

    const runtime = createGridPlatformRuntime(adapter);
    expect(runtime.feature('background-presence').available).toBe(true);
    expect(runtime.feature('secure-session').available).toBe(true);
    expect(runtime.feature('live-alerts').available).toBe(true);
  });

  it('keeps optional Android capabilities absent when the shell does not supply them', () => {
    const adapter = createGridNativePlatformAdapter({
      kind: 'android',
      location,
      haptics: { trigger: async () => undefined },
    });
    expect(adapter.capabilities).toEqual(['foreground-location', 'haptics']);
    const runtime = createGridPlatformRuntime(adapter);
    expect(runtime.feature('player-location').available).toBe(true);
    expect(runtime.feature('background-presence').available).toBe(false);
    expect(runtime.feature('photo-proof').available).toBe(false);
    expect(runtime.feature('secure-session').available).toBe(false);
  });
  it('requires an actual location port before advertising background location', () => {
    expect(() =>
      createGridNativePlatformAdapter({
        kind: 'ios',
        backgroundLocation: true,
      }),
    ).toThrow(/background location requires a location port/i);
  });

  it('passes native haptic calls through without translating platform semantics', async () => {
    const trigger = vi.fn(async () => undefined);
    const runtime = createGridPlatformRuntime(
      createGridNativePlatformAdapter({
        kind: 'android',
        haptics: { trigger },
      }),
    );
    await runtime.requireHaptics().trigger('impact-heavy');
    expect(trigger).toHaveBeenCalledWith('impact-heavy');
  });
});
