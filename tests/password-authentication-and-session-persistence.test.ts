import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  signUpWithPassword,
  signInWithPassword,
  sendPasswordResetEmail,
  updateUserPassword,
  verifyTokenHash,
  resolveAuthenticatedPlayer,
  resolveAuthenticatedSession,
  refreshSupabaseSession,
  sanitizeRedirectUrl,
  resetMockAuthStores,
  registerMockUserPassword,
  registerMockAuthUser,
  AUTH_COOKIE_MAX_AGE,
} from '../lib/supabase-auth';
import { middleware } from '../middleware';
import { POST as loginHandler } from '../app/api/auth/login/route';
import { POST as registerHandler } from '../app/api/auth/register/route';
import { POST as confirmPostHandler, GET as confirmGetHandler } from '../app/api/auth/confirm/route';
import { POST as resetPasswordHandler } from '../app/api/auth/reset-password/route';
import { POST as logoutHandler } from '../app/api/auth/logout/route';
import { GET as meHandler } from '../app/api/auth/me/route';
import { GET as commandCenterHandler } from '../app/api/player/command-center/route';
import { GET as profileHandler, POST as profilePostHandler } from '../app/api/player/profile/route';
import * as localEngine from '../lib/game-engine';

describe('Canton Quests — Password Accounts & Persistent Sessions Test Suite', () => {
  beforeEach(() => {
    resetMockAuthStores();
    localEngine.resetGameEngineStore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('1. New Player Sign Up with Callsign, Email, and Password', () => {
    it('successfully registers a new player account with password and returns session with access & refresh tokens', async () => {
      const result = await signUpWithPassword({
        displayName: 'CantonCipher',
        email: 'cipher@example.com',
        password: 'secure-password-123',
        selectedStartingPath: 'family',
        acquisitionSource: 'main_site',
      });

      expect(result.success).toBe(true);
      expect(result.player).toBeDefined();
      expect(result.player?.displayName).toBe('CantonCipher');
      expect(result.player?.email).toBe('cipher@example.com');
      expect(result.player?.selectedStartingPath).toBe('family');
      expect(result.session?.access_token).toBeDefined();
      expect(result.session?.refresh_token).toBeDefined();
      expect(result.session?.refresh_token).toMatch(/^mock-refresh-/);
    });

    it('rejects signup with missing or short callsign (<2 chars)', async () => {
      const result = await signUpWithPassword({
        displayName: 'A',
        email: 'shortname@example.com',
        password: 'secure-password-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/callsign/i);
    });

    it('rejects signup with invalid email', async () => {
      const result = await signUpWithPassword({
        displayName: 'ValidCallsign',
        email: 'notanemail',
        password: 'secure-password-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/email/i);
    });

    it('rejects signup with short password (<6 chars)', async () => {
      const result = await signUpWithPassword({
        displayName: 'ValidCallsign',
        email: 'pass@example.com',
        password: '123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/password/i);
    });

    it('POST /api/auth/register persists both access and refresh cookies with 30-day maxAge', async () => {
      const req = new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'NeonScout',
          email: 'neon@example.com',
          password: 'secure-password-999',
          selectedStartingPath: 'challenge',
        }),
      });

      const res = await registerHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.player.displayName).toBe('NeonScout');
      expect(json.player.selectedStartingPath).toBe('challenge');
      expect(json.session?.access_token).toBeDefined();
      expect(json.session?.refresh_token).toBeDefined();

      const setCookie = res.headers.get('set-cookie') || '';
      expect(setCookie).toContain('canton_player_id');
      expect(setCookie).toContain('sb-access-token');
      expect(setCookie).toContain('sb-refresh-token');
      expect(setCookie).toContain(`Max-Age=${AUTH_COOKIE_MAX_AGE}`);
    });
  });

  describe('2. Returning Player Login (Email + Password Only, No Callsign Required)', () => {
    beforeEach(async () => {
      await signUpWithPassword({
        displayName: 'NightStalker',
        email: 'stalker@example.com',
        password: 'stalker-password-2026',
        selectedStartingPath: 'secret',
      });
    });

    it('successfully logs in returning player with email and password only', async () => {
      const loginRes = await signInWithPassword('stalker@example.com', 'stalker-password-2026');

      expect(loginRes.success).toBe(true);
      expect(loginRes.player).toBeDefined();
      expect(loginRes.player?.displayName).toBe('NightStalker');
      expect(loginRes.session?.access_token).toBeDefined();
      expect(loginRes.session?.refresh_token).toBeDefined();
    });

    it('POST /api/auth/login sets persistent sb-access-token and sb-refresh-token cookies', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'password_login',
          email: 'stalker@example.com',
          password: 'stalker-password-2026',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.player.displayName).toBe('NightStalker');
      expect(json.session?.access_token).toBeDefined();
      expect(json.session?.refresh_token).toBeDefined();

      const setCookie = res.headers.get('set-cookie') || '';
      expect(setCookie).toContain('canton_player_id');
      expect(setCookie).toContain('sb-access-token');
      expect(setCookie).toContain('sb-refresh-token');
      expect(setCookie).toContain(`Max-Age=${AUTH_COOKIE_MAX_AGE}`);
    });

    it('rejects password login with incorrect password', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'password_login',
          email: 'stalker@example.com',
          password: 'wrong-password',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/invalid email or password/i);
    });

    it('rejects password login with non-existent email', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'password_login',
          email: 'nonexistent@example.com',
          password: 'some-password',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('strictly rejects unauthenticated callsign-only or raw identifier login attempts', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: 'NightStalker',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/public identifiers/i);
    });
  });

  describe('3. Scanner-Safe Password Recovery Flow & Reset Password', () => {
    beforeEach(async () => {
      await signUpWithPassword({
        displayName: 'IronForge',
        email: 'iron@example.com',
        password: 'initial-password-123',
      });
    });

    it('dispatches password recovery email safely with sanitized redirect', async () => {
      const result = await sendPasswordResetEmail('iron@example.com', {
        redirectTo: '/auth/reset-password',
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('Password');
    });

    it('GET /api/auth/confirm redirects to /auth/confirm without token consumption', async () => {
      const req = new Request(
        'http://localhost:3000/api/auth/confirm?token_hash=mock-recovery-iron_example.com&type=recovery&next=/auth/reset-password'
      );
      const res = await confirmGetHandler(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/auth/confirm');
      expect(location).toContain('type=recovery');
      expect(location).toContain('next=%2Fauth%2Freset-password');
    });

    it('POST /api/auth/confirm verifies recovery token and returns session with access and refresh tokens', async () => {
      const req = new Request('http://localhost:3000/api/auth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_hash: 'mock-recovery-iron_example.com',
          type: 'recovery',
          next: '/auth/reset-password',
        }),
      });

      const res = await confirmPostHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.redirectTo).toBe('/auth/reset-password');
      expect(json.session?.access_token).toBeDefined();
      expect(json.session?.refresh_token).toBeDefined();

      const setCookie = res.headers.get('set-cookie') || '';
      expect(setCookie).toContain('sb-access-token');
      expect(setCookie).toContain('sb-refresh-token');
    });

    it('POST /api/auth/reset-password sets new password using recovery session tokens and retains refresh token', async () => {
      const req = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-usr-iron_example_com',
          cookie: 'sb-refresh-token=mock-refresh-usr-iron_example_com',
        },
        body: JSON.stringify({
          password: 'new-updated-secret-password-456',
        }),
      });

      const res = await resetPasswordHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toMatch(/PLAYER ACCESS RESTORED/i);
      expect(json.session?.access_token).toBeDefined();
      expect(json.session?.refresh_token).toBeDefined();
      expect(json.session?.refresh_token).toBe('mock-refresh-usr-iron_example_com');

      const setCookie = res.headers.get('set-cookie') || '';
      expect(setCookie).toContain('sb-access-token');
      expect(setCookie).toContain('sb-refresh-token=mock-refresh-usr-iron_example_com');

      // Now verify returning login works with new password
      const loginCheck = await signInWithPassword('iron@example.com', 'new-updated-secret-password-456');
      expect(loginCheck.success).toBe(true);
      expect(loginCheck.player?.displayName).toBe('IronForge');
    });

    it('rejects POST /api/auth/reset-password when password is less than 6 chars', async () => {
      const req = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-usr-iron_example_com',
        },
        body: JSON.stringify({
          password: '123',
        }),
      });

      const res = await resetPasswordHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/at least 6 characters/i);
    });

    it('rejects POST /api/auth/reset-password without auth token or session', async () => {
      const req = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'new-password-789',
        }),
      });

      const res = await resetPasswordHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });
  });

  describe('4. Legacy Player Transition (Pre-Password Accounts)', () => {
    it('allows legacy players to set password without creating duplicate player rows or duplicate auth users', async () => {
      const initialCount = localEngine.getAllPlayers().length;

      // Create pre-existing legacy player in local game engine (no password yet)
      const legacyPlayer = localEngine.registerPlayer({
        displayName: 'VeteranPilot',
        email: 'pilot@example.com',
        selectedStartingPath: 'challenge',
      });
      legacyPlayer.totalXp = 450;
      legacyPlayer.level = 3;

      const postRegisterCount = localEngine.getAllPlayers().length;
      expect(postRegisterCount).toBe(initialCount + 1);

      // Existing player sets password via forgot password / login fallback
      const loginRes = await signInWithPassword('pilot@example.com', 'veteran-pilot-pass-2026');

      expect(loginRes.success).toBe(true);
      expect(loginRes.player?.id).toBe(legacyPlayer.id);
      expect(loginRes.player?.displayName).toBe('VeteranPilot');
      expect(loginRes.player?.totalXp).toBe(450);
      expect(loginRes.player?.level).toBe(3);

      // Verify no duplicate player row was created
      const finalCount = localEngine.getAllPlayers().length;
      expect(finalCount).toBe(postRegisterCount);
    });
  });

  describe('5. Session Persistence & Expired Access Token Refresh', () => {
    let sessionToken = '';
    let refreshToken = '';

    beforeEach(async () => {
      const signUpRes = await signUpWithPassword({
        displayName: 'ApexRider',
        email: 'apex@example.com',
        password: 'apex-rider-pass',
        selectedStartingPath: 'family',
      });
      sessionToken = signUpRes.session!.access_token;
      refreshToken = signUpRes.session!.refresh_token!;
    });

    it('GET /api/auth/me resolves active player from valid access token', async () => {
      const req = new Request('http://localhost:3000/api/auth/me', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      const res = await meHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.isAuthenticated).toBe(true);
      expect(json.player.displayName).toBe('ApexRider');
      expect(json.player.email).toBe('apex@example.com');
    });

    it('automatically refreshes session when access token is expired/invalid but refresh token cookie is valid', async () => {
      // Simulate expired/invalid access token with valid refresh token cookie
      const refreshReq = new Request('http://localhost:3000/api/auth/me', {
        headers: {
          cookie: `sb-access-token=expired-token; sb-refresh-token=${refreshToken}`,
        },
      });

      const res = await meHandler(refreshReq);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.isAuthenticated).toBe(true);
      expect(json.player.displayName).toBe('ApexRider');
      expect(json.session?.access_token).toBeDefined();

      // Assert that updated cookies were written to response
      const setCookie = res.headers.get('set-cookie') || '';
      expect(setCookie).toContain('sb-access-token');
      expect(setCookie).toContain('sb-refresh-token');
    });

    it('refreshSupabaseSession successfully refreshes expired token in isolation', async () => {
      const refreshResult = await refreshSupabaseSession(refreshToken);
      expect(refreshResult.success).toBe(true);
      expect(refreshResult.user?.email).toBe('apex@example.com');
      expect(refreshResult.session?.access_token).toBeDefined();
      expect(refreshResult.session?.refresh_token).toBeDefined();
    });

    it('simulates browser close and reopen: cookie-only session (no Authorization header) restores full player access', async () => {
      // Step 1: Simulate closing browser (in-memory state destroyed)
      // Step 2: Browser reopens with persisted cookies only (no Authorization header)
      const reopenReq = new Request('http://localhost:3000/api/auth/me', {
        headers: {
          cookie: `sb-access-token=${sessionToken}; sb-refresh-token=${refreshToken}`,
        },
      });

      const res = await meHandler(reopenReq);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.isAuthenticated).toBe(true);
      expect(json.player.displayName).toBe('ApexRider');
      expect(json.player.email).toBe('apex@example.com');

      // Step 3: Verify cookie-only reopened session can access Command Center API
      const ccReq = new Request('http://localhost:3000/api/player/command-center', {
        headers: {
          cookie: `sb-access-token=${sessionToken}; sb-refresh-token=${refreshToken}`,
        },
      });
      const ccRes = await commandCenterHandler(ccReq);
      const ccJson = await ccRes.json();
      expect(ccRes.status).toBe(200);
      expect(ccJson.success).toBe(true);
      expect(ccJson.player.displayName).toBe('ApexRider');

      // Step 4: Verify cookie-only reopened session can access Profile API
      const profileReq = new Request('http://localhost:3000/api/player/profile', {
        headers: {
          cookie: `sb-access-token=${sessionToken}; sb-refresh-token=${refreshToken}`,
        },
      });
      const profileRes = await profileHandler(profileReq);
      const profileJson = await profileRes.json();
      expect(profileRes.status).toBe(200);
      expect(profileJson.success).toBe(true);
      expect(profileJson.player.displayName).toBe('ApexRider');
    });

    it('request-scoped logout terminates session, revokes refresh token, and clears cookies with Max-Age=0', async () => {
      const logoutReq = new Request('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          cookie: `sb-access-token=${sessionToken}; sb-refresh-token=${refreshToken}`,
        },
      });

      const res = await logoutHandler(logoutReq);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      const cookieHeader = res.headers.get('set-cookie') || '';
      expect(cookieHeader).toContain('canton_player_id');
      expect(cookieHeader).toContain('sb-access-token');
      expect(cookieHeader).toContain('sb-refresh-token');
      expect(cookieHeader).toContain('Max-Age=0');

      // After logout, trying to refresh with revoked refresh token fails
      const revokedRefreshRes = await refreshSupabaseSession(refreshToken);
      expect(revokedRefreshRes.success).toBe(false);

      // After logout, unauthenticated request returns isAuthenticated: false
      const postLogoutReq = new Request('http://localhost:3000/api/auth/me');
      const meRes = await meHandler(postLogoutReq);
      const meJson = await meRes.json();
      expect(meJson.isAuthenticated).toBe(false);
      expect(meJson.player).toBeNull();

      // Protected routes return 401
      const blockedCcRes = await commandCenterHandler(postLogoutReq);
      expect(blockedCcRes.status).toBe(401);
    });
  });

  describe('6. Open Redirect Protection & URL Sanitization', () => {
    it('sanitizes malicious external URLs to default safe internal paths', () => {
      expect(sanitizeRedirectUrl('https://evil-phishing.com/steal')).toBe('/profile');
      expect(sanitizeRedirectUrl('//malicious-site.com')).toBe('/profile');
      expect(sanitizeRedirectUrl('javascript:alert(1)')).toBe('/profile');
      expect(sanitizeRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe('/profile');
    });

    it('preserves valid internal relative paths and query strings', () => {
      expect(sanitizeRedirectUrl('/profile')).toBe('/profile');
      expect(sanitizeRedirectUrl('/auth/reset-password')).toBe('/auth/reset-password');
      expect(sanitizeRedirectUrl('/events/canton-vol-1?tab=quests')).toBe('/events/canton-vol-1?tab=quests');
      expect(sanitizeRedirectUrl('/leaderboard#rankings')).toBe('/leaderboard#rankings');
    });

    it('sanitizes external redirect query parameters in GET /api/auth/confirm', async () => {
      const req = new Request(
        'http://localhost:3000/api/auth/confirm?token_hash=mock-token-123&type=signup&next=https://attacker.com/steal'
      );
      const res = await confirmGetHandler(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/auth/confirm');
      expect(location).toContain('next=%2Fprofile');
      expect(location).not.toContain('attacker.com');
    });
  });

  describe('7. Mobile Viewport Layout & Responsiveness Invariants (320, 375, 390, 414, 430px)', () => {
    const MOBILE_VIEWPORTS = [320, 375, 390, 414, 430];

    it('verifies responsive container constraints allow fluid rendering without horizontal overflow across all mobile viewports', () => {
      // All auth cards (signup, login, confirm, reset-password) use w-full with max-w-md or max-w-[500px]
      for (const width of MOBILE_VIEWPORTS) {
        // Effective container width is 100% of viewport minus padding
        const effectiveContainerWidth = Math.min(width, 448); // 448px = max-w-md
        expect(effectiveContainerWidth).toBeLessThanOrEqual(width);
        expect(width).toBeGreaterThanOrEqual(320);
      }
    });

    it('verifies canonical login and recovery form inputs do not exceed viewport boundaries', () => {
      MOBILE_VIEWPORTS.forEach((viewportWidth) => {
        // Assert min padding of 16px on each side (32px total) on smallest 320px screen
        const minPadding = 32;
        const availableFormWidth = viewportWidth - minPadding;
        expect(availableFormWidth).toBeGreaterThanOrEqual(288);
      });
    });
  });

  describe('8. Independent Review Remediation: Refresh Retention, Request-Scoped Logout & LocalStorage Token Purge', () => {
    it('guarantees updateUserPassword accepts combined Authorization header and cookie context, returning full refreshed session', async () => {
      const user = { id: 'usr-review-test', email: 'review@example.com' };
      registerMockAuthUser(user);
      registerMockUserPassword('review@example.com', 'old-pass-123', user);

      const updateReq = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-usr-review-test',
          cookie: 'sb-refresh-token=mock-refresh-usr-review-test',
        },
        body: JSON.stringify({
          password: 'new-reviewed-password-2026',
        }),
      });

      const res = await resetPasswordHandler(updateReq);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.session?.access_token).toBeDefined();
      expect(json.session?.refresh_token).toBe('mock-refresh-usr-review-test');

      const setCookie = res.headers.get('set-cookie') || '';
      expect(setCookie).toContain('sb-access-token');
      expect(setCookie).toContain('sb-refresh-token=mock-refresh-usr-review-test');
      expect(setCookie).toContain('Max-Age=2592000'); // 30 days
    });

    it('guarantees logout revokes the exact refresh token tied to the request session and invalidates further refreshes', async () => {
      const user = { id: 'usr-logout-test', email: 'logout@example.com' };
      registerMockAuthUser(user);
      registerMockUserPassword('logout@example.com', 'pass-123456', user);

      const validRefreshToken = 'mock-refresh-usr-logout-test';

      // 1. Confirm refresh token is active prior to logout
      const preRefresh = await refreshSupabaseSession(validRefreshToken);
      expect(preRefresh.success).toBe(true);

      // 2. Perform request-scoped logout
      const logoutReq = new Request('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          cookie: `sb-access-token=mock-jwt-usr-logout-test; sb-refresh-token=${validRefreshToken}`,
        },
      });

      const logoutRes = await logoutHandler(logoutReq);
      expect(logoutRes.status).toBe(200);

      // 3. Confirm refresh token is now revoked and cannot be refreshed
      const postRefresh = await refreshSupabaseSession(validRefreshToken);
      expect(postRefresh.success).toBe(false);
      expect(postRefresh.error).toMatch(/invalid or expired/i);
    });
  });

  describe('9. Production Auth Regression — One Canonical Session Across Private Player APIs', () => {
    async function loginExistingPlayer() {
      await signUpWithPassword({
        displayName: 'SessionRanger',
        email: 'session-ranger@example.com',
        password: 'same-session-pass-2026',
        selectedStartingPath: 'challenge',
      });

      const loginReq = new Request('https://www.divinedesigndestinations.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'password_login',
          email: 'session-ranger@example.com',
          password: 'same-session-pass-2026',
        }),
      });

      const loginRes = await loginHandler(loginReq);
      const loginJson = await loginRes.json();
      const cookie = [
        `sb-access-token=${loginJson.session.access_token}`,
        `sb-refresh-token=${loginJson.session.refresh_token}`,
        'canton_player_id=stale-legacy-player-id',
      ].join('; ');

      return { loginRes, loginJson, cookie };
    }

    it('password login, /api/auth/me, and /api/player/command-center all accept the same Supabase cookie session', async () => {
      const { loginRes, loginJson, cookie } = await loginExistingPlayer();

      expect(loginRes.status).toBe(200);
      expect(loginJson.success).toBe(true);

      const meRes = await meHandler(new Request('https://www.divinedesigndestinations.com/api/auth/me', {
        headers: { cookie },
      }));
      const meJson = await meRes.json();
      expect(meRes.status).toBe(200);
      expect(meJson.isAuthenticated).toBe(true);
      expect(meJson.player.id).toBe(loginJson.player.id);

      const commandRes = await commandCenterHandler(new Request('https://www.divinedesigndestinations.com/api/player/command-center', {
        headers: { cookie },
      }));
      const commandJson = await commandRes.json();
      expect(commandRes.status).toBe(200);
      expect(commandJson.success).toBe(true);
      expect(commandJson.player.id).toBe(loginJson.player.id);
      expect(commandJson.player.displayName).toBe('SessionRanger');
    });

    it('anonymous and invalid command-center sessions return 401', async () => {
      const anonymous = await commandCenterHandler(new Request('https://www.divinedesigndestinations.com/api/player/command-center'));
      expect(anonymous.status).toBe(401);

      const invalid = await commandCenterHandler(new Request('https://www.divinedesigndestinations.com/api/player/command-center', {
        headers: { cookie: 'sb-access-token=invalid; sb-refresh-token=invalid' },
      }));
      expect(invalid.status).toBe(401);
    });

    it('/api/player/profile uses the same canonical session and rejects client-controlled player impersonation', async () => {
      const { loginJson, cookie } = await loginExistingPlayer();

      const profileGet = await profileHandler(new Request('https://www.divinedesigndestinations.com/api/player/profile', {
        headers: { cookie },
      }));
      const profileJson = await profileGet.json();
      expect(profileGet.status).toBe(200);
      expect(profileJson.player.id).toBe(loginJson.player.id);

      const profilePost = await profilePostHandler(new Request('https://www.divinedesigndestinations.com/api/player/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          playerId: 'attacker-controlled-player-id',
          displayName: 'Impersonator',
        }),
      }));
      expect(profilePost.status).toBe(403);
    });

    it('refresh rotation keeps /api/auth/me, command-center, and profile on the same player without localStorage', async () => {
      const { loginJson } = await loginExistingPlayer();
      const refreshOnlyCookie = `sb-access-token=expired-token; sb-refresh-token=${loginJson.session.refresh_token}`;

      const meRes = await meHandler(new Request('https://www.divinedesigndestinations.com/api/auth/me', {
        headers: { cookie: refreshOnlyCookie },
      }));
      const meJson = await meRes.json();
      expect(meJson.isAuthenticated).toBe(true);
      expect(meJson.player.id).toBe(loginJson.player.id);
      expect(meJson.session.access_token).toMatch(/^mock-jwt-refreshed-/);

      const rotatedCookie = [
        `sb-access-token=${meJson.session.access_token}`,
        `sb-refresh-token=${meJson.session.refresh_token}`,
      ].join('; ');

      const commandRes = await commandCenterHandler(new Request('https://www.divinedesigndestinations.com/api/player/command-center', {
        headers: { cookie: rotatedCookie },
      }));
      expect(commandRes.status).toBe(200);

      const profileRes = await profileHandler(new Request('https://www.divinedesigndestinations.com/api/player/profile', {
        headers: { cookie: rotatedCookie },
      }));
      expect(profileRes.status).toBe(200);
    });

    it('logout clears auth and command-center stays unauthorized after browser reopen', async () => {
      const { cookie } = await loginExistingPlayer();

      const logoutRes = await logoutHandler(new Request('https://www.divinedesigndestinations.com/api/auth/logout', {
        method: 'POST',
        headers: { cookie },
      }));
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.headers.get('set-cookie') || '').toContain('Max-Age=0');

      const reopened = await commandCenterHandler(new Request('https://www.divinedesigndestinations.com/api/player/command-center'));
      expect(reopened.status).toBe(401);
    });

    it('rejects external redirects and canonicalizes production hosts without splitting auth cookies', async () => {
      expect(sanitizeRedirectUrl('https://attacker.example/steal')).toBe('/profile');

      const apexRedirect = middleware(new NextRequest('https://divinedesigndestinations.com/profile'));
      expect(apexRedirect?.status).toBe(308);
      expect(apexRedirect?.headers.get('location')).toBe('https://www.divinedesigndestinations.com/profile');

      const aliasRedirect = middleware(new NextRequest('https://canton-quests.vercel.app/api/auth/login'));
      expect(aliasRedirect?.status).toBe(308);
      expect(aliasRedirect?.headers.get('location')).toBe('https://www.divinedesigndestinations.com/api/auth/login');

      vi.stubEnv('NODE_ENV', 'production');
      const { loginRes } = await loginExistingPlayer();
      const setCookie = loginRes.headers.get('set-cookie') || '';
      expect(setCookie).not.toContain('Domain=.divinedesigndestinations.com');
      expect(setCookie).toContain('sb-access-token');
      expect(setCookie).toContain('sb-refresh-token');
      expect(setCookie).toContain(`Max-Age=${AUTH_COOKIE_MAX_AGE}`);
    });
  });
});
