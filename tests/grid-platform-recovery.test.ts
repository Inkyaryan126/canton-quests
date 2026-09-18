import { describe, expect, it } from 'vitest';
import { createGridNativePlatformAdapter } from '../lib/grid/platform/native';
import { createGridPlatformRuntime } from '../lib/grid/platform/runtime';
import { subscribeGridRecoverySignals } from '../lib/grid/platform/recovery';
import type { GridAppLifecyclePort, GridNetworkPort } from '../lib/grid/platform/types';

describe('GRID mobile recovery orchestration', () => {
  it('coalesces near-simultaneous resume and reconnect triggers', async () => {
    let lifecycleListener: Parameters<GridAppLifecyclePort['subscribe']>[0] = () => undefined;
    let networkListener: Parameters<GridNetworkPort['subscribe']>[0] = () => undefined;
    let now = 1_000;

    const runtime = createGridPlatformRuntime(createGridNativePlatformAdapter({
      kind: 'ios',
      lifecycle: {
        getState: async () => 'active',
        subscribe: (listener) => { lifecycleListener = listener; return () => undefined; },
      },
      network: {
        getStatus: async () => ({ connected: true, interface: 'cellular' }),
        subscribe: (listener) => { networkListener = listener; return () => undefined; },
      },
    }));
    const signals: Array<{ reason: string; observedAtMs: number }> = [];
    const stop = await subscribeGridRecoverySignals(
      runtime,
      (signal) => signals.push(signal),
      { dedupeWindowMs: 500, now: () => now },
    );

    lifecycleListener('background');
    lifecycleListener('active');
    expect(signals).toEqual([{ reason: 'app-resume', observedAtMs: 1_000 }]);

    now = 1_200;
    networkListener({ connected: false, interface: 'unknown' });
    networkListener({ connected: true, interface: 'wifi' });
    expect(signals).toHaveLength(1);

    now = 1_700;
    networkListener({ connected: false, interface: 'unknown' });
    networkListener({ connected: true, interface: 'wifi' });
    expect(signals).toEqual([
      { reason: 'app-resume', observedAtMs: 1_000 },
      { reason: 'network-reconnect', observedAtMs: 1_700 },
    ]);

    stop();
  });});
