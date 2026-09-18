import { describe, expect, it, vi } from 'vitest';
import { createGridPlatformRuntime } from '../lib/grid/platform/runtime';
import { createGridWebPlatformAdapter } from '../lib/grid/platform/web';

describe('GRID web platform adapter', () => {
  it('infers only capabilities that the browser environment actually exposes', () => {
    const adapter = createGridWebPlatformAdapter({
      geolocation: { getCurrentPosition: () => undefined },
      vibrate: () => true,
      share: async () => undefined,
      currentUrl: () => 'https://www.cantonquests.com/grid',
    });
    expect(adapter.capabilities).toEqual([
      'foreground-location',
      'haptics',
      'share',
      'deep-links',
    ]);
    expect(adapter.capabilities).not.toContain('background-location');
    expect(adapter.capabilities).not.toContain('secure-storage');
  });

  it('maps browser geolocation into the platform-neutral location contract', async () => {
    const optionsSeen: unknown[] = [];
    const adapter = createGridWebPlatformAdapter({
      permissions: { query: async () => ({ state: 'granted' }) },
      geolocation: {
        getCurrentPosition: (success, _error, options) => {
          optionsSeen.push(options);
          success({
            timestamp: Date.parse('2026-09-16T12:00:00.000Z'),
            coords: { latitude: 40.7989, longitude: -81.3784, accuracy: 4.5 },
          });
        },
      },
    });
    const runtime = createGridPlatformRuntime(adapter);
    expect(await runtime.requireLocation().getPermission()).toBe('granted');
    const position = await runtime.requireLocation().getCurrentPosition({
      accuracy: 'high',
      timeoutMs: 5000,
      maximumAgeMs: 1000,
    });
    expect(position).toEqual({
      latitude: 40.7989,
      longitude: -81.3784,
      accuracyMeters: 4.5,
      capturedAt: '2026-09-16T12:00:00.000Z',
      altitudeMeters: null,
      headingDegrees: null,
      speedMetersPerSecond: null,
    });
    expect(optionsSeen).toEqual([{
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 1000,
    }]);
    expect(await runtime.requireLocation().requestPermission('background')).toBe('unavailable');
  });

  it('translates haptic patterns and browser share cancellation deterministically', async () => {
    const vibrate = vi.fn(() => true);
    const share = vi.fn(async () => {
      const error = new Error('cancelled');
      error.name = 'AbortError';
      throw error;
    });
    const runtime = createGridPlatformRuntime(
      createGridWebPlatformAdapter({ vibrate, share }),
    );
    await runtime.requireHaptics().trigger('success');
    expect(vibrate).toHaveBeenCalledWith([15, 40, 15]);
    await expect(runtime.requireShare().share({ text: 'Grid mission' })).resolves.toBe('cancelled');
  });

  it('accepts host-supplied camera and push adapters without baking them into game logic', () => {
    const adapter = createGridWebPlatformAdapter({
      camera: {
        getPermission: async () => 'granted',
        requestPermission: async () => 'granted',
        capturePhoto: async () => ({
          id: 'p1',
          mimeType: 'image/jpeg',
          byteLength: 42,
          capturedAt: '2026-09-16T12:00:00.000Z',
          localReference: 'blob://p1',
        }),
      },
      notifications: {
        getPermission: async () => 'granted',
        requestPermission: async () => 'granted',
        getPushRegistration: async () => ({ provider: 'web-push', token: 'opaque' }),
      },
    });
    expect(adapter.capabilities).toEqual(['camera', 'push-notifications']);
    expect(createGridPlatformRuntime(adapter).feature('photo-proof').available).toBe(true);
  });

  it('accepts a host-supplied lifecycle port for PWA/native parity', async () => {
    const lifecycle = {
      getState: async () => 'active' as const,
      subscribe: () => () => undefined,
    };
    const adapter = createGridWebPlatformAdapter({ lifecycle } as never);

    expect(adapter.capabilities).toContain('app-lifecycle');
    expect(adapter.lifecycle).toBe(lifecycle);
    await expect(createGridPlatformRuntime(adapter).requireLifecycle().getState()).resolves.toBe('active');
  });
});
