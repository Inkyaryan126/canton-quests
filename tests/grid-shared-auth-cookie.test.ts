import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { clearAuthCookies, extractAuthTokens, setAuthCookies } from '../lib/supabase-auth';

afterEach(() => vi.unstubAllEnvs());

describe('shared Canton Quests to Grid login cookies', () => {
  it('issues secure HttpOnly shared cookies only when explicitly enabled in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CQ_SHARED_DOMAIN_ENABLED', '1');
    const response = NextResponse.json({ ok: true });
    setAuthCookies(response, { access_token: 'access-test', refresh_token: 'refresh-test' }, 'player');
    const headers = response.headers.getSetCookie();
    expect(headers.some(h => h.includes('cq-shared-access=access-test') && h.includes('Domain=.cantonquests.com') && h.includes('HttpOnly') && h.includes('Secure'))).toBe(true);
    expect(headers.some(h => h.includes('cq-shared-refresh=refresh-test') && h.includes('Domain=.cantonquests.com'))).toBe(true);
  });

  it('never attempts cross-domain cookies when disabled, including Vercel preview hosts', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CQ_SHARED_DOMAIN_ENABLED', '0');
    const response = NextResponse.json({ ok: true });
    setAuthCookies(response, { access_token: 'test', refresh_token: 'test' }, 'player');
    expect(response.headers.getSetCookie().join(' ')).not.toContain('Domain=');
  });

  it('accepts shared cookies first so rotated Grid sessions are honored', () => {
    const request = new Request('https://www.cantonquests.com/api/auth/me', { headers: { cookie: 'sb-access-token=old-access; sb-refresh-token=old-refresh; cq-shared-access=new-access; cq-shared-refresh=new-refresh' } });
    expect(extractAuthTokens(request)).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });

  it('expires the parent-domain session on logout as well as the host-only session', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CQ_SHARED_DOMAIN_ENABLED', '1');
    const response = NextResponse.json({ ok: true });
    clearAuthCookies(response);
    expect(response.headers.getSetCookie().some(h => h.includes('cq-shared-access=') && h.includes('Max-Age=0') && h.includes('Domain=.cantonquests.com'))).toBe(true);
  });
});
