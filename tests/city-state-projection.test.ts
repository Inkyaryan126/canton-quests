/**
 * Canton Quests — Community Progress / City State Tests
 *
 * Milestone once-only/idempotent behavior is already proven by
 * tests/live-city-events-system.test.ts (increment_live_event_progress) —
 * not duplicated here. This file covers the new aggregate projection: safe
 * degradation with no Supabase configured, and the API route's safe-empty
 * responses. The real GROUP BY/aggregate correctness against live data is a
 * SQL-level guarantee (documented, not independently re-provable without a
 * live Postgres instance — same limitation noted in the two prior
 * missions).
 */

import { describe, expect, it } from 'vitest';
import { getCityStateDB } from '../lib/city-state-db';
import { GET as cityStateGET } from '../app/api/game/city-state/route';
import { SEED_EVENT } from '../lib/seed-data';

describe('getCityStateDB — graceful degradation with no Supabase configured', () => {
  it('returns a fully-shaped, all-zero projection rather than throwing', async () => {
    const state = await getCityStateDB(SEED_EVENT.id);
    expect(state.eventId).toBe(SEED_EVENT.id);
    expect(state.registeredPlayers).toBe(0);
    expect(state.activePlayers).toBe(0);
    expect(state.totalCompletedQuests).toBe(0);
    expect(state.totalPlayerLinks).toBe(0);
    expect(state.convergenceReadyPlayers).toBe(0);
    expect(state.sigilDistribution).toEqual({ oneDistrict: 0, twoDistricts: 0, threeDistricts: 0 });
  });

  it('every district has a well-formed summary even with zero data', () => {
    return getCityStateDB(SEED_EVENT.id).then((state) => {
      for (const key of ['arts', 'challenge', 'secret'] as const) {
        expect(state.districtProgress[key]).toEqual({ fractionComplete: 0, playersWithProgress: 0, playersUnlocked: 0 });
      }
    });
  });

  it('computedAt is a real, recent ISO timestamp — never a stale cached value', async () => {
    const before = Date.now();
    const state = await getCityStateDB(SEED_EVENT.id);
    const computedMs = new Date(state.computedAt).getTime();
    expect(computedMs).toBeGreaterThanOrEqual(before);
    expect(computedMs).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

describe('GET /api/game/city-state', () => {
  it('no eventSlug returns a safe null cityState, not an error', async () => {
    const res = await cityStateGET(new Request('http://localhost/api/game/city-state'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.cityState).toBeNull();
    expect(body.liveEvents ?? []).toEqual([]);
  });

  it('an unknown event slug returns a safe null cityState', async () => {
    const res = await cityStateGET(new Request('http://localhost/api/game/city-state?eventSlug=totally-unknown-mission'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.cityState).toBeNull();
  });

  it('a known slug returns the full projection shape alongside activeFlashDrop/activeCityEvent/activeMultiplier/communityMilestones fields', async () => {
    const res = await cityStateGET(new Request(`http://localhost/api/game/city-state?eventSlug=${SEED_EVENT.slug}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('cityState');
    expect(body).toHaveProperty('activeFlashDrop');
    expect(body).toHaveProperty('activeCityEvent');
    expect(body).toHaveProperty('activeMultiplier');
    expect(body).toHaveProperty('communityMilestones');
    expect(Array.isArray(body.communityMilestones)).toBe(true);
  });

  it('never leaks a per-player field (playerId/displayName/email) anywhere in the response', async () => {
    const res = await cityStateGET(new Request(`http://localhost/api/game/city-state?eventSlug=${SEED_EVENT.slug}`));
    const json = JSON.stringify(await res.json());
    expect(json).not.toMatch(/playerId|displayName|"email"/);
  });
});
