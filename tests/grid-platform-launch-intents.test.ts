import { describe, expect, it } from 'vitest';
import {
  parseGridLaunchIntent,
  resolveInitialGridLaunchIntent,
} from '../lib/grid/platform/launch-intents';
import { createGridNativePlatformAdapter } from '../lib/grid/platform/native';
import { createGridPlatformRuntime } from '../lib/grid/platform/runtime';

const config = {
  trustedHosts: ['www.cantonquests.com', 'cantonquests.com'],
  customSchemes: ['thegrid'],
} as const;

describe('GRID launch intents', () => {
  it('normalizes a trusted universal link into a platform-neutral Grid destination', () => {
    expect(
      parseGridLaunchIntent(
        'https://www.cantonquests.com/grid/mission/founders-cipher?district=arts&tag=a&tag=b#clue',
        config,
      ),
    ).toEqual({
      ok: true,
      intent: {
        source: 'universal-link',
        path: '/grid/mission/founders-cipher',
        query: { district: ['arts'], tag: ['a', 'b'] },
        fragment: 'clue',
      },
    });
  });
  it('normalizes the native custom scheme without exposing scheme details to game code', () => {
    expect(
      parseGridLaunchIntent('thegrid://grid/territory/downtown?source=push', config),
    ).toEqual({
      ok: true,
      intent: {
        source: 'custom-scheme',
        path: '/grid/territory/downtown',
        query: { source: ['push'] },
        fragment: null,
      },
    });
  });

  it('rejects external hosts, unsupported schemes, and destinations outside /grid', () => {
    expect(parseGridLaunchIntent('https://evil.example/grid/mission/1', config)).toEqual({
      ok: false, reason: 'UNTRUSTED_HOST',
    });
    expect(parseGridLaunchIntent('http://www.cantonquests.com/grid', config)).toEqual({
      ok: false, reason: 'UNSUPPORTED_SCHEME',
    });
    expect(parseGridLaunchIntent('https://www.cantonquests.com/admin', config)).toEqual({
      ok: false, reason: 'OUTSIDE_GRID',
    });
    expect(parseGridLaunchIntent('thegrid://settings', config)).toEqual({
      ok: false, reason: 'OUTSIDE_GRID',
    });
  });
  it('rejects malformed, oversized, and traversal-like launch inputs', () => {
    expect(parseGridLaunchIntent('', config)).toEqual({ ok: false, reason: 'EMPTY_URL' });
    expect(parseGridLaunchIntent('not a url', config)).toEqual({
      ok: false, reason: 'INVALID_URL',
    });
    expect(parseGridLaunchIntent(
      `https://www.cantonquests.com/grid?payload=${'x'.repeat(5000)}`,
      config,
    )).toEqual({ ok: false, reason: 'URL_TOO_LONG' });
    expect(parseGridLaunchIntent(
      'https://www.cantonquests.com/grid/%2E%2E/admin',
      config,
    )).toEqual({ ok: false, reason: 'OUTSIDE_GRID' });
  });

  it('resolves the initial native deep link through the shared runtime', async () => {
    const runtime = createGridPlatformRuntime(createGridNativePlatformAdapter({
      kind: 'ios',
      deepLinks: {
        getInitialUrl: async () => 'thegrid://grid/scrimmage/abc?invite=xyz',
      },
    }));
    await expect(resolveInitialGridLaunchIntent(runtime, config)).resolves.toEqual({
      ok: true,
      intent: {
        source: 'custom-scheme',
        path: '/grid/scrimmage/abc',
        query: { invite: ['xyz'] },
        fragment: null,
      },
    });
  });

  it('returns null when the client has no deep-link capability or no initial URL', async () => {
    const noLinks = createGridPlatformRuntime(createGridNativePlatformAdapter({ kind: 'android' }));
    await expect(resolveInitialGridLaunchIntent(noLinks, config)).resolves.toBeNull();

    const emptyLink = createGridPlatformRuntime(createGridNativePlatformAdapter({
      kind: 'android',
      deepLinks: { getInitialUrl: async () => null },
    }));
    await expect(resolveInitialGridLaunchIntent(emptyLink, config)).resolves.toBeNull();
  });
});
