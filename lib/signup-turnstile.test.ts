import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifySignupTurnstile } from './signup-turnstile';

describe('signup Turnstile verification', () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;
  const originalRequired = process.env.REQUIRE_SIGNUP_TURNSTILE;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.REQUIRE_SIGNUP_TURNSTILE;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecret;
    if (originalRequired === undefined) delete process.env.REQUIRE_SIGNUP_TURNSTILE;
    else process.env.REQUIRE_SIGNUP_TURNSTILE = originalRequired;
    vi.unstubAllGlobals();
  });

  it('allows disabled rollout without a configured secret', async () => {
    expect(await verifySignupTurnstile(undefined)).toBe(true);
  });

  it('fails closed when required but secret is missing', async () => {
    process.env.REQUIRE_SIGNUP_TURNSTILE = '1';
    expect(await verifySignupTurnstile('anything')).toBe(false);
  });

  it('rejects missing token with configured secret', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    expect(await verifySignupTurnstile(undefined)).toBe(false);
  });

  it('accepts only successful verification from Cloudflare', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await verifySignupTurnstile('challenge-token')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('rejects unsuccessful verification', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) }));
    expect(await verifySignupTurnstile('challenge-token')).toBe(false);
  });

  it('rejects network errors', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    expect(await verifySignupTurnstile('challenge-token')).toBe(false);
  });
});
