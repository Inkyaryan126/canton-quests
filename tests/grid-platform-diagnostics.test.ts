import { describe, expect, it, vi } from 'vitest';
import * as platform from '../lib/grid/platform';
import { createGridNativePlatformAdapter } from '../lib/grid/platform/native';
import { createGridPlatformRuntime } from '../lib/grid/platform/runtime';

describe('GRID safe platform diagnostics', () => {
  it('exports a safe diagnostics builder', () => {
    expect(typeof (platform as Record<string, unknown>).buildGridPlatformDiagnostics).toBe('function');
  });

  it('reports compatibility and capability shape without reading sensitive ports', async () => {
    const getCurrentPosition = vi.fn(async () => ({
      latitude: 40.7989, longitude: -81.3784, accuracyMeters: 3,
      capturedAt: '2026-09-17T19:00:00.000Z',
    }));
    const getPushRegistration = vi.fn(async () => ({ provider: 'apns' as const, token: 'SECRET_PUSH_TOKEN' }));
    const secureGet = vi.fn(async () => 'SECRET_SESSION_VALUE');
    const getInitialUrl = vi.fn(async () => 'thegrid://grid/private?invite=SECRET_INVITE');
    const runtime = createGridPlatformRuntime(createGridNativePlatformAdapter({
      kind: 'ios',
      location: {
        getPermission: async () => 'granted',
        requestPermission: async () => 'granted',
        getCurrentPosition,
      },
      notifications: {
        getPermission: async () => 'granted',
        requestPermission: async () => 'granted',
        getPushRegistration,
      },
      secureStorage: {
        get: secureGet,
        set: async () => undefined,
        remove: async () => undefined,
      },
      deepLinks: { getInitialUrl },
      lifecycle: {
        getState: async () => 'background',
        subscribe: () => () => undefined,
      },
    }));

    const build = platform.buildGridPlatformDiagnostics as unknown as (
      runtimeArg: typeof runtime,
    ) => Promise<Record<string, unknown>>;
    const diagnostics = await build(runtime);
    expect(diagnostics).toMatchObject({
      bridgeVersion: 1,
      platform: 'ios',
      lifecycleState: 'background',
      capabilities: [
        'app-lifecycle', 'deep-links', 'foreground-location',
        'push-notifications', 'secure-storage',
      ],
    });

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(getPushRegistration).not.toHaveBeenCalled();
    expect(secureGet).not.toHaveBeenCalled();
    expect(getInitialUrl).not.toHaveBeenCalled();

    const serialized = JSON.stringify(diagnostics);
    expect(serialized).not.toContain('SECRET_');
    expect(serialized).not.toContain('40.7989');
    expect(serialized).not.toContain('thegrid://');
  });
});
