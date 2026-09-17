import { describe, expect, it } from 'vitest';
import { createGridPlatformRuntime } from '../lib/grid/platform/runtime';
import type { GridPlatformAdapter } from '../lib/grid/platform/types';

describe('GRID platform runtime', () => {
  it('exposes only validated capabilities through typed accessors', async () => {
    const adapter: GridPlatformAdapter = {
      bridgeVersion: 1,
      kind: 'test',
      capabilities: ['secure-storage', 'haptics'],
      secureStorage: {
        get: async (key) => (key === 'session' ? 'abc' : null),
        set: async () => undefined,
        remove: async () => undefined,
      },
      haptics: {
        trigger: async () => undefined,
      },
    };
    const runtime = createGridPlatformRuntime(adapter);
    expect(runtime.supports('secure-storage')).toBe(true);
    expect(runtime.supports('camera')).toBe(false);
    expect(await runtime.requireSecureStorage().get('session')).toBe('abc');
    await expect(runtime.requireHaptics().trigger('success')).resolves.toBeUndefined();
    expect(runtime.feature('secure-session').available).toBe(true);
  });
  it('rejects inconsistent adapters before game code can use them', () => {
    expect(() =>
      createGridPlatformRuntime({
        bridgeVersion: 1,
        kind: 'web',
        capabilities: ['camera'],
      }),
    ).toThrow(/requires adapter port camera/i);
  });

  it('throws a clear error when a caller requires an unavailable port', () => {
    const runtime = createGridPlatformRuntime({
      bridgeVersion: 1,
      kind: 'web',
      capabilities: [],
    });
    expect(() => runtime.requireCamera()).toThrow(
      /platform capability unavailable: camera/i,
    );
  });

  it('freezes the declared capability list exposed by the runtime', () => {
    const runtime = createGridPlatformRuntime({
      bridgeVersion: 1,
      kind: 'test',
      capabilities: [],
    });
    expect(Object.isFrozen(runtime.adapter)).toBe(true);
    expect(Object.isFrozen(runtime.adapter.capabilities)).toBe(true);
  });
});
