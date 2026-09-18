import { describe, expect, it } from 'vitest';
import * as platform from '../lib/grid/platform';
import { createGridNativePlatformAdapter } from '../lib/grid/platform/native';
import { createGridWebPlatformAdapter } from '../lib/grid/platform/web';

describe('GRID platform bridge compatibility', () => {
  it('publishes one shared bridge version across web and native adapters', () => {
    const version = (platform as Record<string, unknown>).GRID_PLATFORM_BRIDGE_VERSION;
    const native = createGridNativePlatformAdapter({ kind: 'ios' });
    const web = createGridWebPlatformAdapter({});

    expect(version).toBe(1);
    expect((native as unknown as { bridgeVersion?: number }).bridgeVersion).toBe(version);
    expect((web as unknown as { bridgeVersion?: number }).bridgeVersion).toBe(version);
  });
});

it('detects current, stale, future, and invalid bridge versions', async () => {
  const bridge = await import('../lib/grid/platform/bridge');
  const assess = (bridge as Record<string, unknown>)
    .assessGridPlatformBridgeCompatibility as ((version: number) => unknown) | undefined;

  expect(typeof assess).toBe('function');
  expect(assess?.(1)).toMatchObject({ compatible: true, relation: 'current' });
  expect(assess?.(0)).toMatchObject({ compatible: false, relation: 'too-old' });
  expect(assess?.(2)).toMatchObject({ compatible: false, relation: 'too-new' });
  expect(assess?.(1.5)).toMatchObject({ compatible: false, relation: 'invalid' });
});

it('preserves a native shell bridge version and rejects incompatible runtimes', () => {
  const stale = createGridNativePlatformAdapter({
    kind: 'ios',
    bridgeVersion: 0,
  } as never);

  expect(stale.bridgeVersion).toBe(0);
  expect(() => platform.createGridPlatformRuntime(stale)).toThrow(/bridge version.*too-old/i);

  const future = createGridNativePlatformAdapter({
    kind: 'android',
    bridgeVersion: 2,
  } as never);
  expect(future.bridgeVersion).toBe(2);
  expect(() => platform.createGridPlatformRuntime(future)).toThrow(/bridge version.*too-new/i);
});
