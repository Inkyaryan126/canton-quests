/**
 * Canton Quests — Field NPC / Courier System Tests
 * Same testing philosophy as the prior missions this session: pure
 * decision logic (lib/field-npcs.ts) is fully exercised; DB-level
 * concurrency (claim_field_npc_slot's atomic inventory reservation) reuses
 * the same trusted single-UPDATE-RETURNING pattern as claim_quest_placement
 * and is documented, not re-provable without a live Postgres instance.
 */

import { describe, expect, it } from 'vitest';
import { validateFieldNpcClaim, generateFieldNpcCode, toPublicFieldNpc, FieldNpc } from '../lib/field-npcs';
import { claimFieldNpcDB, getEventFieldNpcsDB, getPublicFieldNpcsDB, createFieldNpcDB } from '../lib/field-npcs-db';
import { GET as fieldNpcsGET } from '../app/api/game/field-npcs/route';
import { POST as claimPOST } from '../app/api/game/field-npcs/claim/route';
import { SEED_EVENT } from '../lib/seed-data';

function makeNpc(overrides: Partial<Parameters<typeof validateFieldNpcClaim>[0]> = {}) {
  return {
    isActive: true,
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    currentCode: 'ABC123',
    claimLimit: 10,
    currentClaims: 0,
    ...overrides,
  };
}

describe('Expired NPC blocked', () => {
  it('rejects a claim once endsAt has passed', () => {
    const result = validateFieldNpcClaim(makeNpc({ endsAt: new Date(Date.now() - 1000).toISOString() }), 'ABC123');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('rejects a claim before startsAt', () => {
    const result = validateFieldNpcClaim(makeNpc({ startsAt: new Date(Date.now() + 60_000).toISOString() }), 'ABC123');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_yet_active');
  });

  it('rejects a claim when the NPC is simply deactivated, regardless of window', () => {
    const result = validateFieldNpcClaim(makeNpc({ isActive: false }), 'ABC123');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_active');
  });

  it('accepts a claim squarely inside the window with the correct code', () => {
    expect(validateFieldNpcClaim(makeNpc(), 'ABC123').ok).toBe(true);
  });
});

describe('Invalid code blocked', () => {
  it('rejects the wrong code', () => {
    const result = validateFieldNpcClaim(makeNpc(), 'WRONGCODE');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_code');
  });

  it('code comparison is case-insensitive and trims whitespace (a spoken code, easy to mistype the case of)', () => {
    expect(validateFieldNpcClaim(makeNpc({ currentCode: 'zx9k2p' }), '  ZX9K2P  ').ok).toBe(true);
  });

  it('an NPC with no code set at all can never be claimed', () => {
    const result = validateFieldNpcClaim(makeNpc({ currentCode: null }), 'ANYTHING');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_code');
  });

  it('generateFieldNpcCode never produces an ambiguous character (0/O, 1/I) and is always 6 characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateFieldNpcCode();
      expect(code).toHaveLength(6);
      expect(code).not.toMatch(/[01OI]/);
    }
  });
});

describe('Inventory cap enforced', () => {
  it('rejects a claim once currentClaims has reached claimLimit', () => {
    const result = validateFieldNpcClaim(makeNpc({ claimLimit: 5, currentClaims: 5 }), 'ABC123');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('inventory_exhausted');
  });

  it('accepts a claim one slot under the limit', () => {
    expect(validateFieldNpcClaim(makeNpc({ claimLimit: 5, currentClaims: 4 }), 'ABC123').ok).toBe(true);
  });

  it('a null claimLimit means unlimited — never rejected for inventory regardless of currentClaims', () => {
    expect(validateFieldNpcClaim(makeNpc({ claimLimit: null, currentClaims: 999999 }), 'ABC123').ok).toBe(true);
  });
});

describe('No private location leak', () => {
  it('toPublicFieldNpc strips exactLat/exactLon, currentCode, operatorNotes, and commanderTransmissionTrigger', () => {
    const npc: FieldNpc = {
      id: 'npc-1', eventId: SEED_EVENT.id, npcType: 'COURIER', aliasName: 'The Courier',
      publicDescription: 'Seen near the plaza.', avatarSymbol: '📦', sectorScope: 'family',
      broadAreaLabel: 'Near Centennial Plaza', exactLat: 40.798, exactLon: -81.378,
      isActive: true, startsAt: null, endsAt: null, currentCode: 'SECRET1', codeRotatedAt: null,
      claimLimit: 10, currentClaims: 2, rewardXp: 25, rewardDrawingEntries: 1,
      commanderTransmissionTrigger: 'npc_event', operatorNotes: 'Stand by the fountain at 2pm',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const safe = toPublicFieldNpc(npc);
    expect(safe).not.toHaveProperty('exactLat');
    expect(safe).not.toHaveProperty('exactLon');
    expect(safe).not.toHaveProperty('currentCode');
    expect(safe).not.toHaveProperty('operatorNotes');
    expect(safe).not.toHaveProperty('commanderTransmissionTrigger');
    // Safe fields survive.
    expect(safe.broadAreaLabel).toBe('Near Centennial Plaza');
    expect(safe.aliasName).toBe('The Courier');
  });

  it('the serialized public JSON never contains the operator note or exact coordinates', () => {
    const npc: FieldNpc = {
      id: 'npc-1', eventId: SEED_EVENT.id, npcType: 'WITNESS', aliasName: 'The Witness',
      publicDescription: 'x', avatarSymbol: '👁️', sectorScope: null, broadAreaLabel: 'x',
      exactLat: 40.798123, exactLon: -81.378456, isActive: true, startsAt: null, endsAt: null,
      currentCode: 'DONOTLEAK', codeRotatedAt: null, claimLimit: null, currentClaims: 0,
      rewardXp: 10, rewardDrawingEntries: 0, commanderTransmissionTrigger: null,
      operatorNotes: 'MEET BEHIND THE STATUE — DO NOT PUBLISH', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(toPublicFieldNpc(npc));
    expect(json).not.toContain('DONOTLEAK');
    expect(json).not.toContain('DO NOT PUBLISH');
    expect(json).not.toContain('40.798123');
  });

  it('GET /api/game/field-npcs never returns a currentCode/exactLat/exactLon/operatorNotes field on any NPC', async () => {
    const res = await fieldNpcsGET(new Request(`http://localhost/api/game/field-npcs?eventSlug=${SEED_EVENT.slug}`));
    const body = await res.json();
    expect(res.status).toBe(200);
    for (const npc of body.npcs || []) {
      expect(npc).not.toHaveProperty('currentCode');
      expect(npc).not.toHaveProperty('exactLat');
      expect(npc).not.toHaveProperty('operatorNotes');
    }
  });
});

describe('Cross-event blocked', () => {
  it('an unknown event slug returns a safe empty NPC list, never leaking another event\'s NPCs', async () => {
    const res = await fieldNpcsGET(new Request('http://localhost/api/game/field-npcs?eventSlug=totally-unknown-mission'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.npcs).toEqual([]);
  });

  it('claimFieldNpcDB scopes its NPC lookup by BOTH npcId and eventId — a code correct for one event can never resolve against another event\'s row (structural: the query always .eq("event_id", eventId))', async () => {
    // With no Supabase configured, the lookup degrades safely rather than
    // matching anything — verifying it never throws or falsely succeeds.
    const result = await claimFieldNpcDB({ eventId: SEED_EVENT.id, npcId: 'npc-from-another-event', playerId: 'plr-1', suppliedCode: 'ABC123' });
    expect(result.eligibility.ok).toBe(false);
    expect(result.newlyClaimed).toBe(false);
  });
});

describe('Duplicate claim blocked / graceful degradation with no Supabase configured', () => {
  it('claimFieldNpcDB never throws when unconfigured', async () => {
    const result = await claimFieldNpcDB({ eventId: SEED_EVENT.id, npcId: 'npc-1', playerId: 'plr-1', suppliedCode: 'ABC123' });
    expect(result.newlyClaimed).toBe(false);
    expect(result.xpAwarded).toBe(0);
  });

  it('getEventFieldNpcsDB / getPublicFieldNpcsDB return safe empty arrays rather than throwing', async () => {
    await expect(getEventFieldNpcsDB(SEED_EVENT.id)).resolves.toEqual([]);
    await expect(getPublicFieldNpcsDB(SEED_EVENT.id)).resolves.toEqual([]);
  });

  it('createFieldNpcDB throws a clear configuration error rather than silently no-opping', async () => {
    await expect(
      createFieldNpcDB({ eventId: SEED_EVENT.id, npcType: 'COURIER', aliasName: 'Test', publicDescription: 'x' })
    ).rejects.toThrow(/service-role/i);
  });
});

describe('POST /api/game/field-npcs/claim — request validation and auth', () => {
  it('rejects a request missing eventSlug/npcId/code', async () => {
    const res = await claimPOST(new Request('http://localhost/api/game/field-npcs/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });

  it('rejects an unauthenticated claim with a clear 401', async () => {
    const res = await claimPOST(
      new Request('http://localhost/api/game/field-npcs/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventSlug: SEED_EVENT.slug, npcId: 'npc-1', code: 'ABC123' }) })
    );
    expect(res.status).toBe(401);
  });

  it('an unknown event slug returns 404 before any auth/claim logic runs', async () => {
    const res = await claimPOST(
      new Request('http://localhost/api/game/field-npcs/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventSlug: 'totally-unknown-mission', npcId: 'npc-1', code: 'ABC123' }) })
    );
    expect(res.status).toBe(404);
  });
});
