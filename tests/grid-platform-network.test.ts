import { describe, expect, it } from 'vitest';
import { validateGridPlatformAdapter } from '../lib/grid/platform/capabilities';
import { createGridNativePlatformAdapter } from '../lib/grid/platform/native';
import { createGridPlatformRuntime } from '../lib/grid/platform/runtime';
import type { GridNetworkPort } from '../lib/grid/platform/types';

describe('GRID platform network awareness', () => {
  it('advertises network status only when the shell supplies a network port', async () => {
    const network: GridNetworkPort = {
      getStatus: async () => ({ connected: true, interface: 'wifi' }),
      subscribe: () => () => undefined,
    };
    const withNetwork = createGridNativePlatformAdapter({
      kind: 'ios',
      network,
    });
    const withoutNetwork = createGridNativePlatformAdapter({ kind: 'ios' });

    expect(withNetwork.capabilities).toContain('network-status');
    expect(withNetwork.network).toBe(network);
    expect(withoutNetwork.capabilities).not.toContain('network-status');
    expect(validateGridPlatformAdapter(withNetwork)).toEqual([]);

    const runtime = createGridPlatformRuntime(withNetwork);
    await expect(runtime.requireNetwork().getStatus()).resolves.toEqual({
      connected: true,
      interface: 'wifi',
    });
  });

  it('fails validation when network capability and port drift apart', () => {
    expect(
      validateGridPlatformAdapter({
        bridgeVersion: 1,
        kind: 'test',
        capabilities: ['network-status'],
      }),
    ).toEqual([
      expect.objectContaining({
        code: 'MISSING_PORT',
        capability: 'network-status',
      }),
    ]);

    expect(
      validateGridPlatformAdapter({
        bridgeVersion: 1,
        kind: 'test',
        capabilities: [],
        network: {
          getStatus: async () => ({ connected: false, interface: 'unknown' }),
          subscribe: () => () => undefined,
        },
      }),
    ).toEqual([
      expect.objectContaining({
        code: 'UNDECLARED_PORT',
      }),
    ]);
  });
});
