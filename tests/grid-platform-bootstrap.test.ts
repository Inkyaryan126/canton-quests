import { describe, expect, it } from 'vitest';
import * as platform from '../lib/grid/platform';
import { createGridNativePlatformAdapter } from '../lib/grid/platform/native';
import { createGridPlatformRuntime } from '../lib/grid/platform/runtime';
import type { GridPlatformRuntime } from '../lib/grid/platform/runtime';

const launchConfig = {
  trustedHosts: ['www.cantonquests.com'],
  customSchemes: ['thegrid'],
} as const;

describe('GRID platform bootstrap snapshot', () => {
  it('exports a shared bootstrap builder for app shells', () => {
    expect(typeof (platform as Record<string, unknown>).buildGridPlatformBootstrap).toBe('function');
  });

  it('builds one deterministic startup snapshot for a native shell', async () => {
    const runtime = createGridPlatformRuntime(createGridNativePlatformAdapter({
      kind: 'ios',
      lifecycle: {
        getState: async () => 'background',
        subscribe: () => () => undefined,
      },
      camera: {
        getPermission: async () => 'granted',
        requestPermission: async () => 'granted',
        capturePhoto: async () => ({
          id: 'photo', mimeType: 'image/jpeg', byteLength: 1,
          capturedAt: '2026-09-17T18:30:00.000Z', localReference: 'ph://photo',
        }),
      },
      deepLinks: {
        getInitialUrl: async () => 'thegrid://grid/mission/alpha?source=push',
      },
    }));

    const build = platform.buildGridPlatformBootstrap as unknown as (
      runtimeArg: GridPlatformRuntime,
      config: typeof launchConfig,
    ) => Promise<Record<string, unknown>>;
    await expect(build(runtime, launchConfig)).resolves.toMatchObject({
      bridgeVersion: 1,
      platform: 'ios',
      capabilities: ['app-lifecycle', 'camera', 'deep-links'],
      lifecycleState: 'background',
      initialLaunchIntent: {
        ok: true,
        intent: {
          source: 'custom-scheme',
          path: '/grid/mission/alpha',
          query: { source: ['push'] },
          fragment: null,
        },
      },
    });
  });
});
