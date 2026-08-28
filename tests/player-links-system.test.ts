/**
 * Canton Quests — Player-to-Player Link System Tests
 *
 * Same testing philosophy as tests/live-city-events-system.test.ts: this
 * environment has no Supabase configured, so pure decision logic
 * (lib/player-links.ts) and graceful-degradation/safe-response behavior are
 * what's directly exercised. Real Postgres guarantees (reward_grants'
 * unique index actually preventing a concurrent double-grant, the COUNT
 * aggregate's correctness) are architecturally reused unchanged from the
 * already-shipped, already-trusted reward-granting pipeline
 * (insertRewardGrantDB) rather than re-implemented — see the Known Testing
 * Limitation note in this mission's final report.
 */

import { describe, expect, it } from 'vitest';
import {
  computePairKey,
  computeLinkRewardKey,
  validatePlayerLinkEligibility,
  toSafePlayerLinkProfile,
  PLAYER_LINK_CONFIG,
} from '../lib/player-links';
import { createPlayerLinkDB, createGroupPlayerLinkDB, getPlayerLinkStatsDB, getPlayerOwnLinksDB } from '../lib/player-links-db';
import { GET as playerLinksGET, POST as playerLinksPOST } from '../app/api/game/player-links/route';
import { SEED_EVENT } from '../lib/seed-data';

describe('Self-link blocked', () => {
  it('a player cannot link with themselves', () => {
    const result = validatePlayerLinkEligibility({
      linkType: 'PLAYER_LINK',
      initiatorId: 'plr-1',
      targetId: 'plr-1',
      initiatorInEvent: true,
      targetInEvent: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('self_link');
  });
});

describe('Cross-event blocked', () => {
  it('rejects when either player has no participation row for this event', () => {
    const bothMissing = validatePlayerLinkEligibility({ linkType: 'PLAYER_LINK', initiatorId: 'plr-1', targetId: 'plr-2', initiatorInEvent: false, targetInEvent: false });
    const targetMissing = validatePlayerLinkEligibility({ linkType: 'PLAYER_LINK', initiatorId: 'plr-1', targetId: 'plr-2', initiatorInEvent: true, targetInEvent: false });
    const initiatorMissing = validatePlayerLinkEligibility({ linkType: 'PLAYER_LINK', initiatorId: 'plr-1', targetId: 'plr-2', initiatorInEvent: false, targetInEvent: true });
    for (const result of [bothMissing, targetMissing, initiatorMissing]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('not_in_event');
    }
  });

  it('both-in-event with no other issue passes', () => {
    expect(validatePlayerLinkEligibility({ linkType: 'PLAYER_LINK', initiatorId: 'plr-1', targetId: 'plr-2', initiatorInEvent: true, targetInEvent: true }).ok).toBe(true);
  });
});

describe('Different-path validation', () => {
  it('DIFFERENT_PATH_LINK rejects two players on the same starting path', () => {
    const result = validatePlayerLinkEligibility({
      linkType: 'DIFFERENT_PATH_LINK', initiatorId: 'plr-1', targetId: 'plr-2',
      initiatorInEvent: true, targetInEvent: true, initiatorPath: 'family', targetPath: 'family',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_path');
  });

  it('DIFFERENT_PATH_LINK accepts two players on genuinely different paths', () => {
    const result = validatePlayerLinkEligibility({
      linkType: 'DIFFERENT_PATH_LINK', initiatorId: 'plr-1', targetId: 'plr-2',
      initiatorInEvent: true, targetInEvent: true, initiatorPath: 'family', targetPath: 'secret',
    });
    expect(result.ok).toBe(true);
  });

  it('a plain PLAYER_LINK never checks path at all, even for two same-path players', () => {
    const result = validatePlayerLinkEligibility({
      linkType: 'PLAYER_LINK', initiatorId: 'plr-1', targetId: 'plr-2',
      initiatorInEvent: true, targetInEvent: true, initiatorPath: 'secret', targetPath: 'secret',
    });
    expect(result.ok).toBe(true);
  });
});

describe('Duplicate farming blocked — pair-key symmetry is the mechanism', () => {
  it('computePairKey is order-independent, so a farmer cannot bypass the reward_grants unique index by reversing who initiates', () => {
    expect(computePairKey('plr-a', 'plr-b')).toBe(computePairKey('plr-b', 'plr-a'));
  });

  it('computeLinkRewardKey therefore also collides regardless of initiation order', () => {
    const keyAB = computeLinkRewardKey('PLAYER_LINK', computePairKey('plr-a', 'plr-b'));
    const keyBA = computeLinkRewardKey('PLAYER_LINK', computePairKey('plr-b', 'plr-a'));
    expect(keyAB).toBe(keyBA);
  });

  it('different link types for the same pair produce different reward keys — each type earns independently, once', () => {
    const pair = computePairKey('plr-a', 'plr-b');
    expect(computeLinkRewardKey('PLAYER_LINK', pair)).not.toBe(computeLinkRewardKey('RARE_PAIRING', pair));
  });

  it('different pairs never collide with each other', () => {
    expect(computeLinkRewardKey('PLAYER_LINK', computePairKey('plr-a', 'plr-b'))).not.toBe(computeLinkRewardKey('PLAYER_LINK', computePairKey('plr-a', 'plr-c')));
  });
});

describe('No PII leakage', () => {
  it('toSafePlayerLinkProfile exposes only id/displayName/path/avatarUrl — never email or any other player field', () => {
    const safe = toSafePlayerLinkProfile({
      id: 'plr-1',
      displayName: 'Agent Nova',
      selectedStartingPath: 'secret',
      avatarUrl: '⚡',
    });
    expect(Object.keys(safe).sort()).toEqual(['avatarUrl', 'displayName', 'id', 'path'].sort());
    expect(safe).not.toHaveProperty('email');
    expect(safe).not.toHaveProperty('userId');
  });

  it('GET with an unknown lookupPlayerId returns a null profile, not an error, and no partial data', async () => {
    const res = await playerLinksGET(new Request(`http://localhost/api/game/player-links?eventSlug=${SEED_EVENT.slug}&lookupPlayerId=plr-nonexistent`));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.lookupProfile).toBeNull();
  });

  it('the aggregate stats response never contains a players/link array — count only', async () => {
    const res = await playerLinksGET(new Request(`http://localhost/api/game/player-links?eventSlug=${SEED_EVENT.slug}`));
    const body = await res.json();
    expect(body.stats).toHaveProperty('totalLinks');
    expect(typeof body.stats.totalLinks).toBe('number');
    expect(Object.keys(body.stats)).toEqual(['totalLinks']);
  });
});

describe('Event scope', () => {
  it('no eventSlug returns a safe empty response, not an error', async () => {
    const res = await playerLinksGET(new Request('http://localhost/api/game/player-links'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.stats.totalLinks).toBe(0);
  });

  it('an unknown event slug returns a safe empty response', async () => {
    const res = await playerLinksGET(new Request('http://localhost/api/game/player-links?eventSlug=totally-unknown-mission'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.stats.totalLinks).toBe(0);
  });
});

describe('POST /api/game/player-links — request validation and auth', () => {
  it('rejects a missing eventSlug before touching anything else', async () => {
    const res = await playerLinksPOST(new Request('http://localhost/api/game/player-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linkType: 'PLAYER_LINK', targetPlayerId: 'plr-2' }) }));
    expect(res.status).toBe(400);
  });

  it('rejects an unrecognized linkType', async () => {
    const res = await playerLinksPOST(new Request('http://localhost/api/game/player-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventSlug: SEED_EVENT.slug, linkType: 'NOT_A_REAL_TYPE', targetPlayerId: 'plr-2' }) }));
    expect(res.status).toBe(400);
  });

  it('rejects an unauthenticated request with a clear 401, never silently linking as a guessed player', async () => {
    const res = await playerLinksPOST(new Request('http://localhost/api/game/player-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventSlug: SEED_EVENT.slug, linkType: 'PLAYER_LINK', targetPlayerId: 'plr-2' }) }));
    // No Supabase configured -> resolveAuthenticatedSession resolves no player -> 401.
    expect(res.status).toBe(401);
  });
});

describe('Graceful degradation with no Supabase configured (legitimate first link reward / concurrent duplicate safe / aggregate count correct — DB-level guarantees)', () => {
  it('createPlayerLinkDB never throws when unconfigured — returns a safe not-ok result', async () => {
    const result = await createPlayerLinkDB({ eventId: SEED_EVENT.id, linkType: 'PLAYER_LINK', initiatorId: 'plr-1', targetId: 'plr-2' });
    expect(result.newlyRewarded).toBe(false);
    expect(result.xpAwarded).toBe(0);
  });

  it('createGroupPlayerLinkDB rejects fewer than 3 distinct players before touching the database', async () => {
    const { results } = await createGroupPlayerLinkDB({ eventId: SEED_EVENT.id, initiatorId: 'plr-1', playerIds: ['plr-2'] });
    expect(results).toHaveLength(1);
    expect(results[0].eligibility.ok).toBe(false);
  });

  it('getPlayerLinkStatsDB returns a safe zero count rather than throwing', async () => {
    await expect(getPlayerLinkStatsDB(SEED_EVENT.id)).resolves.toEqual({ totalLinks: 0 });
  });

  it('getPlayerOwnLinksDB returns a safe empty list rather than throwing', async () => {
    await expect(getPlayerOwnLinksDB(SEED_EVENT.id, 'plr-1')).resolves.toEqual([]);
  });
});

describe('XP configuration sanity', () => {
  it('every link type has a positive, reasonable XP value and a label', () => {
    for (const type of Object.keys(PLAYER_LINK_CONFIG) as Array<keyof typeof PLAYER_LINK_CONFIG>) {
      expect(PLAYER_LINK_CONFIG[type].xpAwarded).toBeGreaterThan(0);
      expect(PLAYER_LINK_CONFIG[type].label.length).toBeGreaterThan(0);
    }
  });

  it('GROUP_OBJECTIVE and DIFFERENT_PATH_LINK carry their required-condition flags', () => {
    expect(PLAYER_LINK_CONFIG.GROUP_OBJECTIVE.requiresGroup).toBe(true);
    expect(PLAYER_LINK_CONFIG.DIFFERENT_PATH_LINK.requiresDifferentPath).toBe(true);
  });
});
