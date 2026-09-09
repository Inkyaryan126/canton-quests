// Canton Quests — Admin-Only Prelaunch Field Test Mode
//
// Regression coverage for a real pre-launch security gap: GET
// /api/game/events/[slug] returned the full quest list (instructions,
// reward progression) even when the event was still pre-launch, and POST
// /api/game/submit had no independent Operation-start-time check at all —
// only the public event hub page's own client-side rendering hid the
// content, which a direct API/route request bypassed entirely.
//
// The fix adds a single server-authoritative helper,
// lib/launch-status.ts's resolveFieldTestAccess, used identically by both
// endpoints: a pre-launch event withholds quest content/mutation by
// default, and the ONLY way past that before the real start time is a
// genuinely verified admin session (the existing lib/admin-auth.ts system)
// making the request with ?fieldTest=1 — the query string alone, or an
// admin session alone, does nothing on its own.

import { describe, expect, it, beforeEach } from 'vitest';
import { initializeGameEngine, resetGameEngineStore, registerPlayer } from '../lib/game-engine';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';
import { GET as eventsRoute } from '../app/api/game/events/[slug]/route';
import { POST as submitProofRoute } from '../app/api/game/submit/route';
import { resolveFieldTestAccess } from '../lib/field-test-access';

function authedRequest(url: string, userId: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer mock-jwt-${userId}`,
    },
  });
}

const VALID_ADMIN_KEY = 'canton-gm-2026';
const CHECKIN_QUEST = SEED_QUESTS.find((q) => q.eventId === SEED_EVENT.id && q.verificationType === 'checkin')!;

describe('Admin-only prelaunch field test mode', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  describe('resolveFieldTestAccess — deterministic server-authority logic', () => {
    it('a genuinely started event is never pre-launch and never field-test-active, whether or not ?fieldTest=1 or an admin session is present', () => {
      const startedEvent = { ...SEED_EVENT, startTime: '2020-01-01T00:00:00Z' };
      const plainReq = new Request('http://localhost/api/game/events/x');
      const paramReq = new Request('http://localhost/api/game/events/x?fieldTest=1');
      const adminParamReq = new Request('http://localhost/api/game/events/x?fieldTest=1', {
        headers: { 'x-admin-key': VALID_ADMIN_KEY },
      });

      for (const req of [plainReq, paramReq, adminParamReq]) {
        expect(resolveFieldTestAccess(req, startedEvent, startedEvent.slug)).toEqual({
          isPreLaunch: false,
          fieldTestActive: false,
        });
      }
    });

    it('?fieldTest=1 alone, with no admin session, does nothing during real pre-launch', () => {
      const futureEvent = { ...SEED_EVENT, startTime: '2099-01-01T00:00:00Z' };
      const req = new Request('http://localhost/api/game/events/x?fieldTest=1');
      expect(resolveFieldTestAccess(req, futureEvent, futureEvent.slug)).toEqual({
        isPreLaunch: true,
        fieldTestActive: false,
      });
    });

    it('a verified admin session with no ?fieldTest=1 does not activate field test either — both are required', () => {
      const futureEvent = { ...SEED_EVENT, startTime: '2099-01-01T00:00:00Z' };
      const req = new Request('http://localhost/api/game/events/x', {
        headers: { 'x-admin-key': VALID_ADMIN_KEY },
      });
      expect(resolveFieldTestAccess(req, futureEvent, futureEvent.slug).fieldTestActive).toBe(false);
    });

    it('an invalid admin key with ?fieldTest=1 does not activate field test', () => {
      const futureEvent = { ...SEED_EVENT, startTime: '2099-01-01T00:00:00Z' };
      const req = new Request('http://localhost/api/game/events/x?fieldTest=1', {
        headers: { 'x-admin-key': 'not-the-real-admin-key' },
      });
      expect(resolveFieldTestAccess(req, futureEvent, futureEvent.slug).fieldTestActive).toBe(false);
    });

    it('activates field test only when a verified admin session AND ?fieldTest=1 are both present during real pre-launch', () => {
      const futureEvent = { ...SEED_EVENT, startTime: '2099-01-01T00:00:00Z' };
      const req = new Request('http://localhost/api/game/events/x?fieldTest=1', {
        headers: { 'x-admin-key': VALID_ADMIN_KEY },
      });
      expect(resolveFieldTestAccess(req, futureEvent, futureEvent.slug)).toEqual({
        isPreLaunch: true,
        fieldTestActive: true,
      });
    });
  });

  describe('GET /api/game/events/[slug] — public prelaunch quest-content gate', () => {
    it('does not leak quest content, leaderboard, or reward progression for the real pre-launch Founder\'s Cipher event to a public request', async () => {
      const req = new Request(`http://localhost:3000/api/game/events/${SEED_EVENT.slug}`);
      const res = await eventsRoute(req, { params: { slug: SEED_EVENT.slug } });
      const data = await res.json();

      expect(data.isPreLaunch).toBe(true);
      expect(data.fieldTestActive).toBe(false);
      expect(data.quests).toEqual([]);
      expect(data.leaderboard).toEqual([]);
      expect(data.progress).toBeNull();
      expect(data.cipherProgress).toBeNull();
      // The event record itself (title/countdown metadata) is not secret —
      // only quest/gameplay content is withheld.
      expect(data.event?.slug).toBe(SEED_EVENT.slug);
    });

    it('?fieldTest=1 alone, with no admin session, is still a no-op — there is no public query-string bypass', async () => {
      const req = new Request(`http://localhost:3000/api/game/events/${SEED_EVENT.slug}?fieldTest=1`);
      const res = await eventsRoute(req, { params: { slug: SEED_EVENT.slug } });
      const data = await res.json();

      expect(data.isPreLaunch).toBe(true);
      expect(data.fieldTestActive).toBe(false);
      expect(data.quests).toEqual([]);
    });

    it('a verified admin session without ?fieldTest=1 still does not expose quests — the explicit opt-in is required', async () => {
      const req = new Request(`http://localhost:3000/api/game/events/${SEED_EVENT.slug}`, {
        headers: { 'x-admin-key': VALID_ADMIN_KEY },
      });
      const res = await eventsRoute(req, { params: { slug: SEED_EVENT.slug } });
      const data = await res.json();

      expect(data.fieldTestActive).toBe(false);
      expect(data.quests).toEqual([]);
    });

    it('a verified admin session + ?fieldTest=1 exposes the real launch quest roster before launch', async () => {
      const req = new Request(`http://localhost:3000/api/game/events/${SEED_EVENT.slug}?fieldTest=1`, {
        headers: { 'x-admin-key': VALID_ADMIN_KEY },
      });
      const res = await eventsRoute(req, { params: { slug: SEED_EVENT.slug } });
      const data = await res.json();

      expect(data.isPreLaunch).toBe(true);
      expect(data.fieldTestActive).toBe(true);
      expect(Array.isArray(data.quests)).toBe(true);
      expect(data.quests.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/game/submit — independent Operation-start-time enforcement', () => {
    it('rejects a real pre-launch Founder\'s Cipher submission server-side, even from a genuinely authenticated player', async () => {
      const player = registerPlayer({
        displayName: 'FieldTestGateCheck',
        email: 'fieldtest-gate-check@example.com',
        userId: 'usr-fieldtest-gate-check',
      });

      const req = authedRequest('http://localhost:3000/api/game/submit', 'usr-fieldtest-gate-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          questId: CHECKIN_QUEST.id,
          eventId: SEED_EVENT.id,
          proofType: 'checkin',
        }),
      });

      const res = await submitProofRoute(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
    });

    it('?fieldTest=1 on the submit request, with no admin session, is still rejected pre-launch', async () => {
      const player = registerPlayer({
        displayName: 'FieldTestNoAdmin',
        email: 'fieldtest-no-admin@example.com',
        userId: 'usr-fieldtest-no-admin',
      });

      const req = authedRequest('http://localhost:3000/api/game/submit?fieldTest=1', 'usr-fieldtest-no-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          questId: CHECKIN_QUEST.id,
          eventId: SEED_EVENT.id,
          proofType: 'checkin',
        }),
      });

      const res = await submitProofRoute(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
    });

    it('a verified admin field-test session lets a real authenticated player\'s submission reach the normal authoritative submission path', async () => {
      const player = registerPlayer({
        displayName: 'FieldTestAuthorized',
        email: 'fieldtest-authorized@example.com',
        userId: 'usr-fieldtest-authorized',
      });

      const req = authedRequest('http://localhost:3000/api/game/submit?fieldTest=1', 'usr-fieldtest-authorized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': VALID_ADMIN_KEY },
        body: JSON.stringify({
          playerId: player.id,
          questId: CHECKIN_QUEST.id,
          eventId: SEED_EVENT.id,
          proofType: 'checkin',
        }),
      });

      const res = await submitProofRoute(req);
      const data = await res.json();

      // Reached real submission processing — never the 403 pre-launch
      // rejection — whatever the underlying quest-verification outcome is.
      expect(res.status).not.toBe(403);
      expect(res.status).toBe(200);
      expect(data.submission?.playerId ?? player.id).toBe(player.id);
    });
  });

  describe('Friday / post-launch: normal players require no fieldTest parameter', () => {
    it('a genuinely started event exposes quests to a plain public request with no admin session and no fieldTest param at all', () => {
      const startedEvent = { ...SEED_EVENT, startTime: '2020-01-01T00:00:00Z' };
      const req = new Request('http://localhost/api/game/events/x');
      const result = resolveFieldTestAccess(req, startedEvent, startedEvent.slug);

      expect(result.isPreLaunch).toBe(false);
      expect(result.fieldTestActive).toBe(false);
    });
  });
});
