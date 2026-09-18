import { describe, expect, it, vi } from 'vitest';
import { createGridNativePlatformAdapter } from '../lib/grid/platform/native';
import { requestGridPlatformFeaturePermission } from '../lib/grid/platform/permissions';
import { createGridPlatformRuntime } from '../lib/grid/platform/runtime';

describe('GRID platform permission flows', () => {
  it('requests foreground location only when the player-location feature is invoked', async () => {
    const requestPermission = vi.fn(async () => 'granted' as const);
    const runtime = createGridPlatformRuntime(createGridNativePlatformAdapter({
      kind: 'ios',
      location: {
        getPermission: async () => 'prompt',
        requestPermission,
        getCurrentPosition: async () => ({
          latitude: 40.79, longitude: -81.37, accuracyMeters: 5,
          capturedAt: '2026-09-16T23:00:00.000Z',
        }),
      },
    }));

    expect(requestPermission).not.toHaveBeenCalled();
    const result = await requestGridPlatformFeaturePermission(runtime, 'player-location');
    expect(requestPermission).toHaveBeenCalledWith('foreground');
    expect(result).toEqual({
      feature: 'player-location',
      supported: true,
      state: 'granted',
      missingCapabilities: [],
      steps: [{ capability: 'foreground-location', state: 'granted' }],
    });
  });
  it('requests background location only after foreground permission succeeds', async () => {
    const requestPermission = vi
      .fn()
      .mockResolvedValueOnce('granted')
      .mockResolvedValueOnce('granted');
    const runtime = createGridPlatformRuntime(createGridNativePlatformAdapter({
      kind: 'android',
      backgroundLocation: true,
      location: {
        getPermission: async () => 'prompt',
        requestPermission,
        getCurrentPosition: async () => ({
          latitude: 40.79, longitude: -81.37, accuracyMeters: 5,
          capturedAt: '2026-09-16T23:00:00.000Z',
        }),
      },
    }));

    const result = await requestGridPlatformFeaturePermission(runtime, 'background-presence');
    expect(requestPermission.mock.calls).toEqual([['foreground'], ['background']]);
    expect(result.state).toBe('granted');
    expect(result.steps).toEqual([
      { capability: 'foreground-location', state: 'granted' },
      { capability: 'background-location', state: 'granted' },
    ]);
  });

  it('does not request background permission after foreground location is denied', async () => {
    const requestPermission = vi.fn(async () => 'denied' as const);
    const runtime = createGridPlatformRuntime(createGridNativePlatformAdapter({
      kind: 'ios',
      backgroundLocation: true,
      location: {
        getPermission: async () => 'prompt',
        requestPermission,
        getCurrentPosition: async () => ({
          latitude: 40.79, longitude: -81.37, accuracyMeters: 5,
          capturedAt: '2026-09-16T23:00:00.000Z',
        }),
      },
    }));

    const result = await requestGridPlatformFeaturePermission(runtime, 'background-presence');
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(requestPermission).toHaveBeenCalledWith('foreground');
    expect(result.state).toBe('denied');
    expect(result.steps).toEqual([
      { capability: 'foreground-location', state: 'denied' },
    ]);
  });
  it('routes photo proof and live-alert permission prompts through their own ports', async () => {
    const cameraPermission = vi.fn(async () => 'granted' as const);
    const notificationPermission = vi.fn(async () => 'denied' as const);
    const runtime = createGridPlatformRuntime(createGridNativePlatformAdapter({
      kind: 'ios',
      camera: {
        getPermission: async () => 'prompt',
        requestPermission: cameraPermission,
        capturePhoto: async () => ({
          id: 'photo', mimeType: 'image/jpeg', byteLength: 1,
          capturedAt: '2026-09-16T23:00:00.000Z', localReference: 'ph://photo',
        }),
      },
      notifications: {
        getPermission: async () => 'prompt',
        requestPermission: notificationPermission,
        getPushRegistration: async () => null,
      },
    }));

    expect((await requestGridPlatformFeaturePermission(runtime, 'photo-proof')).state).toBe('granted');
    expect(cameraPermission).toHaveBeenCalledTimes(1);
    expect((await requestGridPlatformFeaturePermission(runtime, 'live-alerts')).state).toBe('denied');
    expect(notificationPermission).toHaveBeenCalledTimes(1);
  });

  it('returns unavailable without prompting when the client lacks a required capability', async () => {
    const runtime = createGridPlatformRuntime(createGridNativePlatformAdapter({ kind: 'android' }));
    const result = await requestGridPlatformFeaturePermission(runtime, 'photo-proof');
    expect(result).toEqual({
      feature: 'photo-proof',
      supported: false,
      state: 'unavailable',
      missingCapabilities: ['camera'],
      steps: [],
    });
  });
});
