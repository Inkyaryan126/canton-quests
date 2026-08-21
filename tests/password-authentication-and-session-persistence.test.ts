import { describe, it, expect, beforeEach } from 'vitest';
import {
  signUpWithPassword,
  signInWithPassword,
  sendPasswordResetEmail,
  updateUserPassword,
  verifyTokenHash,
  resolveAuthenticatedPlayer,
  resetMockAuthStores,
  registerMockUserPassword,
  registerMockAuthUser,
} from '../lib/supabase-auth';
import { POST as loginHandler } from '../app/api/auth/login/route';
import { POST as registerHandler } from '../app/api/auth/register/route';
import { POST as confirmPostHandler, GET as confirmGetHandler } from '../app/api/auth/confirm/route';
import { POST as resetPasswordHandler } from '../app/api/auth/reset-password/route';
import { POST as logoutHandler } from '../app/api/auth/logout/route';
import { GET as meHandler } from '../app/api/auth/me/route';
import * as localEngine from '../lib/game-engine';

describe('Canton Quests — Password Accounts & Persistent Sessions Test Suite', () => {
  beforeEach(() => {
    resetMockAuthStores();
    localEngine.resetGameEngineStore();
  });

  describe('1. New Player Sign Up with Callsign, Email, and Password', () => {
    it('successfully registers a new player account with password and returns session & player', async () => {
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

    it('POST /api/auth/register handles password signup requests smoothly', async () => {
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
      expect(res.headers.get('set-cookie')).toContain('canton_player_id');
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
    });

    it('POST /api/auth/login handles password login (Email + Password only, no callsign)', async () => {
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
      expect(res.headers.get('set-cookie')).toContain('canton_player_id');
      expect(res.headers.get('set-cookie')).toContain('Max-Age=2592000'); // 30 days
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

    it('dispatches password recovery email safely', async () => {
      const result = await sendPasswordResetEmail('iron@example.com');
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

    it('POST /api/auth/confirm verifies recovery token and returns session for password reset', async () => {
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
    });

    it('POST /api/auth/reset-password sets new password for authenticated session', async () => {
      const req = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-usr-iron_example_com',
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
    it('allows legacy players to set password and preserves callsign, XP, and badges', async () => {
      // Create pre-existing legacy player in local game engine
      const legacyPlayer = localEngine.registerPlayer({
        displayName: 'VeteranPilot',
        email: 'pilot@example.com',
        selectedStartingPath: 'challenge',
      });
      legacyPlayer.totalXp = 450;
      legacyPlayer.level = 3;

      // Existing player uses password login / recovery fallback to establish password
      const loginRes = await signInWithPassword('pilot@example.com', 'veteran-pilot-pass-2026');

      expect(loginRes.success).toBe(true);
      expect(loginRes.player?.displayName).toBe('VeteranPilot');
      expect(loginRes.player?.totalXp).toBe(450);
      expect(loginRes.player?.level).toBe(3);
    });
  });

  describe('5. Session Persistence & Explicit Log Out', () => {
    let sessionToken = '';

    beforeEach(async () => {
      const signUpRes = await signUpWithPassword({
        displayName: 'ApexRider',
        email: 'apex@example.com',
        password: 'apex-rider-pass',
        selectedStartingPath: 'family',
      });
      sessionToken = signUpRes.session!.access_token;
    });

    it('GET /api/auth/me resolves active player from Bearer token across requests', async () => {
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

    it('POST /api/auth/logout terminates session and clears cookies', async () => {
      const res = await logoutHandler();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      const cookieHeader = res.headers.get('set-cookie') || '';
      expect(cookieHeader).toContain('canton_player_id');
      expect(cookieHeader).toContain('Max-Age=0');
    });
  });
});
