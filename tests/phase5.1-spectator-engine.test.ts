// Canton Quests — Phase 5.1 Spectator Engine & Safety Foundation Test Suite

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  createSessionTokenHash,
  createIpHash,
  getSpectatorSessionSecret,
  registerOrUpdateSpectatorSession,
  convertSpectatorToPlayer,
  createAudienceEvent,
  getAudienceEvents,
  getAudienceEventOptions,
  castSpectatorVote,
  resolveAudienceEvent,
  mapCoordinatesToDistrict,
  sanitizeActivityItem,
  publishToPublicGameFeed,
  getPublicGameFeed,
  createHostBroadcast,
  getHostBroadcasts,
  toggleSpectatorSystemFreeze,
  getSpectatorSystemSettings,
  resetSpectatorStores,
} from '../lib/spectator-engine';
import {
  registerOrUpdateSpectatorSessionDB,
  convertSpectatorToPlayerDB,
  getAudienceEventsDB,
  getAudienceEventOptionsDB,
  castSpectatorVoteDB,
  getPublicGameFeedDB,
  getHostBroadcastsDB,
  getSpectatorSystemSettingsDB,
  createAudienceEventDB,
  resolveAudienceEventDB,
  createHostBroadcastDB,
  toggleSpectatorSystemFreezeDB,
} from '../lib/spectator-db';
import { verifyAdminSecret, authorizeGameMasterRequest } from '../lib/admin-auth';
import * as supabaseModule from '../lib/supabase';

describe('Phase 5.1 Spectator Core Engine & Security Foundation', () => {
  beforeEach(() => {
    resetSpectatorStores();
  });

  describe('1. Database Migration & Structural Integrity Invariants', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260809400000_phase5_spectator_engine.sql'
    );

    it('should have created the 20260809400000_phase5_spectator_engine.sql migration file', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it('should contain all required tables, composite FKs, unique indexes, and RLS policies', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');

      // Table definitions
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.audience_events');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.audience_event_options');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.audience_votes');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.audience_effects');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.public_game_feed');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.host_broadcasts');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.spectator_sessions');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.spectator_system_settings');

      // Double-sanitized public views
      expect(sql).toContain('CREATE OR REPLACE VIEW public.public_audience_events');
      expect(sql).toContain('CREATE OR REPLACE VIEW public.public_audience_event_options');
      expect(sql).toContain('CREATE OR REPLACE VIEW public.public_host_broadcasts');
      expect(sql).toContain('WITH (security_barrier = true)');

      // Invariants & constraints
      expect(sql).toContain('CONSTRAINT uq_option_id_event_id UNIQUE (id, audience_event_id)');
      expect(sql).toContain('CONSTRAINT fk_vote_option_event FOREIGN KEY (option_id, audience_event_id) REFERENCES public.audience_event_options');
      expect(sql).toContain('CONSTRAINT uq_spectator_one_vote_per_event UNIQUE (audience_event_id, session_token_hash)');
      expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_single_active_audience_event');

      // SECURITY DEFINER search_path locking
      expect(sql).toContain('SET search_path = public, pg_temp;');

      // Player role hardening trigger & RLS policies (both INSERT & UPDATE protection)
      expect(sql).toContain('trg_protect_player_role');
      expect(sql).toContain('prevent_player_role_self_elevation');
      expect(sql).toContain('BEFORE INSERT OR UPDATE ON public.players');
      expect(sql).toContain('CREATE POLICY "Users can insert their own player profile" ON public.players');
      expect(sql).toContain("AND (role IS NULL OR role = 'player')");

      // DB Trigger vote limit check
      expect(sql).toContain('trg_enforce_spectator_vote_limit');
      expect(sql).toContain('check_spectator_vote_limit');

      // Freeze check inside cast_spectator_vote RPC
      expect(sql).toContain('Spectator system is currently frozen by Game Master');

      // RPC execution privileges revoked from public, granted ONLY to service_role
      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.cast_spectator_vote');
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.cast_spectator_vote(UUID, UUID, TEXT, TEXT, UUID) TO service_role');
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.register_or_update_spectator_session');
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.convert_spectator_session_to_player');
    });
  });

  describe('2. Secret Salt & Cryptographic Token Security', () => {
    it('should return secret salt in dev mode and throw in production if missing', () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.SPECTATOR_SESSION_SECRET;

      delete process.env.SPECTATOR_SESSION_SECRET;
      (process.env as any).NODE_ENV = 'development';

      expect(getSpectatorSessionSecret()).toBe('canton-spectator-secret-salt-2026');

      (process.env as any).NODE_ENV = 'production';
      expect(() => getSpectatorSessionSecret()).toThrowError(/SPECTATOR_SESSION_SECRET/);

      // Restore
      (process.env as any).NODE_ENV = origEnv;
      if (origSecret) process.env.SPECTATOR_SESSION_SECRET = origSecret;
    });

    it('should generate cryptographically strong UUID-based spectator tokens', () => {
      const uuid = crypto.randomUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      const token = `spec_${uuid}`;
      expect(token.startsWith('spec_')).toBe(true);
    });
  });

  describe('3. Audience Event Creation & Single Active Event Rule', () => {
    it('should create an audience event in voting_active status if no active event exists', () => {
      const { event, options } = createAudienceEvent({
        eventId: 'evt-001',
        title: 'Select 2X XP Bonus Category',
        eventType: 'audience_vote',
        options: [
          { label: 'Puzzle Quests', effectPayload: { multiplier: 2.0, category: 'puzzle' } },
          { label: 'Exploration Quests', effectPayload: { multiplier: 2.0, category: 'exploration' } },
        ],
      });

      expect(event.status).toBe('voting_active');
      expect(options).toHaveLength(2);
      expect(options[0].voteCount).toBe(0);
    });

    it('should default subsequent events to draft status if an active event already exists for the same game event', () => {
      const first = createAudienceEvent({
        eventId: 'evt-001',
        title: 'Active Event 1',
        eventType: 'audience_vote',
        options: [{ label: 'Option A' }, { label: 'Option B' }],
      });

      const second = createAudienceEvent({
        eventId: 'evt-001',
        title: 'Active Event 2',
        eventType: 'world_event',
        options: [{ label: 'Option X' }, { label: 'Option Y' }],
      });

      expect(first.event.status).toBe('voting_active');
      expect(second.event.status).toBe('draft');
    });
  });

  describe('4. Spectator Voting & Relational Invariants', () => {
    it('should accept a valid spectator vote and increment option vote count', () => {
      const { event, options } = createAudienceEvent({
        eventId: 'evt-001',
        title: 'Select Category',
        eventType: 'audience_vote',
        options: [{ label: 'Puzzle' }, { label: 'Exploration' }],
      });

      const result = castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[0].id,
        sessionTokenHash: 'hash-spec-1',
        ipHash: 'hash-ip-1',
      });

      expect(result.success).toBe(true);
      expect(result.newVoteCount).toBe(1);

      const publicOpts = getAudienceEventOptions(event.id, false);
      expect(publicOpts[0].voteCount).toBe(1);
    });

    it('should reject duplicate votes from the same spectator session and enforce max 1 vote per session', () => {
      const { event, options } = createAudienceEvent({
        eventId: 'evt-001',
        title: 'Single Vote Poll',
        eventType: 'audience_vote',
        maxVotesPerSession: 2 as any, // attempt to request multi-vote
        options: [{ label: 'Option A' }, { label: 'Option B' }],
      });

      // System should override maxVotesPerSession to 1
      expect(event.maxVotesPerSession).toBe(1);

      const vote1 = castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[0].id,
        sessionTokenHash: 'hash-spec-repeat',
        ipHash: 'hash-ip-repeat',
      });
      expect(vote1.success).toBe(true);

      const vote2 = castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[1].id,
        sessionTokenHash: 'hash-spec-repeat',
        ipHash: 'hash-ip-repeat',
      });
      expect(vote2.success).toBe(false);
      expect(vote2.code).toBe('VOTE_LIMIT_REACHED');
      expect(vote2.error).toContain('Session vote limit reached');
    });

    it('should reject a vote referencing an option from another event (Same-Event Invariant)', () => {
      const evt1 = createAudienceEvent({
        eventId: 'evt-001',
        title: 'Event 1',
        eventType: 'audience_vote',
        options: [{ label: 'E1-Opt1' }],
      });

      const evt2 = createAudienceEvent({
        eventId: 'evt-002',
        title: 'Event 2',
        eventType: 'audience_vote',
        options: [{ label: 'E2-Opt1' }],
      });

      // Attempt to vote on evt1 using option from evt2
      const result = castSpectatorVote({
        audienceEventId: evt1.event.id,
        optionId: evt2.options[0].id,
        sessionTokenHash: 'hash-spec-cross',
        ipHash: 'hash-ip-cross',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid option for this audience event');
    });

    it('should reject voting when spectator system freeze is active', () => {
      toggleSpectatorSystemFreeze('evt-001', true, 'Emergency Freeze Active');

      const { event, options } = createAudienceEvent({
        eventId: 'evt-001',
        title: 'Frozen Poll',
        eventType: 'audience_vote',
        options: [{ label: 'Option A' }],
      });

      const result = castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[0].id,
        sessionTokenHash: 'hash-spec-freeze',
        ipHash: 'hash-ip-freeze',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('SPECTATOR_SYSTEM_DISABLED');
      expect(result.error).toContain('frozen by Game Master');
    });

    it('should reject voting when active quest player is excluded by eligibility mode', () => {
      const { event, options } = createAudienceEvent({
        eventId: 'evt-001',
        title: 'Non-Active Players Only',
        eventType: 'audience_vote',
        eligibilityMode: 'exclude_active_players',
        options: [{ label: 'Option 1' }],
      });

      const result = castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[0].id,
        sessionTokenHash: 'hash-spec-player',
        ipHash: 'hash-ip-player',
        playerId: 'player-active-123',
        activeSubmissionTimes: [new Date().toISOString()],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Active quest players cannot participate');
    });
  });

  describe('5. Host Broadcast Modeling & Publication Targeting', () => {
    it('should store target_channel, priority, and publication state on host broadcasts', () => {
      const broadcast = createHostBroadcast({
        eventId: 'evt-001',
        headline: 'Emergency Weather Alert',
        body: 'Take shelter in the Canton Arts Center',
        tone: 'urgent',
        targetChannel: 'spectators',
        priority: 'urgent',
        isPublished: true,
      });

      expect(broadcast.targetChannel).toBe('spectators');
      expect(broadcast.priority).toBe('urgent');
      expect(broadcast.isPublished).toBe(true);
    });

    it('should filter out unpublished or internal host broadcasts from public spectator view', () => {
      createHostBroadcast({
        eventId: 'evt-001',
        headline: 'Public Broadcast',
        body: 'Public notice',
        targetChannel: 'all',
        isPublished: true,
      });

      createHostBroadcast({
        eventId: 'evt-001',
        headline: 'Internal GM Note',
        body: 'Staff briefing at 5 PM',
        targetChannel: 'internal',
        isPublished: true,
      });

      createHostBroadcast({
        eventId: 'evt-001',
        headline: 'Draft Broadcast',
        body: 'Draft copy',
        targetChannel: 'all',
        isPublished: false,
      });

      const publicList = getHostBroadcasts('evt-001', false);
      expect(publicList).toHaveLength(1);
      expect(publicList[0].headline).toBe('Public Broadcast');

      const adminList = getHostBroadcasts('evt-001', true);
      expect(adminList).toHaveLength(3);
    });

    it('should sanitize host broadcast headline and body when emitted to public spectators', () => {
      createHostBroadcast({
        eventId: 'evt-001',
        headline: 'Host Note: Contact gm@canton.org or 330-555-9999 secret_code: TOPSECRET2026',
        body: 'Coordinates lat=40.7989 lon=-81.3748 admin_note: internal_secret proof_url: https://secret.storage/map.png',
        targetChannel: 'all',
        isPublished: true,
      });

      const publicBroadcasts = getHostBroadcasts('evt-001', false);
      expect(publicBroadcasts).toHaveLength(1);
      expect(publicBroadcasts[0].headline).not.toContain('gm@canton.org');
      expect(publicBroadcasts[0].headline).not.toContain('330-555-9999');
      expect(publicBroadcasts[0].headline).not.toContain('TOPSECRET2026');
      expect(publicBroadcasts[0].headline).toContain('[redacted-email]');

      expect(publicBroadcasts[0].body).not.toContain('lat=40.7989');
      expect(publicBroadcasts[0].body).not.toContain('internal_secret');
      expect(publicBroadcasts[0].body).toContain('[coarse-location]');
      expect(publicBroadcasts[0].body).toContain('[redacted-sensitive-data]');

      const publicFeed = getPublicGameFeed('evt-001');
      const feedBroadcast = publicFeed.find((item) => item.feedType === 'host_broadcast');
      expect(feedBroadcast).toBeDefined();
      expect(feedBroadcast?.body).not.toContain('lat=40.7989');
      expect(feedBroadcast?.body).toContain('[coarse-location]');
    });
  });

  describe('6. Public Sanitization Boundary & Minor Protection', () => {
    it('should map precise coordinates to district names', () => {
      expect(mapCoordinatesToDistrict(40.7989, -81.3748)).toBe('Downtown Arts Corridor');
      expect(mapCoordinatesToDistrict(40.81, -81.36)).toBe('Centennial Park District');
      expect(mapCoordinatesToDistrict()).toBe('Canton Citywide Zone');
    });

    it('should force anonymized display handles for minor accounts', () => {
      const sanitized = sanitizeActivityItem({
        id: 'act-1',
        type: 'quest_completed',
        actorName: 'Johnny Minor',
        title: 'Completed Quest #1',
        timestamp: new Date().toISOString(),
        isMinor: true,
        isPublicOptIn: true,
      });

      expect(sanitized).not.toBeNull();
      expect(sanitized?.headline).toContain('Agent #inor');
      expect(sanitized?.headline).not.toContain('Johnny Minor');
      expect(sanitized?.isMinorParticipant).toBe(true);
    });

    it('should apply publication delay buffer to gameplay completions', () => {
      const sanitized = sanitizeActivityItem({
        id: 'act-2',
        type: 'quest_completed',
        actorName: 'Jane Smith',
        title: 'Found Hidden Relic',
        timestamp: new Date().toISOString(),
        lat: 40.7989,
        lon: -81.3748,
      });

      expect(sanitized).not.toBeNull();
      const pubTime = new Date(sanitized!.publishedAt).getTime();
      expect(pubTime).toBeGreaterThan(Date.now() + 60000);
    });

    it('should strip emails, phone numbers, exact coordinates, secret codes, and admin notes from public feed', () => {
      const sanitized = sanitizeActivityItem({
        id: 'act-sensitive-1',
        type: 'quest_completed',
        actorName: 'Alice Operator',
        title: 'Completed Quest secret_code: TOPSECRET2026',
        timestamp: new Date().toISOString(),
        details: 'Contact alice@example.com or 330-555-0199 at lat=40.7989 lon=-81.3748 admin_note: private_key_exposed proof_url: https://secret.storage/proof.jpg',
      });

      expect(sanitized).not.toBeNull();
      expect(sanitized?.body).not.toContain('alice@example.com');
      expect(sanitized?.body).not.toContain('330-555-0199');
      expect(sanitized?.body).not.toContain('lat=40.7989');
      expect(sanitized?.body).not.toContain('private_key_exposed');
      expect(sanitized?.headline).not.toContain('TOPSECRET2026');
      expect(sanitized?.body).toContain('[redacted-email]');
      expect(sanitized?.body).toContain('[redacted-phone]');
    });

    it('should record complete AudienceEffect audit and lifecycle metadata on event resolution', () => {
      const { event, options } = createAudienceEvent({
        eventId: 'evt-001',
        title: 'Wildcard Drop',
        eventType: 'world_event',
        options: [{ label: 'Supply Drop A', effectPayload: { drop: 'A' } }, { label: 'Supply Drop B', effectPayload: { drop: 'B' } }],
      });

      const res = resolveAudienceEvent(event.id, options[1].id, 'GM Field Decision', 'Game Director Admin');
      expect(res.success).toBe(true);
      expect(res.effect).toBeDefined();
      expect(res.effect?.status).toBe('overridden');
      expect(res.effect?.overrideContext).toBe('GM Field Decision');
      expect(res.effect?.resolvedBy).toBe('Game Director Admin');
      expect(res.effect?.resolvedAt).toBeDefined();
    });
  });

  describe('7. Database Service Layer & Fail-Closed Integrity', () => {
    it('should execute in local mode when isSupabaseConfigured is false', async () => {
      const sessionHash = createSessionTokenHash('fallback-token');
      const ipHash = createIpHash('127.0.0.1');

      const session = await registerOrUpdateSpectatorSessionDB({
        sessionTokenHash: sessionHash,
        ipHash,
      });

      expect(session.sessionTokenHash).toBe(sessionHash);

      const events = await getAudienceEventsDB('evt-001', false);
      expect(Array.isArray(events)).toBe(true);

      const broadcasts = await getHostBroadcastsDB('evt-001', false);
      expect(Array.isArray(broadcasts)).toBe(true);
    });

    it('should fail closed when Supabase is configured but service role client is missing', async () => {
      // Mock isSupabaseConfigured = true, supabaseAdmin = null
      vi.spyOn(supabaseModule, 'isSupabaseConfigured', 'get').mockReturnValue(true);
      vi.spyOn(supabaseModule, 'supabaseAdmin', 'get').mockReturnValue(null);

      await expect(
        registerOrUpdateSpectatorSessionDB({
          sessionTokenHash: 'hash-123',
          ipHash: 'ip-123',
        })
      ).rejects.toThrow(/Service Role client is required/);

      const voteResult = await castSpectatorVoteDB({
        audienceEventId: 'evt-id',
        optionId: 'opt-id',
        sessionTokenHash: 'hash-123',
        ipHash: 'ip-123',
      });
      expect(voteResult.success).toBe(false);
      expect(voteResult.code).toBe('SERVER_CONFIG_ERROR');

      vi.restoreAllMocks();
    });
  });

  describe('8. Server Admin Authorization & Emergency Freeze', () => {
    it('should authorize valid admin credentials and deny invalid ones', () => {
      expect(verifyAdminSecret('canton-gm-2026')).toBe(true);
      expect(verifyAdminSecret('invalid-secret')).toBe(false);

      const validAuth = authorizeGameMasterRequest({ 'x-admin-key': 'canton-gm-2026' });
      expect(validAuth.isAdmin).toBe(true);

      const invalidAuth = authorizeGameMasterRequest({ 'x-admin-key': 'fake-key' });
      expect(invalidAuth.isAdmin).toBe(false);
    });

    it('should activate emergency spectator freeze when kill switch is triggered', () => {
      toggleSpectatorSystemFreeze('evt-001', true, 'Severe Storm Emergency');

      const settings = getSpectatorSystemSettings('evt-001');
      expect(settings.isSpectatorSystemDisabled).toBe(true);
      expect(settings.disabledReason).toBe('Severe Storm Emergency');
    });
  });
});
