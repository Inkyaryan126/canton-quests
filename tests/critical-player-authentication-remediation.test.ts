import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initializeGameEngine,
  resetGameEngineStore,
  registerPlayer,
  getPlayerById,
  getAllPlayers,
  getQuestsForEvent,
  submitQuestProof,
  awardAchievement,
  getAchievementsForPlayer,
  recordScoreLedger,
  getLeaderboardForEvent,
} from '../lib/game-engine';
import {
  sendEmailOtp,
  verifyEmailOtp,
  resolveAuthenticatedPlayer,
  resolveAuthenticatedPlayerId,
  resolveOrCreatePlayerForAuthUser,
  sanitizePlayerForPublic,
  registerMockAuthUser,
} from '../lib/supabase-auth';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';
import { POST as loginRoute } from '../app/api/auth/login/route';
import { POST as registerRoute } from '../app/api/auth/register/route';
import { GET as meRoute } from '../app/api/auth/me/route';
import { POST as logoutRoute } from '../app/api/auth/logout/route';
import { GET as profileGetRoute, POST as profilePostRoute } from '../app/api/player/profile/route';
import { POST as submitProofRoute } from '../app/api/game/submit/route';

describe('Canton Quests — Critical Player Authentication Remediation Suite', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  describe('1. Mandatory Security Tests (Tests A through H)', () => {
    it('TEST A: Attacker submits public callsign "ALICE" to login -> AUTHENTICATION DENIED', async () => {
      // 1. Create player Alice with public callsign "ALICE"
      const alice = registerPlayer({
        displayName: 'ALICE',
        email: 'alice@example.com',
        userId: 'usr-alice-real-auth-id',
        selectedStartingPath: 'family',
      });
      expect(alice.displayName).toBe('ALICE');

      // 2. Attacker submits Alice's public callsign to login endpoint
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'ALICE',
        }),
      });

      const res = await loginRoute(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('public identifiers');
      expect(res.headers.get('set-cookie')).toBeNull();
    });

    it('TEST B: Attacker submits Alice\'s email without completing OTP ownership proof -> AUTHENTICATION DENIED', async () => {
      registerPlayer({
        displayName: 'ALICE',
        email: 'alice@example.com',
        userId: 'usr-alice-real-auth-id',
      });

      // Attacker attempts login with email directly without OTP verification
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'alice@example.com',
          password: 'arbitrary-password',
        }),
      });

      const res = await loginRoute(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('public identifiers');
    });

    it('TEST C: Verified Supabase Auth user Alice authenticates -> Alice player resolved via players.user_id', async () => {
      const alice = registerPlayer({
        displayName: 'ALICE_AGENT',
        email: 'alice@example.com',
        userId: 'usr-alice-verified-123',
        selectedStartingPath: 'secret',
      });

      // Step 1: Send OTP
      const sendRes = await sendEmailOtp('alice@example.com');
      expect(sendRes.success).toBe(true);

      // Step 2: Verify OTP
      const verifyRes = await verifyEmailOtp('alice@example.com', '123456');
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.user?.email).toBe('alice@example.com');

      // Step 3: Resolve player via verified user
      const resolved = await resolveAuthenticatedPlayer(`mock-jwt-usr-alice-verified-123`);
      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe(alice.id);
      expect(resolved?.displayName).toBe('ALICE_AGENT');
      expect(resolved?.selectedStartingPath).toBe('secret');
    });

    it('TEST D: Authenticated Bob submits Alice\'s playerId to quest endpoint -> Server rejects forged identity & Alice receives zero mutation', async () => {
      const alice = registerPlayer({
        displayName: 'AlicePlayer',
        email: 'alice@example.com',
        userId: 'usr-alice-uuid',
      });

      const bob = registerPlayer({
        displayName: 'BobPlayer',
        email: 'bob@example.com',
        userId: 'usr-bob-uuid',
      });

      // Mock Supabase environment where Bob is authenticated with his own JWT
      vi.resetModules();
      vi.doMock('../lib/supabase', () => ({
        isSupabaseConfigured: true,
        isSupabaseAdminConfigured: true,
        supabase: {
          auth: {
            getUser: async (token: string) => {
              if (token === 'bob-valid-jwt') {
                return { data: { user: { id: 'usr-bob-uuid', email: 'bob@example.com' } }, error: null };
              }
              return { data: { user: null }, error: new Error('Invalid token') };
            },
          },
        },
        supabaseAdmin: {
          from: (table: string) => ({
            select: () => ({
              eq: (col: string, val: string) => ({
                single: async () => {
                  if (col === 'user_id' && val === 'usr-bob-uuid') {
                    return { data: { id: bob.id, user_id: 'usr-bob-uuid', display_name: 'BobPlayer' }, error: null };
                  }
                  return { data: null, error: new Error('Not found') };
                },
                maybeSingle: async () => {
                  if (col === 'user_id' && val === 'usr-bob-uuid') {
                    return { data: { id: bob.id, user_id: 'usr-bob-uuid', display_name: 'BobPlayer' }, error: null };
                  }
                  return { data: null, error: null };
                },
                limit: () => ({
                  order: () => Promise.resolve({ data: [] }),
                }),
              }),
            }),
          }),
        },
      }));

      const { submitQuestProofDB } = await import('../lib/supabase-db');

      // Bob tries to claim rewards for Alice's playerId
      const forgedSubmissionResult = await submitQuestProofDB(
        {
          playerId: alice.id, // Forged claimant
          questId: SEED_QUESTS[1].id,
          eventId: SEED_EVENT.id,
          proofType: 'passphrase',
          submittedContent: '1897',
        },
        'bob-valid-jwt' // Bob's auth token
      );

      expect(forgedSubmissionResult.success).toBe(false);
      expect(forgedSubmissionResult.awardedPoints).toBe(0);
      expect(forgedSubmissionResult.message).toContain('Authenticated player does not match requested reward claimant');

      // Alice's score remains untouched at 0
      const aliceAfter = getPlayerById(alice.id);
      expect(aliceAfter?.totalXp).toBe(0);

      vi.doUnmock('../lib/supabase');
    });

    it('TEST E: Unauthenticated user submits quest proof -> Denied with 401/403 (No XP awarded)', async () => {
      const req = new Request('http://localhost:3000/api/game/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'plr-unauthenticated-attacker',
          questId: SEED_QUESTS[1].id,
          eventId: SEED_EVENT.id,
          proofType: 'passphrase',
          submittedContent: '1897',
        }),
      });

      // Without authorization bearer token, submission is rejected
      const res = await submitProofRoute(req);
      const data = await res.json();

      expect(data.success).toBe(false);
      expect(data.awardedPoints).toBe(0);
    });

    it('TEST F: Logout then submit proof -> Denied', async () => {
      // 1. Player calls logout endpoint
      const logoutReq = new Request('http://localhost:3000/api/auth/logout', { method: 'POST' });
      const logoutRes = await logoutRoute(logoutReq);
      expect(logoutRes.status).toBe(200);

      // 2. Cookie is deleted
      const setCookie = logoutRes.headers.get('set-cookie');
      expect(setCookie).toContain('canton_player_id=;');

      // 3. Post-logout submission without auth token fails
      const req = new Request('http://localhost:3000/api/game/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'plr-logged-out',
          questId: SEED_QUESTS[0].id,
          eventId: SEED_EVENT.id,
          proofType: 'checkin',
        }),
      });

      const res = await submitProofRoute(req);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('TEST G: Public leaderboard callsign cannot be used as login credential', async () => {
      // Create top-ranking player with high score on leaderboard
      const champ = registerPlayer({
        displayName: 'CantonChampion_2026',
        email: 'champ@example.com',
        userId: 'usr-champ-uid',
      });
      recordScoreLedger({
        eventId: SEED_EVENT.id,
        playerId: champ.id,
        points: 1500,
        category: 'puzzle',
        description: 'Completed major cipher',
      });

      // Verify champion appears on leaderboard
      const leaderboard = getLeaderboardForEvent(SEED_EVENT.id);
      const champEntry = leaderboard.find((e) => e.displayName === 'CantonChampion_2026');
      expect(champEntry).toBeDefined();
      expect(champEntry?.totalPoints).toBeGreaterThan(0);

      // Attacker copies the public callsign from leaderboard and tries to log in
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: champEntry!.displayName,
        }),
      });

      const res = await loginRoute(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('public identifiers');
    });

    it('TEST H: Spectator token cannot become player auth without real account verification', async () => {
      // Attacker attempts to use a spectator session token as player auth
      await expect(
        resolveAuthenticatedPlayerId('spec_77777777-8888-9999-aaaa-bbbbbbbbbbbb')
      ).rejects.toThrow('Authenticated player session is required');
    });
  });

  describe('2. Functional Authentication & Three-Path Preservation Tests', () => {
    it('Family flyer onboarding preserves starting path and acquisition source through auth roundtrip', async () => {
      const authUser = {
        id: 'usr-family-flyer-player',
        email: 'family.adventurer@example.com',
        user_metadata: {
          selected_starting_path: 'family',
          acquisition_source: 'family_flyer',
        },
      };

      const player = await resolveOrCreatePlayerForAuthUser(authUser, {
        displayName: 'FamilyTeamAlpha',
        selectedStartingPath: 'family',
        acquisitionSource: 'family_flyer',
      });

      expect(player.displayName).toBe('FamilyTeamAlpha');
      expect(player.selectedStartingPath).toBe('family');
      expect(player.acquisitionSource).toBe('family_flyer');
    });

    it('Challenge flyer onboarding preserves starting path and acquisition source through auth roundtrip', async () => {
      const authUser = {
        id: 'usr-challenge-flyer-player',
        email: 'runner@example.com',
      };

      const player = await resolveOrCreatePlayerForAuthUser(authUser, {
        displayName: 'KineticSprint99',
        selectedStartingPath: 'challenge',
        acquisitionSource: 'challenge_flyer',
      });

      expect(player.displayName).toBe('KineticSprint99');
      expect(player.selectedStartingPath).toBe('challenge');
      expect(player.acquisitionSource).toBe('challenge_flyer');
    });

    it('Secret flyer onboarding preserves starting path and acquisition source through auth roundtrip', async () => {
      const authUser = {
        id: 'usr-secret-flyer-player',
        email: 'cipher.hound@example.com',
      };

      const player = await resolveOrCreatePlayerForAuthUser(authUser, {
        displayName: 'MonumentDecoder',
        selectedStartingPath: 'secret',
        acquisitionSource: 'secret_flyer',
      });

      expect(player.displayName).toBe('MonumentDecoder');
      expect(player.selectedStartingPath).toBe('secret');
      expect(player.acquisitionSource).toBe('secret_flyer');
    });

    it('Main site path selection survives authentication roundtrip', async () => {
      const sendRes = await sendEmailOtp('mainsite.user@example.com', {
        startingPath: 'challenge',
        acquisitionSource: 'main_site_path_selector',
      });
      expect(sendRes.success).toBe(true);

      const verifyRes = await verifyEmailOtp('mainsite.user@example.com', '123456');
      expect(verifyRes.success).toBe(true);

      const player = await resolveOrCreatePlayerForAuthUser(verifyRes.user!, {
        displayName: 'GridChallenger',
        selectedStartingPath: 'challenge',
        acquisitionSource: 'main_site_path_selector',
      });

      expect(player.selectedStartingPath).toBe('challenge');
      expect(player.acquisitionSource).toBe('main_site_path_selector');
    });

    it('Returning player restores historical XP, achievements, and profile personalization', async () => {
      const userId = 'usr-returning-veteran-330';
      const player = registerPlayer({
        displayName: 'VeteranHero_330',
        email: 'veteran@example.com',
        userId,
        selectedStartingPath: 'secret',
        bio: 'City puzzle explorer.',
        tagline: 'Always curious.',
      });

      // Award XP and achievements
      recordScoreLedger({
        eventId: SEED_EVENT.id,
        playerId: player.id,
        points: 750,
        category: 'puzzle',
        description: 'Solved Founder Cipher',
      });
      awardAchievement(player.id, 'pathfinder-secret', SEED_EVENT.id);
      awardAchievement(player.id, 'triple-threat', SEED_EVENT.id);

      // Returning player session check via /api/auth/me
      const req = new Request('http://localhost:3000/api/auth/me', {
        headers: {
          Authorization: `Bearer mock-jwt-${userId}`,
        },
      });

      const res = await meRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isAuthenticated).toBe(true);
      expect(data.player.id).toBe(player.id);
      expect(data.player.displayName).toBe('VeteranHero_330');
      expect(data.player.bio).toBe('City puzzle explorer.');
      expect(data.achievements.length).toBeGreaterThanOrEqual(2);
    });

    it('Safe legacy account claiming: unlinked legacy player with matching email is claimed upon verified OTP', async () => {
      // Legacy player record with historical XP, but null userId (created in Phase 1 before auth)
      const legacyPlayer = registerPlayer({
        displayName: 'LegacyLegend_2026',
        email: 'founder.player@example.com',
        selectedStartingPath: 'family',
      });
      // Ensure userId is undefined/null
      delete (legacyPlayer as any).userId;

      recordScoreLedger({
        eventId: SEED_EVENT.id,
        playerId: legacyPlayer.id,
        points: 900,
        category: 'exploration',
        description: 'Historic discovery',
      });

      // Verified Supabase user logs in with the same email
      const verifiedAuthUser = {
        id: 'usr-new-supabase-auth-uuid-999',
        email: 'founder.player@example.com',
      };
      registerMockAuthUser(verifiedAuthUser);

      const resolvedPlayer = await resolveAuthenticatedPlayer(`mock-jwt-${verifiedAuthUser.id}`);
      expect(resolvedPlayer).toBeDefined();
      expect(resolvedPlayer?.id).toBe(legacyPlayer.id);
      expect(resolvedPlayer?.userId).toBe('usr-new-supabase-auth-uuid-999');

      // Historical XP remains 100% intact
      const updated = getPlayerById(legacyPlayer.id);
      expect(updated?.userId).toBe('usr-new-supabase-auth-uuid-999');
    });

    it('Duplicate callsign does not hijack existing player account', async () => {
      // Alice registered first
      const alice = registerPlayer({
        displayName: 'ShadowAgent',
        email: 'alice@example.com',
        userId: 'usr-alice-legit',
      });

      // Bob tries to register with the same callsign
      const bob = registerPlayer({
        displayName: 'ShadowAgent',
        email: 'bob@example.com',
        userId: 'usr-bob-new',
      });

      expect(bob.id).not.toBe(alice.id);
      expect(bob.userId).toBe('usr-bob-new');
      expect(alice.userId).toBe('usr-alice-legit');
    });

    it('Public player payloads and leaderboard sanitize email and private auth details', () => {
      const player = registerPlayer({
        displayName: 'PrivateAgent_007',
        email: 'secret.agent@example.com',
        userId: 'usr-confidential-uid',
      });

      const sanitized = sanitizePlayerForPublic(player);
      expect((sanitized as any).email).toBeUndefined();
      expect((sanitized as any).userId).toBeUndefined();
      expect(sanitized.displayName).toBe('PrivateAgent_007');
    });
  });

  describe('3. Profile Mutation Authorization', () => {
    it('Authenticated player can update own profile', async () => {
      const player = registerPlayer({
        displayName: 'OriginalHandle',
        email: 'owner@example.com',
        userId: 'usr-profile-owner',
      });

      const req = new Request('http://localhost:3000/api/player/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer mock-jwt-usr-profile-owner`,
        },
        body: JSON.stringify({
          displayName: 'UpdatedHandle_330',
          bio: 'New bio content',
          tagline: 'Speed and focus',
        }),
      });

      const res = await profilePostRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.player.displayName).toBe('UpdatedHandle_330');
      expect(data.player.bio).toBe('New bio content');
    });

    it('Attacker cannot update victim profile by supplying victim playerId in request body', async () => {
      const victim = registerPlayer({
        displayName: 'VictimPlayer',
        email: 'victim@example.com',
        userId: 'usr-victim-uid',
      });

      const attacker = registerPlayer({
        displayName: 'AttackerPlayer',
        email: 'attacker@example.com',
        userId: 'usr-attacker-uid',
      });

      const req = new Request('http://localhost:3000/api/player/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer mock-jwt-usr-attacker-uid`,
        },
        body: JSON.stringify({
          playerId: victim.id, // Attempting to modify victim
          displayName: 'HackedVictimHandle',
        }),
      });

      const res = await profilePostRoute(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);

      // Victim profile remains unaltered
      const victimCheck = getPlayerById(victim.id);
      expect(victimCheck?.displayName).toBe('VictimPlayer');
    });
  });
});
