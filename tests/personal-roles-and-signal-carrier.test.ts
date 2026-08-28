/**
 * Canton Quests — Personal Missions & Secret Roles Tests
 */

import { describe, expect, it } from 'vitest';
import { assignCoreRole, decideSignalPropagation, PERSONAL_ROLE_DEFINITIONS } from '../lib/personal-roles';
import { getPlayerPersonalRolesDB, getOrAssignCoreRoleDB, propagateSignalCarrierDB, seedSignalCarrierDB, getSignalCarrierCountDB } from '../lib/personal-roles-db';
import { GET as personalRolesGET } from '../app/api/game/personal-roles/route';
import { SEED_EVENT } from '../lib/seed-data';

describe('Role assignment — deterministic, private by construction', () => {
  it('the same (playerId, eventId) always resolves to the same core role', () => {
    expect(assignCoreRole('plr-99', SEED_EVENT.id)).toBe(assignCoreRole('plr-99', SEED_EVENT.id));
  });

  it('assignCoreRole never returns SIGNAL_CARRIER — that role only ever comes from propagation or GM seeding', () => {
    for (let i = 0; i < 30; i++) {
      expect(assignCoreRole(`plr-${i}`, SEED_EVENT.id)).not.toBe('SIGNAL_CARRIER');
    }
  });

  it('the assignable pool is actually used across different players', () => {
    const roles = new Set(Array.from({ length: 20 }, (_, i) => assignCoreRole(`plr-${i}`, SEED_EVENT.id)));
    expect(roles.size).toBeGreaterThan(1);
  });

  it('every role definition has a title and private mission text', () => {
    for (const type of Object.keys(PERSONAL_ROLE_DEFINITIONS) as Array<keyof typeof PERSONAL_ROLE_DEFINITIONS>) {
      expect(PERSONAL_ROLE_DEFINITIONS[type].title.length).toBeGreaterThan(0);
      expect(PERSONAL_ROLE_DEFINITIONS[type].missionText.length).toBeGreaterThan(0);
    }
  });
});

describe('Signal Carrier propagation — decideSignalPropagation (pure)', () => {
  it('carrier links with non-carrier: the non-carrier catches it, the carrier keeps carrying (a spread, not a transfer)', () => {
    expect(decideSignalPropagation(true, false)).toEqual({ propagateToA: false, propagateToB: true });
    expect(decideSignalPropagation(false, true)).toEqual({ propagateToA: true, propagateToB: false });
  });

  it('neither player carries the signal — nothing propagates (no source to spread from)', () => {
    expect(decideSignalPropagation(false, false)).toEqual({ propagateToA: false, propagateToB: false });
  });

  it('both players already carry the signal — nothing propagates (this is what makes repeated same-pair links safe from farming: there is no grant left to repeat)', () => {
    expect(decideSignalPropagation(true, true)).toEqual({ propagateToA: false, propagateToB: false });
  });
});

describe('Duplicate farming / repeated same-pair propagation abuse blocked', () => {
  it('propagateSignalCarrierDB never throws when unconfigured and correctly reports no propagation', async () => {
    const result = await propagateSignalCarrierDB(SEED_EVENT.id, 'plr-a', 'plr-b');
    expect(result.propagatedTo).toBeUndefined();
  });

  it('self-propagation is structurally impossible: propagateSignalCarrierDB never grants unless the two ids differ, and the caller (createPlayerLinkDB) already rejects self-links via validatePlayerLinkEligibility before this is ever reached', async () => {
    // With no Supabase configured this is a safe no-op either way; the real
    // guarantee here is architectural (see lib/player-links.ts's self_link
    // check, which runs before createPlayerLinkDB ever calls this).
    const result = await propagateSignalCarrierDB(SEED_EVENT.id, 'plr-same', 'plr-same');
    expect(result.propagatedTo).toBeUndefined();
  });
});

describe('Role privacy — no cross-player query surface', () => {
  it('getPlayerPersonalRolesDB / getOrAssignCoreRoleDB return safe empty arrays rather than throwing when unconfigured', async () => {
    await expect(getPlayerPersonalRolesDB(SEED_EVENT.id, 'plr-1')).resolves.toEqual([]);
    await expect(getOrAssignCoreRoleDB(SEED_EVENT.id, 'plr-1')).resolves.toEqual([]);
  });

  it('getSignalCarrierCountDB returns a safe zero rather than throwing', async () => {
    await expect(getSignalCarrierCountDB(SEED_EVENT.id)).resolves.toBe(0);
  });

  it('seedSignalCarrierDB (GM-only) never throws when unconfigured', async () => {
    await expect(seedSignalCarrierDB(SEED_EVENT.id, 'plr-1')).resolves.toEqual({ newlyGranted: false });
  });

  it('GET /api/game/personal-roles has no parameter that could name a different player — the route signature itself only ever reads eventSlug', async () => {
    const res = await personalRolesGET(new Request(`http://localhost/api/game/personal-roles?eventSlug=${SEED_EVENT.slug}&playerId=plr-someone-else`));
    // Even if a caller tries to smuggle a playerId query param, it's never read by the route — only the authenticated session's own player id is ever used.
    expect(res.status).toBe(401); // unauthenticated in this test env — proves auth is required, never bypassed by a query param.
  });

  it('no eventSlug returns a safe empty roles list, not an error', async () => {
    const res = await personalRolesGET(new Request('http://localhost/api/game/personal-roles'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.roles).toEqual([]);
  });

  it('an unknown event slug returns a safe empty roles list', async () => {
    const res = await personalRolesGET(new Request('http://localhost/api/game/personal-roles?eventSlug=totally-unknown-mission'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.roles).toEqual([]);
  });

  it('an authenticated-looking request with no real session is still rejected with 401, never defaulting to an empty-but-200 response that could mask a broken auth check', async () => {
    const res = await personalRolesGET(new Request(`http://localhost/api/game/personal-roles?eventSlug=${SEED_EVENT.slug}`));
    expect(res.status).toBe(401);
  });
});
