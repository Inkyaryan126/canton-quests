import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LAUNCH_DISTRICT_QUESTS } from '../lib/finale';
import { proofDigest } from '../lib/quest-proof-secrets';

const fixture = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  errorTable: '',
  writes: [] as string[],
  grant: vi.fn(), xp: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({
  isSupabaseAdminConfigured: true,
  supabaseAdmin: { from(table: string) {
    let rows = fixture.rows[table] || [];
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[key])); return query; },
      maybeSingle: async () => ({ data: rows[0] || null, error: null }),
      upsert: async (row: Record<string, unknown>) => { fixture.writes.push(table); fixture.rows[table] = [row]; return { error: null }; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: fixture.errorTable === table ? { message: 'offline' } : null }).then(resolve),
    };
    return query;
  } },
}));
vi.mock('../lib/supabase-db', () => ({
  getEventByIdDB: async () => ({ slug: 'canton-weekend-1', status: 'active', currentPhase: 'day_1' }),
  insertRewardGrantDB: fixture.grant,
  incrementPlayerXpDB: fixture.xp,
}));
vi.mock('../lib/watchers-db', () => ({ getWatcherStatusDB: async () => ({ isEligible: false }) }));
import { getPlayerFinaleStatusDB, submitFinaleAnswerDB } from '../lib/finale-db';

const event_id = 'event-a';
const player_id = 'player-a';
const questRows = Object.entries(LAUNCH_DISTRICT_QUESTS).flatMap(([starting_path, slugs]) => slugs.map(slug => ({ event_id, id: slug, slug, starting_path, status: 'active' })));
function complete(paths: string[]) {
  fixture.rows.quest_submissions = questRows.filter(q => paths.includes(q.starting_path)).map(q => ({ event_id, player_id, quest_id: q.id, status: 'verified' }));
}
beforeEach(() => {
  fixture.errorTable = '';
  fixture.writes = [];
  fixture.grant.mockReset().mockResolvedValue(true);
  fixture.xp.mockReset().mockResolvedValue(undefined);
  fixture.rows = {
    quests: questRows,
    quest_submissions: [],
    finale_config: [{ event_id, required_sigil_count: 2, final_answer_hash: `sha256:${proofDigest('TEST SOLUTION')}`, master_cipher_clue_pieces: ['Private clue'], final_destination_reveal: 'Solved destination' }],
    player_district_cipher_progress: ['arts', 'challenge', 'secret'].map(district_key => ({ event_id, player_id, district_key, status: 'token_unlocked' })),
    reward_grants: ['word', 'code', 'mark'].map(lock => ({ event_id, player_id, reward_type: 'THREE_LOCKS_FRAGMENT', reward_key: `col-founder-${lock}` })),
  };
});

describe('Phase 6 authoritative finale integration', () => {
  it('loads the real decode-to-finale integration at runtime and reports the same gate', async () => {
    const { decodeDistrictCipherDB } = await import('../lib/founders-cipher');
    fixture.rows.cipher_fragments = [{ id: 'fragment-a', event_id, district_key: 'arts', is_required: true }];
    fixture.rows.player_cipher_fragments = [{ fragment_id: 'fragment-a', event_id, player_id }];
    complete(['family', 'challenge']);
    const params = { eventId: event_id, playerId: player_id, districtKey: 'arts' as const, sequence: ['A NAME', 'OUTLIVES', 'THE MAN'] };
    const partial = await decodeDistrictCipherDB(params);
    expect(partial.success).toBe(true);
    expect(partial.allSigilsUnlocked).toBe(true);
    expect(partial.hasAllThreeLocks).toBe(true);
    expect(partial.masterCipherAvailable).toBe(false);
    complete(['family', 'challenge', 'secret']);
    expect((await decodeDistrictCipherDB(params)).masterCipherAvailable).toBe(true);
    expect(fixture.writes).toEqual([]);
  });
  it.each(['family', 'challenge', 'secret'])('opens cemetery for %s without writing or granting full completion', async path => {
    complete([path]);
    fixture.rows.reward_grants = [];
    fixture.rows.player_district_cipher_progress = [];
    const status = await getPlayerFinaleStatusDB(event_id, player_id);
    expect(status.launchProgress?.cemeteryUnlocked).toBe(true);
    expect(status.completedAt).toBeNull();
    expect(status.eligibility.ok).toBe(false);
    expect(status.cluePieces).toEqual([]);
    expect(status.destinationReveal).toBeNull();
    expect(fixture.writes).toEqual([]);
    expect(fixture.grant).not.toHaveBeenCalled();
  });
  it('does not use another event/player or pending reviews as completion', async () => {
    complete(['family']);
    fixture.rows.quest_submissions.forEach(row => { row.player_id = 'other'; });
    fixture.rows.quest_submissions.push(...questRows.map(q => ({ event_id: 'other', player_id, quest_id: q.id, status: 'verified' })));
    expect((await getPlayerFinaleStatusDB(event_id, player_id)).launchProgress?.cemeteryUnlocked).toBe(false);
  });
  it('requires three sigils despite the existing live two-sigil config', async () => {
    complete(['family', 'challenge', 'secret']);
    fixture.rows.player_district_cipher_progress.pop();
    const result = await submitFinaleAnswerDB(event_id, player_id, 'TEST SOLUTION');
    expect(result.eligibility).toMatchObject({ ok: false, reason: 'insufficient_sigils' });
    expect(fixture.writes).toEqual([]);
  });
  it('rejects a direct solve with all locks/sigils but only two complete districts', async () => {
    complete(['family', 'challenge']);
    expect((await submitFinaleAnswerDB(event_id, player_id, 'TEST SOLUTION')).eligibility).toMatchObject({ ok: false, reason: 'districts_required' });
    expect(fixture.grant).not.toHaveBeenCalled();
  });
  it('full solve persists completion and awards existing 100 XP once, including replay', async () => {
    complete(['family', 'challenge', 'secret']);
    expect((await submitFinaleAnswerDB(event_id, player_id, 'TEST SOLUTION')).outcome?.stage).toBe('completed');
    expect((await submitFinaleAnswerDB(event_id, player_id, 'TEST SOLUTION')).outcome?.stage).toBe('already_completed');
    expect(fixture.grant).toHaveBeenCalledTimes(1);
    expect(fixture.grant).toHaveBeenCalledWith({ eventId: event_id, playerId: player_id, rewardType: 'FINALE_PROGRESS', rewardKey: 'master_cipher_complete', xpAwarded: 100 });
    expect(fixture.xp).toHaveBeenCalledTimes(1);
    expect(fixture.xp).toHaveBeenCalledWith(player_id, 100);
  });
  it('failed completion lookup fails closed, never falls back to seed progress', async () => {
    fixture.errorTable = 'quest_submissions';
    await expect(submitFinaleAnswerDB(event_id, player_id, 'TEST SOLUTION')).rejects.toThrow('Unable to verify district completion');
    expect(fixture.writes).toEqual([]);
  });
});
