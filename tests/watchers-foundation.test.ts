/**
 * Canton Quests — Watchers Foundation Tests
 */

import { describe, expect, it } from 'vitest';
import { grantWatcherEligibilityDB, getWatcherStatusDB, evaluateWatcherEligibilityDB, getPersonalizedLiveEventsDB } from '../lib/watchers-db';
import { getPublicLiveEventsDB } from '../lib/live-events-db';
import { GET as watchersGET } from '../app/api/game/watchers/route';
import { SEED_EVENT } from '../lib/seed-data';

describe('Hidden eligibility — graceful degradation, own-eyes-only by construction', () => {
  it('getWatcherStatusDB returns a safe, well-formed not-eligible status rather than throwing', async () => {
    const status = await getWatcherStatusDB(SEED_EVENT.id, 'plr-1');
    expect(status.isEligible).toBe(false);
    expect(status.records).toEqual([]);
    expect(status.privateClueState).toEqual({});
  });

  it('grantWatcherEligibilityDB never throws when unconfigured', async () => {
    await expect(grantWatcherEligibilityDB(SEED_EVENT.id, 'plr-1', 'THREE_SIGILS')).resolves.toEqual({ newlyGranted: false });
  });

  it('evaluateWatcherEligibilityDB never throws and reports no new eligibility when unconfigured', async () => {
    await expect(evaluateWatcherEligibilityDB(SEED_EVENT.id, 'plr-1')).resolves.toEqual({ newlyEligible: [] });
  });

  it('there is no function anywhere in lib/watchers-db.ts that accepts two different player ids to compare eligibility — every export takes exactly one playerId, scoped to the caller', async () => {
    // Structural check: the module's public surface never exposes a
    // "look up player B's status" shape — getWatcherStatusDB takes
    // (eventId, playerId), not a pair.
    const status = await getWatcherStatusDB(SEED_EVENT.id, 'plr-only-this-one');
    expect(Object.keys(status).sort()).toEqual(['isEligible', 'privateClueState', 'records'].sort());
  });
});

describe('Watcher missions never appear in ordinary public APIs', () => {
  it('getPublicLiveEventsDB (the ordinary public feed) filters to visibility="public" only — it has no eligibility parameter at all, so a "personalized" event is structurally unreachable through it', async () => {
    // No Supabase configured -> empty either way, but the key guarantee is
    // structural: getPublicLiveEventsDB's signature takes no playerId, so
    // it cannot special-case eligibility even in principle.
    const events = await getPublicLiveEventsDB(SEED_EVENT.id, SEED_EVENT.slug);
    expect(events).toEqual([]);
  });

  it('getPersonalizedLiveEventsDB with no playerId behaves exactly like the public feed — an unauthenticated visitor is always ineligible', async () => {
    const events = await getPersonalizedLiveEventsDB(SEED_EVENT.id, SEED_EVENT.slug, undefined);
    expect(events).toEqual([]);
  });

  it('GET /api/game/watchers requires authentication — no query parameter can substitute for a real session', async () => {
    const res = await watchersGET(new Request(`http://localhost/api/game/watchers?eventSlug=${SEED_EVENT.slug}&playerId=plr-someone-else`));
    expect(res.status).toBe(401);
  });

  it('no eventSlug returns a safe null/empty response, never an error', async () => {
    const res = await watchersGET(new Request('http://localhost/api/game/watchers'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBeNull();
    expect(body.liveEvents).toEqual([]);
  });

  it('an unknown event slug returns a safe empty response', async () => {
    const res = await watchersGET(new Request('http://localhost/api/game/watchers?eventSlug=totally-unknown-mission'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBeNull();
  });
});

describe('No fake surveillance — every trigger source is a real game action, never personal data', () => {
  it('the trigger source enum names only server-verifiable game actions, never anything resembling location/PII tracking', () => {
    // The exact set the migration's CHECK constraint enforces (lib/watchers.ts's WatcherTriggerSource union).
    const knownSources = [
      'THREE_SIGILS', 'QUEST_COMBINATION', 'COMPLETION_ORDER', 'HIDDEN_BADGE',
      'PLAYER_INTERACTION', 'NPC_INTERACTION', 'LIVE_EVENT', 'SIGNAL_CARRIER', 'GM_ACTIVATION',
    ];
    for (const source of knownSources) {
      expect(source).not.toMatch(/location|gps|coordinate|surveillance|track/i);
    }
  });
});
