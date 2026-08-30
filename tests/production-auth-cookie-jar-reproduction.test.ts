import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  signUpWithPassword,
  resetMockAuthStores,
  AUTH_COOKIE_MAX_AGE,
} from '../lib/supabase-auth';
import { POST as loginHandler } from '../app/api/auth/login/route';
import { GET as meHandler } from '../app/api/auth/me/route';
import { GET as commandCenterHandler } from '../app/api/player/command-center/route';
import { POST as logoutHandler } from '../app/api/auth/logout/route';
import * as localEngine from '../lib/game-engine';

/**
 * Simulates a standard browser / curl cookie jar that parses Set-Cookie headers
 * and attaches them to subsequent HTTP requests according to RFC 6265.
 */
class HttpCookieJar {
  private cookies = new Map<string, string>();

  /**
   * Parses Set-Cookie header(s) from a Response and updates the cookie jar.
   * If domain is specified, checks if the request host domain-matches.
   */
  public acceptResponseCookies(res: Response, requestHost: string) {
    let cookieDirectives: string[] = [];
    if (typeof (res.headers as any).getSetCookie === 'function') {
      cookieDirectives = (res.headers as any).getSetCookie();
    }
    if (cookieDirectives.length === 0) {
      const rawSetCookie = res.headers.get('set-cookie');
      if (rawSetCookie) {
        cookieDirectives = rawSetCookie.split(/,\s*(?=[a-zA-Z0-9_-]+=)/);
      }
    }
    if (cookieDirectives.length === 0) return;

    for (const directive of cookieDirectives) {
      const parts = directive.split(';').map((p) => p.trim());
      if (parts.length === 0 || !parts[0].includes('=')) continue;

      const [name, ...valParts] = parts[0].split('=');
      const val = valParts.join('=');
      const cookieName = name.trim();
      const cookieVal = val.trim();

      // Check attributes
      let domainAttr: string | null = null;
      let maxAgeAttr: number | null = null;

      for (let i = 1; i < parts.length; i++) {
        const lower = parts[i].toLowerCase();
        if (lower.startsWith('domain=')) {
          domainAttr = parts[i].slice(7).trim().replace(/^\./, '');
        }
        if (lower.startsWith('max-age=')) {
          maxAgeAttr = parseInt(parts[i].slice(8).trim(), 10);
        }
      }

      // RFC 6265 Section 5.3 Step 5: Reject cookie if Domain attribute does not domain-match request host
      if (domainAttr) {
        const cleanHost = requestHost.toLowerCase().replace(/:\d+$/, '');
        const cleanDomain = domainAttr.toLowerCase();
        const matches = cleanHost === cleanDomain || cleanHost.endsWith('.' + cleanDomain);
        if (!matches) {
          // Browser rejects this cookie due to domain mismatch!
          continue;
        }
      }

      if (maxAgeAttr !== null && maxAgeAttr <= 0) {
        this.cookies.delete(cookieName);
      } else {
        this.cookies.set(cookieName, cookieVal);
      }
    }
  }

  public getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  public get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  public has(name: string): boolean {
    return this.cookies.has(name);
  }

  public clear() {
    this.cookies.clear();
  }
}

describe('Production Auth Cookie-Jar Reproduction & Verification Test Suite', () => {
  beforeEach(() => {
    resetMockAuthStores();
    localEngine.resetGameEngineStore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const TEST_HOSTS = [
    'https://www.cantonquests.com',
    'https://www.cantonquests.vip',
    'https://canton-quests.vercel.app',
    'https://canton-quests-dpl-b6tqjz2swi1m8tut7ehheoy9n9gd.vercel.app',
    'http://localhost:3000',
  ];

  for (const origin of TEST_HOSTS) {
    describe(`Host: ${origin}`, () => {
      it('executes full sequence: POST login -> Cookie Jar -> GET /api/auth/me (isAuthenticated: true) -> GET /api/player/command-center (200)', async () => {
        vi.stubEnv('NODE_ENV', 'production');

        // 1. Setup user account
        await signUpWithPassword({
          displayName: 'IronScout',
          email: 'ironscout@example.com',
          password: 'iron-password-2026',
          selectedStartingPath: 'challenge',
        });

        // 2. Perform login request
        const loginUrl = `${origin}/api/auth/login`;
        const loginReq = new Request(loginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'password_login',
            email: 'ironscout@example.com',
            password: 'iron-password-2026',
          }),
        });

        const loginRes = await loginHandler(loginReq);
        const loginJson = await loginRes.json();

        expect(loginRes.status).toBe(200);
        expect(loginJson.success).toBe(true);
        expect(loginJson.player).toBeDefined();
        expect(loginJson.player.displayName).toBe('IronScout');
        expect(loginJson.session?.access_token).toBeDefined();
        expect(loginJson.session?.refresh_token).toBeDefined();

        // 3. Inspect Set-Cookie headers
        const setCookie = loginRes.headers.get('set-cookie') || '';
        expect(setCookie).toContain('sb-access-token');
        expect(setCookie).toContain('sb-refresh-token');
        expect(setCookie).toContain('canton_player_id');
        expect(setCookie).toContain(`Max-Age=${AUTH_COOKIE_MAX_AGE}`);
        expect(setCookie).toContain('HttpOnly');
        expect(setCookie).toContain('Path=/');
        expect(setCookie.toLowerCase()).toContain('samesite=lax');

        // Crucial invariant: No hardcoded Domain that breaks Vercel or preview deployments
        expect(setCookie).not.toContain('Domain=');
        expect(setCookie).not.toContain('Domain=.cantonquests.com');
        expect(setCookie).not.toContain('Domain=.divinedesigndestinations.com');

        // 4. Ingest into simulated browser Cookie Jar
        const cookieJar = new HttpCookieJar();
        const urlObj = new URL(origin);
        cookieJar.acceptResponseCookies(loginRes, urlObj.hostname);

        expect(cookieJar.has('sb-access-token')).toBe(true);
        expect(cookieJar.has('sb-refresh-token')).toBe(true);
        expect(cookieJar.has('canton_player_id')).toBe(true);
        expect(cookieJar.get('sb-access-token')).toBe(loginJson.session.access_token);
        expect(cookieJar.get('sb-refresh-token')).toBe(loginJson.session.refresh_token);

        // 5. Send GET /api/auth/me with the Cookie Jar
        const meUrl = `${origin}/api/auth/me`;
        const meReq = new Request(meUrl, {
          headers: {
            cookie: cookieJar.getCookieHeader(),
          },
        });

        const meRes = await meHandler(meReq);
        const meJson = await meRes.json();

        // MUST ASSERT BODY, NOT JUST HTTP STATUS 200!
        expect(meRes.status).toBe(200);
        expect(meJson.isAuthenticated).toBe(true);
        expect(meJson.player).toBeDefined();
        expect(meJson.player.id).toBe(loginJson.player.id);
        expect(meJson.player.displayName).toBe('IronScout');

        // 6. Send GET /api/player/command-center with the EXACT SAME Cookie Jar
        const ccUrl = `${origin}/api/player/command-center`;
        const ccReq = new Request(ccUrl, {
          headers: {
            cookie: cookieJar.getCookieHeader(),
          },
        });

        const ccRes = await commandCenterHandler(ccReq);
        const ccJson = await ccRes.json();

        expect(ccRes.status).toBe(200);
        expect(ccJson.success).toBe(true);
        expect(ccJson.player).toBeDefined();
        expect(ccJson.player.id).toBe(loginJson.player.id);
        expect(ccJson.player.displayName).toBe('IronScout');
        expect(ccJson.stats).toBeDefined();
        expect(ccJson.badges).toBeDefined();
        expect(ccJson.playerSignalStatus).toBeDefined();
      });
    });
  }

  describe('Contract and Isolation Tests', () => {
    it('verifies /api/auth/me JSON contract returns 200 with isAuthenticated: false when unauthenticated', async () => {
      const meReq = new Request('https://www.cantonquests.com/api/auth/me');
      const meRes = await meHandler(meReq);
      const meJson = await meRes.json();

      expect(meRes.status).toBe(200);
      expect(meJson.isAuthenticated).toBe(false);
      expect(meJson.player).toBeNull();
      expect(meJson.achievements).toEqual([]);
    });

    it('verifies /api/player/command-center returns 401 when unauthenticated', async () => {
      const ccReq = new Request('https://www.cantonquests.com/api/player/command-center');
      const ccRes = await commandCenterHandler(ccReq);
      const ccJson = await ccRes.json();

      expect(ccRes.status).toBe(401);
      expect(ccJson.success).toBe(false);
      expect(ccJson.error).toMatch(/Authentication required/i);
    });

    it('handles background token refresh rotation seamlessly via cookie jar', async () => {
      const signUpRes = await signUpWithPassword({
        displayName: 'RotateRanger',
        email: 'rotate@example.com',
        password: 'rotate-password-123',
      });

      const refreshToken = signUpRes.session!.refresh_token!;
      const expiredJar = new HttpCookieJar();

      // Send GET /api/auth/me with expired access token and valid refresh token
      const meReq = new Request('https://www.cantonquests.com/api/auth/me', {
        headers: { cookie: `sb-access-token=expired-mock-token; sb-refresh-token=${refreshToken}` },
      });

      const meRes = await meHandler(meReq);
      const meJson = await meRes.json();

      expect(meRes.status).toBe(200);
      expect(meJson.isAuthenticated).toBe(true);
      expect(meJson.player.displayName).toBe('RotateRanger');

      // Update cookie jar with refreshed cookies from /api/auth/me response
      expiredJar.acceptResponseCookies(meRes, 'www.cantonquests.com');

      expect(expiredJar.has('sb-access-token')).toBe(true);
      expect(expiredJar.has('sb-refresh-token')).toBe(true);

      // Subsequent /api/player/command-center call succeeds with refreshed cookie jar
      const ccReq = new Request('https://www.cantonquests.com/api/player/command-center', {
        headers: { cookie: expiredJar.getCookieHeader() },
      });

      const ccRes = await commandCenterHandler(ccReq);
      const ccJson = await ccRes.json();

      expect(ccRes.status).toBe(200);
      expect(ccJson.success).toBe(true);
      expect(ccJson.player.displayName).toBe('RotateRanger');
    });

    it('POST /api/auth/logout wipes cookie jar and subsequent me and command-center calls fail closed', async () => {
      const signUpRes = await signUpWithPassword({
        displayName: 'LogoutUser',
        email: 'logoutuser@example.com',
        password: 'logout-password-123',
      });

      const cookieJar = new HttpCookieJar();
      cookieJar.acceptResponseCookies(
        new Response(null, {
          headers: {
            'set-cookie': `sb-access-token=${signUpRes.session!.access_token}; Path=/, sb-refresh-token=${signUpRes.session!.refresh_token}; Path=/`,
          },
        }),
        'www.cantonquests.com'
      );

      const logoutReq = new Request('https://www.cantonquests.com/api/auth/logout', {
        method: 'POST',
        headers: { cookie: cookieJar.getCookieHeader() },
      });

      const logoutRes = await logoutHandler(logoutReq);
      expect(logoutRes.status).toBe(200);

      // Ingest logout response Set-Cookie headers (Max-Age=0)
      cookieJar.acceptResponseCookies(logoutRes, 'www.cantonquests.com');

      expect(cookieJar.has('sb-access-token')).toBe(false);
      expect(cookieJar.has('sb-refresh-token')).toBe(false);

      // Now verify /api/auth/me shows unauthenticated
      const postLogoutMe = await meHandler(
        new Request('https://www.cantonquests.com/api/auth/me', {
          headers: { cookie: cookieJar.getCookieHeader() },
        })
      );
      const postLogoutMeJson = await postLogoutMe.json();
      expect(postLogoutMeJson.isAuthenticated).toBe(false);
      expect(postLogoutMeJson.player).toBeNull();

      // Now verify /api/player/command-center returns 401
      const postLogoutCc = await commandCenterHandler(
        new Request('https://www.cantonquests.com/api/player/command-center', {
          headers: { cookie: cookieJar.getCookieHeader() },
        })
      );
      expect(postLogoutCc.status).toBe(401);
    });
  });
});
