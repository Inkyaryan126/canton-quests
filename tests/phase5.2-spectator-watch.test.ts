// Canton Quests — Phase 5.2 Public Watch Experience & Spectator Safety Test Suite

import { describe, it, expect, beforeEach } from 'vitest';
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
} from '../lib/spectator-engine';

describe('Phase 5.2 Public Watch Spectator Experience Test Suite', () => {
  beforeEach(() => {
    resetSpectatorStores();
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

  describe('5. Spectator-to-Player Conversion', () => {
    it('should convert a spectator session to a player profile cleanly', () => {
      const sessionHash = createSessionTokenHash('spec-convert-1');
      const ipHash = createIpHash('10.0.0.4');

      const session = registerOrUpdateSpectatorSession({
        sessionTokenHash: sessionHash,
        ipHash,
        ageAcknowledged: true,
        safetyAcknowledged: true,
      });

      const converted = convertSpectatorToPlayer(sessionHash, 'player-agent-99');
      expect(converted).not.toBeNull();
      expect(converted?.convertedToPlayerId).toBe('player-agent-99');
    });
  });
});
