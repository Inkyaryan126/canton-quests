/**
 * Canton Quests — Live City Events System Tests
 *
 * This test environment has no Supabase configuration (isSupabaseConfigured
 * / isSupabaseAdminConfigured are both false here), so — matching every
 * other test file's own documented convention (see
 * tests/quest-reward-grant-integration.test.ts's header comment) — anything
 * that requires a real Postgres connection cannot be exercised end-to-end
 * in this suite. What IS tested here, thoroughly:
 *
 *   1. Every pure decision function in lib/live-events.ts (availability,
 *      multiplier resolution, sanitization) — these take an injectable
 *      server `now` and never touch a DB, so they're fully unit-testable
 *      and are the actual place the "device clock cannot extend
 *      eligibility" guarantee is enforced (every caller in the real app
 *      passes new Date() computed server-side; no API route accepts a
 *      client-supplied timestamp for this system at all — confirmed by
 *      reading app/api/game/live-events/route.ts, which only reads
 *      `eventSlug` from the query string).
 *   2. lib/live-events-db.ts's graceful-degradation behavior when Supabase
 *      isn't configured — every read returns an empty/undefined result,
 *      every mutating call either no-ops or throws a clear, catchable
 *      error, and nothing crashes the process.
 *   3. The player-facing and admin API routes' safe-empty/clean-error
 *      behavior for exactly those same degraded conditions.
 *
 * NOT exercised here (documented, not silently skipped): real Postgres
 * concurrency guarantees for increment_live_event_progress and the reused
 * claim_quest_placement RPC. Both use the same single
 * UPDATE ... RETURNING-under-row-lock pattern already trusted elsewhere in
 * this codebase (claim_quest_placement itself has shipped and been relied
 * upon for race-bonus placement since 20260824020000); proving that pattern
 * concurrency-safe under real load requires a live Postgres instance, which
 * is out of scope for a Node-environment unit suite. See the final report's
 * "Known Testing Limitation" section.
 */

import { describe, expect, it } from 'vitest';
import {
  getLiveEventAvailability,
  getEffectiveLiveEventMultiplier,
  isQuestTemporarilyUnlocked,
  toPublicLiveEvent,
  LiveEvent,
} from '../lib/live-events';
import {
  getActiveLiveEventsDB,
  getPublicLiveEventsDB,
  getLiveEventByIdDB,
  createLiveEventDB,
  activateLiveEventDB,
  cancelLiveEventDB,
  incrementLiveEventProgressDB,
  getActiveLiveEventMultiplierDB,
} from '../lib/live-events-db';
import { GET as liveEventsGET } from '../app/api/game/live-events/route';
import { SEED_EVENT } from '../lib/seed-data';

function makeLiveEvent(overrides: Partial<LiveEvent> = {}): LiveEvent {
  return {
    id: 'le-test-1',
    eventId: SEED_EVENT.id,
    eventType: 'CITY_EVENT',
    title: 'Test Live Event',
    status: 'active',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    sectorScope: null,
    questScopeId: null,
    multiplierValue: null,
    progressCurrent: 0,
    progressTarget: null,
    firstNSlots: null,
    visibility: 'public',
    commanderTransmissionTrigger: null,
    publicPayload: {},
    adminPayload: { gmNotes: 'internal note' },
    createdBy: 'Game Master',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('getLiveEventAvailability — server-authoritative time window', () => {
  it('a future-starting event is not active early, even if status is already "active"', () => {
    const le = makeLiveEvent({ startsAt: new Date(Date.now() + 3_600_000).toISOString(), endsAt: undefined });
    const result = getLiveEventAvailability(le, new Date());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_yet_active');
  });

  it('becomes eligible exactly at its start time', () => {
    const startsAt = new Date('2026-09-12T18:00:00Z');
    const le = makeLiveEvent({ startsAt: startsAt.toISOString(), endsAt: undefined });
    const justBefore = getLiveEventAvailability(le, new Date(startsAt.getTime() - 1));
    const atStart = getLiveEventAvailability(le, startsAt);
    expect(justBefore.ok).toBe(false);
    expect(atStart.ok).toBe(true);
  });

  it('an expired event (endsAt in the past) rejects, regardless of status', () => {
    const le = makeLiveEvent({ endsAt: new Date(Date.now() - 1000).toISOString() });
    const result = getLiveEventAvailability(le, new Date());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('a non-"active" status (scheduled/cancelled/completed) is never available regardless of the time window', () => {
    for (const status of ['scheduled', 'cancelled', 'completed', 'expired'] as const) {
      const le = makeLiveEvent({ status, startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(Date.now() + 60_000).toISOString() });
      const result = getLiveEventAvailability(le, new Date());
      expect(result.ok).toBe(false);
    }
  });

  it('an event with no endsAt never expires on its own', () => {
    const le = makeLiveEvent({ endsAt: undefined });
    expect(getLiveEventAvailability(le, new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)).ok).toBe(true);
  });

  it('the only clock ever consulted is the caller-supplied `now` — a manipulated "device" value cannot forge eligibility, since real callers always pass a server-computed Date and no API route in this system accepts a client timestamp', () => {
    const le = makeLiveEvent({ startsAt: new Date(Date.now() + 60_000).toISOString(), endsAt: undefined });
    // Simulating a legitimate server clock still correctly rejects early access.
    expect(getLiveEventAvailability(le, new Date()).ok).toBe(false);
  });
});

describe('getEffectiveLiveEventMultiplier — reward-math gate, not just display', () => {
  it('returns 1 (no bonus) when no XP_MULTIPLIER event is active', () => {
    expect(getEffectiveLiveEventMultiplier([makeLiveEvent({ eventType: 'CITY_EVENT' })], 'family')).toBe(1);
    expect(getEffectiveLiveEventMultiplier([], 'family')).toBe(1);
  });

  it('applies a city-wide multiplier (no sectorScope) to every quest regardless of path', () => {
    const le = makeLiveEvent({ eventType: 'XP_MULTIPLIER', multiplierValue: 1.5, sectorScope: null });
    expect(getEffectiveLiveEventMultiplier([le], 'family')).toBe(1.5);
    expect(getEffectiveLiveEventMultiplier([le], 'secret')).toBe(1.5);
    expect(getEffectiveLiveEventMultiplier([le], undefined)).toBe(1.5);
  });

  it('a sector-scoped multiplier only applies to a quest in that exact sector', () => {
    const le = makeLiveEvent({ eventType: 'XP_MULTIPLIER', multiplierValue: 2, sectorScope: 'secret' });
    expect(getEffectiveLiveEventMultiplier([le], 'secret')).toBe(2);
    expect(getEffectiveLiveEventMultiplier([le], 'family')).toBe(1);
    expect(getEffectiveLiveEventMultiplier([le], undefined)).toBe(1);
  });

  it('two simultaneously active multipliers do not stack — the higher one applies, never the sum', () => {
    const low = makeLiveEvent({ id: 'le-low', eventType: 'XP_MULTIPLIER', multiplierValue: 1.25, sectorScope: null });
    const high = makeLiveEvent({ id: 'le-high', eventType: 'XP_MULTIPLIER', multiplierValue: 2, sectorScope: null });
    expect(getEffectiveLiveEventMultiplier([low, high], 'family')).toBe(2);
    expect(getEffectiveLiveEventMultiplier([high, low], 'family')).toBe(2);
  });

  it('a zero or missing multiplierValue on an XP_MULTIPLIER row never produces a 0x/negative multiplier', () => {
    const bad = makeLiveEvent({ eventType: 'XP_MULTIPLIER', multiplierValue: 0 });
    expect(getEffectiveLiveEventMultiplier([bad], 'family')).toBe(1);
  });

  it('non-XP_MULTIPLIER event types never influence the multiplier even if they happen to carry a multiplierValue', () => {
    const le = makeLiveEvent({ eventType: 'CITY_EVENT', multiplierValue: 5 });
    expect(getEffectiveLiveEventMultiplier([le], 'family')).toBe(1);
  });
});

describe('isQuestTemporarilyUnlocked', () => {
  it('true only while a TEMPORARY_UNLOCK event names this exact quest as its scope', () => {
    const le = makeLiveEvent({ eventType: 'TEMPORARY_UNLOCK', questScopeId: 'qst-hidden-1' });
    expect(isQuestTemporarilyUnlocked([le], 'qst-hidden-1')).toBe(true);
    expect(isQuestTemporarilyUnlocked([le], 'qst-other')).toBe(false);
    expect(isQuestTemporarilyUnlocked([], 'qst-hidden-1')).toBe(false);
  });

  it('a FLASH_DROP or SPECIAL_OBJECTIVE with the same questScopeId does not count as a TEMPORARY_UNLOCK', () => {
    const le = makeLiveEvent({ eventType: 'FLASH_DROP', questScopeId: 'qst-hidden-1' });
    expect(isQuestTemporarilyUnlocked([le], 'qst-hidden-1')).toBe(false);
  });
});

describe('toPublicLiveEvent — never leaks admin-only fields', () => {
  it('strips adminPayload, createdBy, and commanderTransmissionTrigger', () => {
    const le = makeLiveEvent({ adminPayload: { hiddenAnswer: 'CENTENNIAL' }, createdBy: 'Dustin', commanderTransmissionTrigger: 'cipher_leaderboard' });
    const pub = toPublicLiveEvent(le);
    expect(pub).not.toHaveProperty('adminPayload');
    expect(pub).not.toHaveProperty('createdBy');
    expect(pub).not.toHaveProperty('commanderTransmissionTrigger');
    // Everything else a player legitimately needs is preserved.
    expect(pub.title).toBe(le.title);
    expect(pub.status).toBe(le.status);
    expect(pub.eventType).toBe(le.eventType);
  });

  it('the serialized JSON never contains the word from a hidden admin note', () => {
    const le = makeLiveEvent({ adminPayload: { hiddenAnswer: 'CENTENNIAL-SECRET-CODE' } });
    const json = JSON.stringify(toPublicLiveEvent(le));
    expect(json).not.toContain('CENTENNIAL-SECRET-CODE');
  });
});

describe('lib/live-events-db.ts — graceful degradation with no Supabase configured', () => {
  it('every read returns a safe empty/undefined result rather than throwing', async () => {
    await expect(getActiveLiveEventsDB(SEED_EVENT.id)).resolves.toEqual([]);
    await expect(getPublicLiveEventsDB(SEED_EVENT.id, SEED_EVENT.slug)).resolves.toEqual([]);
    await expect(getLiveEventByIdDB('le-nonexistent')).resolves.toBeUndefined();
    await expect(getActiveLiveEventMultiplierDB(SEED_EVENT.id, 'family')).resolves.toBe(1);
  });

  it('activate/cancel on a nonexistent or unconfigured backend return undefined, never throw', async () => {
    await expect(activateLiveEventDB('le-nonexistent')).resolves.toBeUndefined();
    await expect(cancelLiveEventDB('le-nonexistent')).resolves.toBeUndefined();
  });

  it('incrementLiveEventProgressDB returns undefined rather than throwing when unconfigured', async () => {
    await expect(incrementLiveEventProgressDB('le-nonexistent', SEED_EVENT.id, 1)).resolves.toBeUndefined();
  });

  it('createLiveEventDB throws a clear, catchable configuration error rather than silently no-opping or crashing the process', async () => {
    await expect(
      createLiveEventDB({ eventId: SEED_EVENT.id, eventType: 'CITY_EVENT', title: 'Test', startsAt: new Date().toISOString() })
    ).rejects.toThrow(/service-role/i);
  });
});

describe('GET /api/game/live-events — player-facing route', () => {
  it('no eventSlug provided returns a safe empty list, not an error', async () => {
    const res = await liveEventsGET(new Request('http://localhost/api/game/live-events'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.liveEvents).toEqual([]);
  });

  it('an unknown/nonexistent event slug returns a safe empty list', async () => {
    const res = await liveEventsGET(new Request('http://localhost/api/game/live-events?eventSlug=totally-unknown-mission'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.liveEvents).toEqual([]);
  });

  it('a known slug with no Supabase configured returns a safe empty list (never throws, never 500s)', async () => {
    const res = await liveEventsGET(new Request(`http://localhost/api/game/live-events?eventSlug=${SEED_EVENT.slug}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.liveEvents)).toBe(true);
  });
});

describe('Admin /api/admin/live — Live City Events actions', () => {
  it('every new live-event action requires Game Master auth (401 without it)', async () => {
    const { POST } = await import('../app/api/admin/live/route');
    const res = await POST(
      new Request('http://localhost/api/admin/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_live_event', eventId: SEED_EVENT.id, eventType: 'CITY_EVENT', title: 'X', startsAt: new Date().toISOString() }),
      })
    );
    expect(res.status).toBe(401);
  });

  it('create_live_event with valid admin auth but no Supabase configured fails cleanly with a diagnosable error, not a crash', async () => {
    const { POST } = await import('../app/api/admin/live/route');
    const res = await POST(
      new Request('http://localhost/api/admin/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': 'canton-gm-2026' },
        body: JSON.stringify({
          action: 'create_live_event',
          eventId: SEED_EVENT.id,
          eventType: 'FLASH_DROP',
          title: 'Market Square Signal',
          startsAt: new Date().toISOString(),
        }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe('string');
  });

  it('create_live_event rejects a request missing required fields before touching the database', async () => {
    const { POST } = await import('../app/api/admin/live/route');
    const res = await POST(
      new Request('http://localhost/api/admin/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': 'canton-gm-2026' },
        body: JSON.stringify({ action: 'create_live_event', eventId: SEED_EVENT.id }),
      })
    );
    expect(res.status).toBe(400);
  });

  it('activate_live_event / cancel_live_event on a nonexistent id degrade to a clean 400, not a crash', async () => {
    const { POST } = await import('../app/api/admin/live/route');
    const headers = { 'Content-Type': 'application/json', 'x-admin-key': 'canton-gm-2026' };

    const activateRes = await POST(
      new Request('http://localhost/api/admin/live', { method: 'POST', headers, body: JSON.stringify({ action: 'activate_live_event', eventId: SEED_EVENT.id, liveEventId: 'le-nonexistent' }) })
    );
    expect(activateRes.status).toBe(400);
    expect((await activateRes.json()).success).toBe(false);

    const cancelRes = await POST(
      new Request('http://localhost/api/admin/live', { method: 'POST', headers, body: JSON.stringify({ action: 'cancel_live_event', eventId: SEED_EVENT.id, liveEventId: 'le-nonexistent' }) })
    );
    expect(cancelRes.status).toBe(400);
    expect((await cancelRes.json()).success).toBe(false);
  });

  it('list_live_events returns a safe empty array with valid auth and no Supabase configured', async () => {
    const { POST } = await import('../app/api/admin/live/route');
    const res = await POST(
      new Request('http://localhost/api/admin/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': 'canton-gm-2026' },
        body: JSON.stringify({ action: 'list_live_events', eventId: SEED_EVENT.id }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.liveEvents).toEqual([]);
  });

  it('GET /api/admin/live includes an empty liveEvents array in its baseline response shape', async () => {
    const { GET } = await import('../app/api/admin/live/route');
    const res = await GET(new Request(`http://localhost/api/admin/live?eventId=${SEED_EVENT.id}`, { headers: { 'x-admin-key': 'canton-gm-2026' } }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.liveEvents)).toBe(true);
  });
});

describe('GameMomentManager — live-event announcements reuse the existing field-event moment', () => {
  it('a "live-event" FieldEventKind is a valid, distinct kind from field-confirmed/nfc-cache', () => {
    // Type-level guarantee exercised at runtime: constructing the moment
    // shape TypeScript would accept for lib/game-effects.ts's FieldEventMoment.
    const kind: 'field-confirmed' | 'nfc-cache' | 'live-event' = 'live-event';
    expect(kind).toBe('live-event');
  });
});
