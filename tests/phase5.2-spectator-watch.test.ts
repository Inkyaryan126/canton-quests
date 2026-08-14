// Canton Quests — Phase 5.2 Public Watch Experience & Spectator Safety Test Suite

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSessionTokenHash,
  createIpHash,
  registerOrUpdateSpectatorSession,
  convertSpectatorToPlayer,
  createAudienceEvent,
  getAudienceEvents,
  getAudienceEventOptions,
  castSpectatorVote,
  publishToPublicGameFeed,
  getPublicGameFeed,
  createHostBroadcast,
  getHostBroadcasts,
  toggleSpectatorSystemFreeze,
  getSpectatorSystemSettings,
  resetSpectatorStores,
  seedDefaultSpectatorData,
  getDistrictActivity,
  getServerDerivedAuthenticatedPlayerId,
  extractCookieValue,
} from '../lib/spectator-engine';
import { POST } from '../app/api/game/spectator/route';
import { getCurrentPlayer, setCurrentPlayer, completeSpectatorConversion } from '../lib/game-engine';
import * as supabaseModule from '../lib/supabase';

describe('Phase 5.2 Public Watch Spectator Experience Test Suite', () => {
  beforeEach(() => {
    resetSpectatorStores();
    vi.restoreAllMocks();
  });

  describe('1. Spectator Session & Monotonic Sticky Minor Persistence', () => {
    it('should register a new minor spectator session accurately', () => {
      const sessionHash = createSessionTokenHash('session-token-minor-1');
      const ipHash = createIpHash('192.168.1.100');

      const session = registerOrUpdateSpectatorSession({
        sessionTokenHash: sessionHash,
        ipHash,
        isMinor: true,
        ageAcknowledged: true,
        safetyAcknowledged: true,
      });

      expect(session.isMinor).toBe(true);
      expect(session.ageAcknowledgedAt).toBeDefined();
      expect(session.safetyAcknowledgedAt).toBeDefined();
    });

    it('should NOT clear sticky minor status when session is refreshed with isMinor omitted', () => {
      const sessionHash = createSessionTokenHash('session-token-minor-2');
      const ipHash = createIpHash('192.168.1.101');

      // 1. Initial registration as minor
      const session1 = registerOrUpdateSpectatorSession({
        sessionTokenHash: sessionHash,
        ipHash,
        isMinor: true,
        ageAcknowledged: true,
        safetyAcknowledged: true,
      });
      expect(session1.isMinor).toBe(true);

      // 2. Refresh with isMinor omitted (undefined)
      const session2 = registerOrUpdateSpectatorSession({
        sessionTokenHash: sessionHash,
        ipHash,
        // isMinor omitted
      });

      expect(session2.isMinor).toBe(true);
    });

    it('should NOT clear sticky minor status when session is refreshed with isMinor=false', () => {
      const sessionHash = createSessionTokenHash('session-token-minor-3');
      const ipHash = createIpHash('192.168.1.102');

      // 1. Initial registration as minor
      const session1 = registerOrUpdateSpectatorSession({
        sessionTokenHash: sessionHash,
        ipHash,
        isMinor: true,
      });
      expect(session1.isMinor).toBe(true);

      // 2. Attempt refresh passing explicit false
      const session2 = registerOrUpdateSpectatorSession({
        sessionTokenHash: sessionHash,
        ipHash,
        isMinor: false,
      });

      // Must remain true
      expect(session2.isMinor).toBe(true);
    });
  });

  describe('2. Active Audience Voting & Duplicate Prevention', () => {
    it('should allow a spectator to cast a single valid vote in an active audience event', () => {
      const { event, options } = createAudienceEvent({
        eventId: 'evt-watch-test',
        title: 'Choose the Finale Clue Drop',
        eventType: 'audience_vote',
        options: [
          { label: 'Centennial Plaza Fountain' },
          { label: 'Palace Theatre Arcade' },
        ],
      });

      const sessionHash = createSessionTokenHash('spec-vote-1');
      const ipHash = createIpHash('10.0.0.1');

      const result = castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[0].id,
        sessionTokenHash: sessionHash,
        ipHash,
      });

      expect(result.success).toBe(true);
      expect(result.newVoteCount).toBe(1);

      const updatedOptions = getAudienceEventOptions(event.id, false);
      expect(updatedOptions[0].voteCount).toBe(1);
    });

    it('should STRICTLY REJECT duplicate vote attempts from the same spectator session', () => {
      const { event, options } = createAudienceEvent({
        eventId: 'evt-watch-test-2',
        title: 'Select Flash Quest Target Zone',
        eventType: 'audience_vote',
        options: [
          { label: 'Downtown Arts Corridor' },
          { label: 'Central Market District' },
        ],
      });

      const sessionHash = createSessionTokenHash('spec-vote-dup-1');
      const ipHash = createIpHash('10.0.0.2');

      // First vote
      const vote1 = castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[0].id,
        sessionTokenHash: sessionHash,
        ipHash,
      });
      expect(vote1.success).toBe(true);

      // Second vote attempt (duplicate)
      const vote2 = castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[1].id,
        sessionTokenHash: sessionHash,
        ipHash,
      });

      expect(vote2.success).toBe(false);
      expect(['VOTE_LIMIT_REACHED', 'DUPLICATE_VOTE']).toContain(vote2.code);
    });
  });

  describe('3. Game Master Freeze & System Paused States', () => {
    it('should reject vote attempts when Game Master freezes spectator system globally', () => {
      const { event, options } = createAudienceEvent({
        eventId: 'evt-freeze-test',
        title: 'Emergency Freeze Event',
        eventType: 'audience_vote',
        options: [{ label: 'Option A' }, { label: 'Option B' }],
      });

      // Enable system freeze
      toggleSpectatorSystemFreeze('evt-freeze-test', true, 'Weather Emergency');

      const sessionHash = createSessionTokenHash('spec-freeze-1');
      const ipHash = createIpHash('10.0.0.3');

      const result = castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[0].id,
        sessionTokenHash: sessionHash,
        ipHash,
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('SPECTATOR_SYSTEM_DISABLED');

      const settings = getSpectatorSystemSettings('evt-freeze-test');
      expect(settings.isSpectatorSystemDisabled).toBe(true);
      expect(settings.disabledReason).toBe('Weather Emergency');
    });
  });

  describe('4. Default Spectator Seed Data & Watch Feed Retrieval', () => {
    it('should seed default spectator data automatically when stores are empty', () => {
      // Calling getAudienceEvents auto-seeds default spectator data
      const events = getAudienceEvents('default-event', false);
      expect(events.length).toBeGreaterThan(0);

      const feed = getPublicGameFeed('default-event');
      expect(feed.length).toBeGreaterThan(0);

      const broadcasts = getHostBroadcasts('default-event', false);
      expect(broadcasts.length).toBeGreaterThan(0);
    });

    it('should sanitize text content in public feed items and host broadcasts', () => {
      seedDefaultSpectatorData('evt-sanitize-test');

      const feed = getPublicGameFeed('evt-sanitize-test');
      feed.forEach((item) => {
        // Ensure no exact lat/lon coordinates or secret codes are exposed
        expect(item.headline).not.toMatch(/lat\s*:\s*\d+/i);
        expect(item.body).not.toMatch(/secret_passphrase/i);
      });
    });
  });

  describe('5. Spectator-to-Player Conversion & Security Isolation', () => {
    describe('5.1 Required Negative Security Tests (Identity Forgery Prevention in Supabase Mode)', () => {
      it('1. Forged x-player-token cannot establish authenticated identity in Supabase mode', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);
        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-player-token': 'plr-forged-attacker-id',
          },
        });

        const derivedId = await getServerDerivedAuthenticatedPlayerId(req);
        expect(derivedId).toBeUndefined();
      });

      it('2. Forged body.playerId cannot establish authenticated identity', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);
        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: 'plr-forged-body-id' }),
        });

        const derivedId = await getServerDerivedAuthenticatedPlayerId(req, 'plr-forged-body-id');
        expect(derivedId).toBeUndefined();
      });

      it('3. Forged UUID-shaped player IDs cannot establish authenticated identity', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);
        const forgedUuid = 'e7b8a910-1234-4567-89ab-cdef01234567';
        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-player-token': forgedUuid,
          },
          body: JSON.stringify({ playerId: forgedUuid }),
        });

        const derivedId = await getServerDerivedAuthenticatedPlayerId(req, forgedUuid);
        expect(derivedId).toBeUndefined();
      });

      it('4. JWT candidates in x-player-token, body.playerId, or cg_player_token are IGNORED in Supabase mode', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);
        const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

        const mockSupabase = {
          auth: {
            getUser: async () => ({ data: { user: { id: 'usr-fake-jwt' } }, error: null }),
          },
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: '99999999-9999-9999-9999-999999999999' } }),
              }),
            }),
          }),
        };
        vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase as any);

        // JWT supplied via x-player-token
        const req1 = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-player-token': fakeJwt,
          },
        });
        const derived1 = await getServerDerivedAuthenticatedPlayerId(req1);
        expect(derived1).toBeUndefined();

        // JWT supplied via body.playerId
        const req2 = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: fakeJwt }),
        });
        const derived2 = await getServerDerivedAuthenticatedPlayerId(req2, fakeJwt);
        expect(derived2).toBeUndefined();

        // JWT supplied via cg_player_token cookie
        const req3 = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `cg_player_token=${fakeJwt}`,
          },
        });
        const derived3 = await getServerDerivedAuthenticatedPlayerId(req3);
        expect(derived3).toBeUndefined();
      });

      it('5. plr-default-guest cannot satisfy authenticated_only', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

        const mockSupabaseAdmin = {
          from: (table: string) => {
            if (table === 'spectator_system_settings') {
              return {
                select: () => ({
                  eq: () => ({
                    single: async () => ({
                      data: { event_id: 'evt-auth-only-test', is_spectator_system_disabled: false },
                    }),
                  }),
                }),
              };
            }
            return {};
          },
          rpc: async (fn: string, params: any) => {
            if (fn === 'cast_spectator_vote') {
              if (!params.p_player_id) {
                return {
                  data: { success: false, error: 'Authentication required for this vote', code: 'UNAUTHENTICATED' },
                  error: null,
                };
              }
              return { data: { success: true, new_vote_count: 1 }, error: null };
            }
            return { data: null, error: new Error('Unknown RPC') };
          },
        };
        vi.spyOn(supabaseModule, 'supabaseAdmin', 'get').mockReturnValue(mockSupabaseAdmin as any);

        const { event, options } = createAudienceEvent({
          eventId: 'evt-auth-only-test',
          title: 'Auth Only Event',
          eventType: 'audience_vote',
          eligibilityMode: 'authenticated_only',
          options: [{ label: 'Option 1' }, { label: 'Option 2' }],
        });

        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-player-token': 'plr-default-guest',
            'Cookie': 'cg_spec_token=spec_guest_token_1',
          },
          body: JSON.stringify({
            audienceEventId: event.id,
            optionId: options[0].id,
            eventId: 'evt-auth-only-test',
          }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Authentication required for this vote');
      });

      it('6. Raw local player IDs cannot bypass exclude_active_players', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-player-token': 'plr-fake-bypass-id',
          },
        });

        const derivedId = await getServerDerivedAuthenticatedPlayerId(req);
        expect(derivedId).toBeUndefined();
      });

      it('7. A spectator cannot claim another player\'s UUID during conversion', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

        const specToken = 'spec_attacker_token_1';
        const sessionHash = createSessionTokenHash(specToken);

        const sessionsStore = [
          {
            id: 'sess-spec-claimed',
            session_token_hash: sessionHash,
            ip_hash: 'ip-hash-test',
            converted_to_player_id: null as string | null,
            is_minor: false,
            created_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          },
        ];

        let passedPlayerIdToRpc: string | undefined;

        const mockSupabaseAdmin = {
          from: (table: string) => ({
            select: () => ({
              eq: (col: string, val: string) => ({
                maybeSingle: async () => {
                  if (table === 'spectator_sessions') {
                    const match = sessionsStore.find((s) => (s as any)[col] === val);
                    return { data: match || null };
                  }
                  return { data: null };
                },
              }),
            }),
            upsert: async () => ({ error: null }),
          }),
          rpc: async (fn: string, params: { p_session_token_hash: string; p_player_id: string }) => {
            if (fn === 'convert_spectator_session_to_player') {
              passedPlayerIdToRpc = params.p_player_id;
              const match = sessionsStore.find((s) => s.session_token_hash === params.p_session_token_hash);
              if (!match) return { data: null, error: null };
              match.converted_to_player_id = params.p_player_id;
              return { data: match, error: null };
            }
            return { data: null, error: new Error('Unknown RPC') };
          },
        };
        vi.spyOn(supabaseModule, 'supabaseAdmin', 'get').mockReturnValue(mockSupabaseAdmin as any);

        const targetVictimUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `cg_spec_token=${specToken}`,
          },
          body: JSON.stringify({
            action: 'convert_to_player',
            playerId: targetVictimUuid,
          }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);

        expect(data.session.convertedToPlayerId).not.toBe(targetVictimUuid);
        expect(passedPlayerIdToRpc).not.toBe(targetVictimUuid);
        expect(passedPlayerIdToRpc).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });

      it('8. Conversion MUST fail if spectator session row does not pre-exist in database', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);

        const mockSupabaseAdmin = {
          from: (table: string) => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null }), // No session row in DB!
              }),
            }),
          }),
          rpc: async () => ({ data: null, error: null }),
        };
        vi.spyOn(supabaseModule, 'supabaseAdmin', 'get').mockReturnValue(mockSupabaseAdmin as any);

        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'cg_spec_token=spec_nonexistent_session',
          },
          body: JSON.stringify({ action: 'convert_to_player', callsign: 'NoSessionAgent' }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('No active spectator session found for conversion');
      });
    });

    describe('5.2 Required Positive Security Tests (Verified Identity & Conversion Flow)', () => {
      it('1. Valid Supabase JWT resolves the correct DB player UUID', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);
        const mockSupabase = {
          auth: {
            getUser: async (token: string) => {
              if (token === 'valid.supabase.jwt.token') {
                return { data: { user: { id: 'usr-supabase-999' } }, error: null };
              }
              return { data: { user: null }, error: new Error('Invalid JWT') };
            },
          },
          from: (table: string) => {
            if (table === 'players') {
              return {
                select: () => ({
                  eq: (col: string, val: string) => ({
                    maybeSingle: async () => ({
                      data: val === 'usr-supabase-999' ? { id: '11111111-2222-3333-4444-555555555555' } : null,
                    }),
                  }),
                }),
              };
            }
            return {};
          },
        };
        vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase as any);

        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid.supabase.jwt.token',
          },
        });

        const derivedId = await getServerDerivedAuthenticatedPlayerId(req);
        expect(derivedId).toBe('11111111-2222-3333-4444-555555555555');
      });

      it('2. Anonymous spectator conversion generates a server-owned UUID', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);
        const specToken = 'spec_anon_gen_token_1';
        const sessionHash = createSessionTokenHash(specToken);

        const sessionsStore = [
          {
            id: 'sess-spec-gen-1',
            session_token_hash: sessionHash,
            ip_hash: 'ip-hash-gen-1',
            converted_to_player_id: null as string | null,
            is_minor: false,
            created_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          },
        ];

        let passedPlayerIdToRpc: string | undefined;

        const mockSupabaseAdmin = {
          from: (table: string) => ({
            select: () => ({
              eq: (col: string, val: string) => ({
                maybeSingle: async () => {
                  if (table === 'spectator_sessions') {
                    const match = sessionsStore.find((s) => (s as any)[col] === val);
                    return { data: match || null };
                  }
                  return { data: null };
                },
              }),
            }),
            upsert: async () => ({ error: null }),
          }),
          rpc: async (fn: string, params: { p_session_token_hash: string; p_player_id: string }) => {
            if (fn === 'convert_spectator_session_to_player') {
              passedPlayerIdToRpc = params.p_player_id;
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.p_player_id);
              expect(isUuid).toBe(true);

              const match = sessionsStore.find((s) => s.session_token_hash === params.p_session_token_hash);
              if (!match) return { data: null, error: null };

              match.converted_to_player_id = params.p_player_id;
              return { data: match, error: null };
            }
            return { data: null, error: new Error('Unknown RPC') };
          },
        };
        vi.spyOn(supabaseModule, 'supabaseAdmin', 'get').mockReturnValue(mockSupabaseAdmin as any);

        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `cg_spec_token=${specToken}`,
          },
          body: JSON.stringify({
            action: 'convert_to_player',
            callsign: 'WalkupAgentZero',
          }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.session.convertedToPlayerId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(passedPlayerIdToRpc).toBe(data.session.convertedToPlayerId);
      });

      it('3. Conversion persists that UUID as converted_to_player_id', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);
        const specToken = 'spec_token_persist_test';
        const sessionHash = createSessionTokenHash(specToken);

        const sessionsStore = [
          {
            id: 'sess-spec-persist-1',
            session_token_hash: sessionHash,
            ip_hash: 'ip-hash-persist-1',
            converted_to_player_id: null as string | null,
            is_minor: false,
            created_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          },
        ];

        let recordedSessionHash: string | undefined;
        let recordedPlayerId: string | undefined;

        const mockSupabaseAdmin = {
          from: (table: string) => ({
            select: () => ({
              eq: (col: string, val: string) => ({
                maybeSingle: async () => {
                  if (table === 'spectator_sessions') {
                    const match = sessionsStore.find((s) => (s as any)[col] === val);
                    return { data: match || null };
                  }
                  return { data: null };
                },
              }),
            }),
            upsert: async () => ({ error: null }),
          }),
          rpc: async (fn: string, params: { p_session_token_hash: string; p_player_id: string }) => {
            if (fn === 'convert_spectator_session_to_player') {
              recordedSessionHash = params.p_session_token_hash;
              recordedPlayerId = params.p_player_id;
              const match = sessionsStore.find((s) => s.session_token_hash === params.p_session_token_hash);
              if (!match) return { data: null, error: null };
              match.converted_to_player_id = params.p_player_id;
              return { data: match, error: null };
            }
            return { data: null, error: new Error('Unknown RPC') };
          },
        };
        vi.spyOn(supabaseModule, 'supabaseAdmin', 'get').mockReturnValue(mockSupabaseAdmin as any);

        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `cg_spec_token=${specToken}`,
          },
          body: JSON.stringify({ action: 'convert_to_player', callsign: 'PersistAgent' }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(data.success).toBe(true);
        expect(recordedSessionHash).toBe(sessionHash);
        expect(recordedPlayerId).toBe(data.session.convertedToPlayerId);
      });

      it('4. Returning converted spectator is resolved through the spectator session cookie', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);
        const returningPlayerUuid = '22222222-3333-4444-5555-666666666666';

        const mockSupabaseAdmin = {
          from: (table: string) => {
            if (table === 'spectator_sessions') {
              return {
                select: () => ({
                  eq: (col: string, val: string) => ({
                    maybeSingle: async () => ({
                      data: { converted_to_player_id: returningPlayerUuid },
                    }),
                  }),
                }),
              };
            }
            return {};
          },
        };
        vi.spyOn(supabaseModule, 'supabaseAdmin', 'get').mockReturnValue(mockSupabaseAdmin as any);

        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'cg_spec_token=spec_returning_cookie_1',
          },
        });

        const derivedId = await getServerDerivedAuthenticatedPlayerId(req);
        expect(derivedId).toBe(returningPlayerUuid);
      });

      it('5. Converted spectator can satisfy authenticated_only without sending x-player-token', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);
        const convertedUuid = '33333333-4444-5555-6666-777777777777';

        const mockSupabaseAdmin = {
          from: (table: string) => {
            if (table === 'spectator_sessions') {
              return {
                select: () => ({
                  eq: (col: string, val: string) => ({
                    maybeSingle: async () => ({
                      data: { converted_to_player_id: convertedUuid },
                    }),
                  }),
                }),
              };
            }
            if (table === 'spectator_system_settings') {
              return {
                select: () => ({
                  eq: () => ({
                    single: async () => ({
                      data: { event_id: 'default-event', is_spectator_system_disabled: false },
                    }),
                  }),
                }),
              };
            }
            return {};
          },
          rpc: async (fn: string, params: any) => {
            if (fn === 'cast_spectator_vote') {
              expect(params.p_player_id).toBe(convertedUuid);
              return {
                data: { success: true, new_vote_count: 5 },
                error: null,
              };
            }
            return { data: null, error: new Error('Unknown RPC') };
          },
        };
        vi.spyOn(supabaseModule, 'supabaseAdmin', 'get').mockReturnValue(mockSupabaseAdmin as any);

        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'cg_spec_token=spec_converted_voter_1',
          },
          body: JSON.stringify({
            audienceEventId: 'evt-auth-only-1',
            optionId: 'opt-auth-only-1',
            eventId: 'default-event',
          }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.newVoteCount).toBe(5);
      });

      it('6. Active-player exclusion works using the server-derived converted player ID', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);
        const activePlayerUuid = '44444444-5555-6666-7777-888888888888';

        const mockSupabaseAdmin = {
          from: (table: string) => {
            if (table === 'spectator_sessions') {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: { converted_to_player_id: activePlayerUuid },
                    }),
                  }),
                }),
              };
            }
            if (table === 'spectator_system_settings') {
              return {
                select: () => ({
                  eq: () => ({
                    single: async () => ({
                      data: { event_id: 'default-event', is_spectator_system_disabled: false },
                    }),
                  }),
                }),
              };
            }
            return {};
          },
          rpc: async (fn: string, params: any) => {
            if (fn === 'cast_spectator_vote') {
              expect(params.p_player_id).toBe(activePlayerUuid);
              return {
                data: {
                  success: false,
                  error: 'Active quest players cannot participate in this spectator vote',
                  code: 'EXCLUDED_ACTIVE_PLAYER',
                },
                error: null,
              };
            }
            return { data: null, error: new Error('Unknown RPC') };
          },
        };
        vi.spyOn(supabaseModule, 'supabaseAdmin', 'get').mockReturnValue(mockSupabaseAdmin as any);

        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'cg_spec_token=spec_active_voter_1',
          },
          body: JSON.stringify({
            audienceEventId: 'evt-exclude-active-1',
            optionId: 'opt-exclude-active-1',
            eventId: 'default-event',
          }),
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Active quest players cannot participate');
      });

      it('7. The real RPC receives a UUID-compatible p_player_id and enforces spectator session existence', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);
        const specToken = 'spec_uuid_contract_1';
        const sessionHash = createSessionTokenHash(specToken);

        const sessionsStore = [
          {
            id: 'sess-uuid-contract',
            session_token_hash: sessionHash,
            ip_hash: 'ip-hash-uuid',
            converted_to_player_id: null as string | null,
            is_minor: false,
            created_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          },
        ];

        let passedRpcPlayerId: string | undefined;

        const mockSupabaseAdmin = {
          from: (table: string) => ({
            select: () => ({
              eq: (col: string, val: string) => ({
                maybeSingle: async () => {
                  if (table === 'spectator_sessions') {
                    const match = sessionsStore.find((s) => (s as any)[col] === val);
                    return { data: match || null };
                  }
                  return { data: null };
                },
              }),
            }),
            upsert: async () => ({ error: null }),
          }),
          rpc: async (fn: string, params: { p_session_token_hash: string; p_player_id: string }) => {
            if (fn === 'convert_spectator_session_to_player') {
              passedRpcPlayerId = params.p_player_id;
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.p_player_id);
              expect(isUuid).toBe(true);

              const match = sessionsStore.find((s) => s.session_token_hash === params.p_session_token_hash);
              if (!match) return { data: null, error: null };

              match.converted_to_player_id = params.p_player_id;
              return { data: match, error: null };
            }
            return { data: null, error: new Error('Unknown RPC') };
          },
        };
        vi.spyOn(supabaseModule, 'supabaseAdmin', 'get').mockReturnValue(mockSupabaseAdmin as any);

        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `cg_spec_token=${specToken}`,
          },
          body: JSON.stringify({ action: 'convert_to_player', callsign: 'UuidContractAgent' }),
        });

        await POST(req);

        expect(passedRpcPlayerId).toBeDefined();
        expect(passedRpcPlayerId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(passedRpcPlayerId).not.toContain('plr-');
      });

      it('8. Local non-Supabase development behavior still functions', async () => {
        vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(false);

        const sessionHash = createSessionTokenHash('spec-local-dev-1');
        registerOrUpdateSpectatorSession({
          sessionTokenHash: sessionHash,
          ipHash: createIpHash('127.0.0.1'),
        });

        const converted = convertSpectatorToPlayer(sessionHash, 'plr-local-agent-42');
        expect(converted?.convertedToPlayerId).toBe('plr-local-agent-42');

        const req = new Request('http://localhost:3000/api/game/spectator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-player-token': 'plr-local-agent-42',
          },
        });

        const derivedId = await getServerDerivedAuthenticatedPlayerId(req);
        expect(derivedId).toBe('plr-local-agent-42');
      });
    });
  });

  describe('6. District Activity & Privacy Isolation', () => {
    it('should aggregate broad district activity without exposing exact GPS coordinates', () => {
      seedDefaultSpectatorData('evt-district-test');

      const districts = getDistrictActivity('evt-district-test');
      expect(districts.length).toBe(4);

      districts.forEach((d) => {
        expect(d).toHaveProperty('id');
        expect(d).toHaveProperty('name');
        expect(d).toHaveProperty('landmark');
        expect(d).toHaveProperty('activityLevel');
        expect(d).toHaveProperty('agentCount');
        expect(d).toHaveProperty('activeQuestsCount');
        // Ensure no latitude/longitude attributes exist on district aggregation objects
        expect((d as any).latitude).toBeUndefined();
        expect((d as any).longitude).toBeUndefined();
        expect((d as any).exactLocation).toBeUndefined();
      });
    });
  });

  describe('7. Host Broadcasts & System Settings', () => {
    it('should retrieve published host broadcasts with tone metadata', () => {
      createHostBroadcast({
        eventId: 'evt-host-test',
        headline: 'Emergency Weather Notice',
        body: 'Heavy rainfall in Downtown Arts Corridor',
        tone: 'urgent',
        isPublished: true,
      });

      const broadcasts = getHostBroadcasts('evt-host-test', false);
      expect(broadcasts.length).toBeGreaterThan(0);
      const urgentBroadcast = broadcasts.find((b) => b.tone === 'urgent');
      expect(urgentBroadcast).toBeDefined();
      expect(urgentBroadcast?.headline).toBe('Emergency Weather Notice');
    });

    it('should retrieve spectator system settings and frozen reason', () => {
      toggleSpectatorSystemFreeze('evt-settings-test', true, 'Maintenance Window');

      const settings = getSpectatorSystemSettings('evt-settings-test');
      expect(settings.isSpectatorSystemDisabled).toBe(true);
      expect(settings.disabledReason).toBe('Maintenance Window');
    });
  });

  describe('8. Phase 5.2 Public /watch UI & Spectator Experience Integrations', () => {
    it('1. Spectator API responds to public anonymous GET requests without credentials', async () => {
      const { GET } = await import('../app/api/game/spectator/route');

      const req = new Request('http://localhost:3000/api/game/spectator?action=events');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.events)).toBe(true);
    });

    it('2. Public audience event payload does not expose internal administrative metadata or secrets', async () => {
      const { event } = createAudienceEvent({
        eventId: 'evt-public-test',
        title: 'Public Modifier Selection',
        eventType: 'world_event',
        options: [{ label: 'Double Points Zone' }, { label: 'Speed Clue Drop' }],
      });

      const publicEvents = getAudienceEvents('evt-public-test', false);
      const target = publicEvents.find((e) => e.id === event.id);

      expect(target).toBeDefined();
      expect((target as any).createdBy).toBeUndefined();
      expect((target as any).resolvedBy).toBeUndefined();
      expect((target as any).internalNotes).toBeUndefined();
    });

    it('3. Options endpoint returns sanitized labels and descriptions without server effect payloads', async () => {
      const { GET } = await import('../app/api/game/spectator/route');
      const { event } = createAudienceEvent({
        eventId: 'evt-opts-test',
        title: 'Choose Destination',
        eventType: 'audience_vote',
        options: [
          { label: 'Centennial Plaza', description: 'Central gathering spot' },
          { label: '4th Street Murals', description: 'Arts district showcase' },
        ],
      });

      const req = new Request(`http://localhost:3000/api/game/spectator?action=options&audienceEventId=${event.id}`);
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.options.length).toBe(2);
      data.options.forEach((opt: any) => {
        expect(opt.optionLabel).toBeDefined();
        expect(opt.effectPayload).toBeUndefined();
      });
    });

    it('4. Cancelled audience event is safely removed from active public voting queue while retained for Game Master audits', () => {
      const { event } = createAudienceEvent({
        eventId: 'evt-cancelled-test',
        title: 'Contested Choice',
        eventType: 'audience_vote',
        options: [{ label: 'Path A' }, { label: 'Path B' }],
      });

      // Update status to cancelled in store
      event.status = 'cancelled';

      const publicEvents = getAudienceEvents('evt-cancelled-test', false) as import('../lib/types').PublicAudienceEvent[];
      const publicEvt = publicEvents.find((e) => e.id === event.id);
      expect(publicEvt).toBeUndefined();

      const adminEvents = getAudienceEvents('evt-cancelled-test', true);
      const adminEvt = adminEvents.find((e) => e.id === event.id);
      expect(adminEvt?.status).toBe('cancelled');
    });

    it('5. Overridden audience event indicates manual resolution for audience visibility', () => {
      const { event, options } = createAudienceEvent({
        eventId: 'evt-override-test',
        title: 'Split Decision',
        eventType: 'audience_vote',
        options: [{ label: 'Option Alpha' }, { label: 'Option Beta' }],
      });

      // Simulate GM override
      event.status = 'resolved';
      event.isManuallyOverridden = true;
      event.overrideReason = 'Game Master balance adjustment';
      event.winningOptionId = options[1].id;

      const publicEvents = getAudienceEvents('evt-override-test', false) as import('../lib/types').PublicAudienceEvent[];
      const publicEvt = publicEvents.find((e) => e.id === event.id);

      expect(publicEvt?.status).toBe('resolved');
      expect(publicEvt?.publicWinningOptionId).toBe(options[1].id);
    });

    it('6. Client source files never reference service-role keys or privileged credentials', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const clientFiles = [
        'app/watch/page.tsx',
        'components/spectator/AudienceVoteCard.tsx',
        'components/spectator/HostBroadcastCard.tsx',
        'components/spectator/PublicGameFeed.tsx',
        'components/spectator/DistrictActivityView.tsx',
        'components/spectator/CommunityStatsBar.tsx',
        'components/spectator/EnterGameModal.tsx',
      ];

      for (const relPath of clientFiles) {
        const fullPath = path.resolve(process.cwd(), relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(content).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
          expect(content).not.toContain('supabaseAdmin');
          expect(content).not.toContain('service_role');
        }
      }
    });

    it('7. Real spectator conversion flow points to live quest board (/quests)', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const modalPath = path.resolve(process.cwd(), 'components/spectator/EnterGameModal.tsx');
      const content = fs.readFileSync(modalPath, 'utf8');

      expect(content).toContain("router.push('/quests')");
    });
  });
});
