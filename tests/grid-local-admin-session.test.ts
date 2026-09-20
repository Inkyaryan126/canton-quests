// Focused tests for the development-only ephemeral signed Game Master
// session token primitive in lib/admin-auth.ts.
//
// Goal under test: a local Boss Panel launch can mint and verify a signed
// session token without ever putting ADMIN_SECRET_KEY or a hardcoded
// fallback passphrase into the cookie value, while existing admin auth and
// production fail-closed behavior are preserved.

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createLocalGameMasterSessionToken,
  verifyLocalGameMasterSessionToken,
  verifyAdminSecret,
} from '@/lib/admin-auth';

const KNOWN_FALLBACK_PASSPHRASES = ['canton-gm-2026', 'canton-admin-pass-2026', 'gm-super-2026'];

function withNodeEnv<T>(value: string, fn: () => T): T {
  const orig = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = value;
  try {
    return fn();
  } finally {
    (process.env as any).NODE_ENV = orig;
  }
}

describe('Local Game Master ephemeral session token', () => {
  const origAdminSecret = process.env.ADMIN_SECRET_KEY;

  afterEach(() => {
    if (origAdminSecret === undefined) {
      delete process.env.ADMIN_SECRET_KEY;
    } else {
      process.env.ADMIN_SECRET_KEY = origAdminSecret;
    }
  });

  it('mints a token in development that verifies as a valid session', () => {
    withNodeEnv('development', () => {
      const token = createLocalGameMasterSessionToken();
      expect(token).toBeTruthy();
      expect(verifyLocalGameMasterSessionToken(token!)).toBe(true);
    });
  });

  it('mints a token in test env (non-production) that verifies as valid', () => {
    withNodeEnv('test', () => {
      const token = createLocalGameMasterSessionToken();
      expect(token).toBeTruthy();
      expect(verifyLocalGameMasterSessionToken(token!)).toBe(true);
    });
  });

  it('never embeds ADMIN_SECRET_KEY or any hardcoded fallback passphrase in the token', () => {
    process.env.ADMIN_SECRET_KEY = 'super-secret-value-should-not-leak';

    withNodeEnv('development', () => {
      const token = createLocalGameMasterSessionToken();
      expect(token).toBeTruthy();
      expect(token).not.toContain('super-secret-value-should-not-leak');
      for (const passphrase of KNOWN_FALLBACK_PASSPHRASES) {
        expect(token).not.toContain(passphrase);
      }

      // Decode the payload half and confirm it is only iat/exp bookkeeping.
      const [payloadB64] = token!.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      expect(Object.keys(payload).sort()).toEqual(['exp', 'iat']);
      expect(JSON.stringify(payload)).not.toContain('super-secret-value-should-not-leak');
    });
  });

  it('refuses to mint a token in production (fail-closed)', () => {
    withNodeEnv('production', () => {
      expect(createLocalGameMasterSessionToken()).toBeNull();
    });
  });

  it('refuses to verify any token in production, even one minted moments earlier in development', () => {
    const token = withNodeEnv('development', () => createLocalGameMasterSessionToken());
    expect(token).toBeTruthy();

    withNodeEnv('production', () => {
      expect(verifyLocalGameMasterSessionToken(token!)).toBe(false);
    });
  });

  it('rejects undefined, empty, and malformed tokens', () => {
    withNodeEnv('development', () => {
      expect(verifyLocalGameMasterSessionToken(undefined)).toBe(false);
      expect(verifyLocalGameMasterSessionToken('')).toBe(false);
      expect(verifyLocalGameMasterSessionToken('not-a-real-token')).toBe(false);
      expect(verifyLocalGameMasterSessionToken('a.b.c')).toBe(false);
      expect(verifyLocalGameMasterSessionToken('canton-gm-2026')).toBe(false);
    });
  });

  it('rejects a token with a tampered signature', () => {
    withNodeEnv('development', () => {
      const token = createLocalGameMasterSessionToken()!;
      const [payloadB64, signature] = token.split('.');
      // Flip the first character rather than the last: base64url's final
      // character can carry unused padding bits, so mutating it can
      // round-trip to the same underlying bytes and produce a false pass.
      const tamperedSignature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
      expect(verifyLocalGameMasterSessionToken(`${payloadB64}.${tamperedSignature}`)).toBe(false);
    });
  });

  it('rejects a token with a tampered (forged expiry) payload', () => {
    withNodeEnv('development', () => {
      const token = createLocalGameMasterSessionToken()!;
      const [, signature] = token.split('.');
      const forgedPayload = Buffer.from(JSON.stringify({ iat: Date.now(), exp: Date.now() + 999_999_999 }), 'utf8').toString(
        'base64url'
      );
      expect(verifyLocalGameMasterSessionToken(`${forgedPayload}.${signature}`)).toBe(false);
    });
  });

  it('rejects an expired token while a fresh token with a valid signature still passes', () => {
    withNodeEnv('development', () => {
      let now = Date.now();
      const spy = vi.spyOn(Date, 'now').mockImplementation(() => now);
      try {
        const token = createLocalGameMasterSessionToken()!;
        expect(verifyLocalGameMasterSessionToken(token)).toBe(true);

        // Advance past the 12-hour TTL; signature is still valid, only the
        // expiry check should now fail.
        now += 12 * 60 * 60 * 1000 + 1_000;
        expect(verifyLocalGameMasterSessionToken(token)).toBe(false);
      } finally {
        spy.mockRestore();
      }
    });
  });

  it('is ephemeral: a token minted against one signing key does not verify after the module is reloaded with a fresh key', async () => {
    const token = withNodeEnv('development', () => createLocalGameMasterSessionToken());
    expect(token).toBeTruthy();

    vi.resetModules();
    try {
      const freshModule = await import('@/lib/admin-auth');
      await withNodeEnv('development', async () => {
        expect(freshModule.verifyLocalGameMasterSessionToken(token!)).toBe(false);
        // The fresh instance's own tokens still verify against itself.
        const freshToken = freshModule.createLocalGameMasterSessionToken();
        expect(freshModule.verifyLocalGameMasterSessionToken(freshToken!)).toBe(true);
      });
    } finally {
      vi.resetModules();
    }
  });

  it('preserves existing admin auth: fallback passphrases still work outside production', () => {
    delete process.env.ADMIN_SECRET_KEY;
    withNodeEnv('development', () => {
      for (const passphrase of KNOWN_FALLBACK_PASSPHRASES) {
        expect(verifyAdminSecret(passphrase)).toBe(true);
      }
      expect(verifyAdminSecret('totally-wrong-passphrase')).toBe(false);
    });
  });

  it('preserves existing admin auth: fallback passphrases fail closed in production', () => {
    delete process.env.ADMIN_SECRET_KEY;
    withNodeEnv('production', () => {
      for (const passphrase of KNOWN_FALLBACK_PASSPHRASES) {
        expect(verifyAdminSecret(passphrase)).toBe(false);
      }
    });
  });

  it('preserves existing admin auth: ADMIN_SECRET_KEY still takes precedence when set', () => {
    process.env.ADMIN_SECRET_KEY = 'configured-secret-2026';
    withNodeEnv('development', () => {
      expect(verifyAdminSecret('configured-secret-2026')).toBe(true);
      expect(verifyAdminSecret('canton-gm-2026')).toBe(false);
    });
  });
});
