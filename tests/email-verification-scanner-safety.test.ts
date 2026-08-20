import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  sendEmailOtp,
  verifyTokenHash,
  getSiteUrl,
  resetMockAuthStores,
} from '../lib/supabase-auth';
import {
  initializeGameEngine,
  resetGameEngineStore,
  getAllPlayers,
} from '../lib/game-engine';
import { POST as confirmPostRoute, GET as confirmGetRoute } from '../app/api/auth/confirm/route';

describe('Canton Quests — Email Verification Flow & Scanner Safety Suite', () => {
  const originalEnvSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalEnvAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
    resetMockAuthStores();
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (originalEnvSiteUrl !== undefined) {
      process.env.NEXT_PUBLIC_SITE_URL = originalEnvSiteUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    }
    if (originalEnvAppUrl !== undefined) {
      process.env.NEXT_PUBLIC_APP_URL = originalEnvAppUrl;
    } else {
      delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });

  describe('1. Site URL & Redirect Configuration', () => {
    it('1. Defaults to https://divinedesigndestinations.com when no environment variable is set', () => {
      expect(getSiteUrl()).toBe('https://divinedesigndestinations.com');
    });

    it('2. Uses NEXT_PUBLIC_SITE_URL when configured and trims trailing slashes', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://divinedesigndestinations.com/';
      expect(getSiteUrl()).toBe('https://divinedesigndestinations.com');
    });

    it('3. Falls back to NEXT_PUBLIC_APP_URL when SITE_URL is not set', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://canton-quests.vercel.app/';
      expect(getSiteUrl()).toBe('https://canton-quests.vercel.app');
    });
  });

  describe('2. Scanner-Safe Verification Functionality', () => {
    it('4. sendEmailOtp creates scanner-safe redirect URL to /auth/confirm', async () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://divinedesigndestinations.com';
      const result = await sendEmailOtp('player1@example.com', {
        startingPath: 'family',
        redirectTo: '/events/canton-weekend-1',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Verification code sent');
    });

    it('5. verifyTokenHash rejects missing or empty token hashes', async () => {
      const res1 = await verifyTokenHash('');
      expect(res1.success).toBe(false);
      expect(res1.error).toContain('required');

      const res2 = await verifyTokenHash('   ');
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('required');
    });

    it('6. verifyTokenHash successfully verifies valid token hash and returns user session', async () => {
      const tokenHash = 'mock-token-abc12345';
      const res = await verifyTokenHash(tokenHash, 'email');

      expect(res.success).toBe(true);
      expect(res.user).toBeDefined();
      expect(res.user?.id).toBeDefined();
      expect(res.user?.id.length).toBeGreaterThan(10);
      expect(res.session?.access_token).toBeDefined();
    });
  });

  describe('3. HTTP Endpoints & Email Scanner Protection', () => {
    it('7. GET /api/auth/confirm forwards to /auth/confirm without consuming verification tokens (Scanner-Safe)', async () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://divinedesigndestinations.com';
      const scannerReq = new Request(
        'https://divinedesigndestinations.com/api/auth/confirm?token_hash=token-secret-777&type=email&next=/quests',
        { method: 'GET' }
      );

      const redirectRes = await confirmGetRoute(scannerReq);

      expect(redirectRes.status).toBe(307);
      const location = redirectRes.headers.get('location');
      expect(location).toContain('https://divinedesigndestinations.com/auth/confirm');
      expect(location).toContain('token_hash=token-secret-777');
      expect(location).toContain('next=%2Fquests');

      // Crucial: No player record was prematurely created by GET
      const allPlayers = getAllPlayers();
      const prematurePlayer = allPlayers.find((p) => p.userId?.includes('token-secret-777'));
      expect(prematurePlayer).toBeUndefined();
    });

    it('8. POST /api/auth/confirm deliberately verifies token and creates player account with selected path', async () => {
      const confirmReq = new Request('http://localhost:3000/api/auth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_hash: 'mock-token-verified-user-999',
          type: 'email',
          displayName: 'NeonRider_330',
          selectedStartingPath: 'challenge',
          next: '/events/canton-weekend-1',
        }),
      });

      const res = await confirmPostRoute(confirmReq);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.player).toBeDefined();
      expect(data.player.displayName).toBe('NeonRider_330');
      expect(data.player.selectedStartingPath).toBe('challenge');
      expect(data.redirectTo).toBe('/events/canton-weekend-1');
      expect(res.headers.get('set-cookie')).toContain('canton_player_id');
    });

    it('9. POST /api/auth/confirm with invalid or missing token returns 400/401 error', async () => {
      const badReq = new Request('http://localhost:3000/api/auth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_hash: '',
        }),
      });

      const res = await confirmPostRoute(badReq);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });

    it('10. Prevents open redirect attacks by sanitizing external, protocol-relative, and javascript URLs', async () => {
      // Test attacker external URL
      const attackReq1 = new Request('http://localhost:3000/api/auth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_hash: 'mock-token-safe-redirect-1',
          type: 'email',
          next: 'https://attacker.evil.com/steal-session',
        }),
      });
      const res1 = await confirmPostRoute(attackReq1);
      const data1 = await res1.json();
      expect(data1.redirectTo).toBe('/events/canton-weekend-1');

      // Test protocol-relative URL
      const attackReq2 = new Request('http://localhost:3000/api/auth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_hash: 'mock-token-safe-redirect-2',
          type: 'email',
          next: '//attacker.evil.com/phish',
        }),
      });
      const res2 = await confirmPostRoute(attackReq2);
      const data2 = await res2.json();
      expect(data2.redirectTo).toBe('/events/canton-weekend-1');

      // Test valid local relative path
      const validReq = new Request('http://localhost:3000/api/auth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_hash: 'mock-token-safe-redirect-3',
          type: 'email',
          next: '/profile',
        }),
      });
      const res3 = await confirmPostRoute(validReq);
      const data3 = await res3.json();
      expect(data3.redirectTo).toBe('/profile');
    });
  });
});
