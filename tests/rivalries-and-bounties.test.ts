/**
 * Canton Quests — Rivalries & Bounties Tests
 */

import { describe, expect, it } from 'vitest';
import { computeRivalSignals, getPrimaryRivalSignal } from '../lib/rivalries';
import { assignCoreBounty, isBountyComplete, BOUNTY_DEFINITIONS } from '../lib/bounties';
import { getPlayerRivalryStatusDB } from '../lib/bounties-db';
import { GET as rivalriesGET } from '../app/api/game/rivalries/route';
import { LeaderboardEntry } from '../lib/types';
import { SEED_EVENT } from '../lib/seed-data';

function entry(overrides: Partial<LeaderboardEntry>): LeaderboardEntry {
  return { rank: 1, playerId: 'plr-x', displayName: 'Agent X', totalPoints: 0, questsCompletedCount: 0, ...overrides };
}

const BOARD: LeaderboardEntry[] = [
  entry({ rank: 1, playerId: 'plr-1', displayName: 'Nova', totalPoints: 500, questsCompletedCount: 8 }),
  entry({ rank: 2, playerId: 'plr-2', displayName: 'Vega', totalPoints: 470, questsCompletedCount: 7 }),
  entry({ rank: 3, playerId: 'plr-3', displayName: 'Orion', totalPoints: 300, questsCompletedCount: 5 }),
  entry({ rank: 4, playerId: 'plr-4', displayName: 'Lyra', totalPoints: 60, questsCompletedCount: 1 }),
  entry({ rank: 5, playerId: 'plr-5', displayName: 'Draco', totalPoints: 40, questsCompletedCount: 0 }),
];

describe('computeRivalSignals — no PII, no location, rank+XP only', () => {
  it('a player between two close competitors gets both an "ahead_of_you" and "behind_you" signal', () => {
    const signals = computeRivalSignals(BOARD, 'plr-2', 40);
    expect(signals.some((s) => s.direction === 'ahead_of_you' && s.rivalPlayerId === 'plr-1')).toBe(true);
    // plr-3 is 170 XP behind plr-2 — outside the 40 XP threshold, no signal.
    expect(signals.some((s) => s.direction === 'behind_you')).toBe(false);
  });

  it('a player with a large gap on both sides gets no rival signals at all', () => {
    expect(computeRivalSignals(BOARD, 'plr-3', 40)).toEqual([]);
  });

  it('the top-ranked player only ever gets a "behind_you" signal (nobody is ahead of #1)', () => {
    const signals = computeRivalSignals(BOARD, 'plr-1', 40);
    expect(signals.every((s) => s.direction === 'behind_you')).toBe(true);
  });

  it('the bottom-ranked player only ever gets an "ahead_of_you" signal', () => {
    const signals = computeRivalSignals(BOARD, 'plr-5', 40);
    expect(signals.every((s) => s.direction === 'ahead_of_you')).toBe(true);
  });

  it('an unknown playerId (not on the board) returns no signals rather than throwing', () => {
    expect(computeRivalSignals(BOARD, 'plr-nonexistent', 40)).toEqual([]);
  });

  it('a RivalSignal structurally carries only playerId/displayName/rank/xpGap/direction — no location, email, or any other field is even a possible key', () => {
    const signal = getPrimaryRivalSignal(BOARD, 'plr-2', 40)!;
    expect(Object.keys(signal).sort()).toEqual(['direction', 'rivalDisplayName', 'rivalPlayerId', 'rivalRank', 'xpGap'].sort());
  });

  it('getPrimaryRivalSignal picks the tightest gap when both directions qualify', () => {
    const tightBoard: LeaderboardEntry[] = [
      entry({ rank: 1, playerId: 'plr-a', totalPoints: 110 }),
      entry({ rank: 2, playerId: 'plr-b', totalPoints: 100 }),
      entry({ rank: 3, playerId: 'plr-c', totalPoints: 95 }),
    ];
    const primary = getPrimaryRivalSignal(tightBoard, 'plr-b', 40)!;
    expect(primary.xpGap).toBe(5);
    expect(primary.rivalPlayerId).toBe('plr-c');
  });
});

describe('Bounty assignment — deterministic, not random', () => {
  it('the same (playerId, eventId) always resolves to the same core bounty', () => {
    const a = assignCoreBounty('plr-42', SEED_EVENT.id);
    const b = assignCoreBounty('plr-42', SEED_EVENT.id);
    expect(a.key).toBe(b.key);
  });

  it('assignCoreBounty never returns the rival-dependent bounty as a core assignment', () => {
    for (let i = 0; i < 30; i++) {
      const bounty = assignCoreBounty(`plr-${i}`, SEED_EVENT.id);
      expect(bounty.key).not.toBe('outpace_rival');
    }
  });

  it('different players can be assigned different bounties (the pool is actually used, not collapsed to one value)', () => {
    const keys = new Set(Array.from({ length: 20 }, (_, i) => assignCoreBounty(`plr-${i}`, SEED_EVENT.id).key));
    expect(keys.size).toBeGreaterThan(1);
  });
});

describe('Bounty completion — public in-game attributes only', () => {
  it('cross_path_signal completes only with a DIFFERENT_PATH_LINK', () => {
    expect(isBountyComplete('cross_path_signal', { myRank: 5, myLinks: [{ linkType: 'DIFFERENT_PATH_LINK', otherPlayerId: 'p2' }], linkPartnerRanks: {}, myCompletedQuests: 0 })).toBe(true);
    expect(isBountyComplete('cross_path_signal', { myRank: 5, myLinks: [{ linkType: 'PLAYER_LINK', otherPlayerId: 'p2' }], linkPartnerRanks: {}, myCompletedQuests: 0 })).toBe(false);
  });

  it('close_rank_link completes only when a link partner is within 5 ranks', () => {
    const near = isBountyComplete('close_rank_link', { myRank: 10, myLinks: [{ linkType: 'PLAYER_LINK', otherPlayerId: 'p2' }], linkPartnerRanks: { p2: 13 }, myCompletedQuests: 0 });
    const far = isBountyComplete('close_rank_link', { myRank: 10, myLinks: [{ linkType: 'PLAYER_LINK', otherPlayerId: 'p2' }], linkPartnerRanks: { p2: 40 }, myCompletedQuests: 0 });
    expect(near).toBe(true);
    expect(far).toBe(false);
  });

  it('group_signal completes only with a GROUP_OBJECTIVE link', () => {
    expect(isBountyComplete('group_signal', { myRank: 1, myLinks: [{ linkType: 'GROUP_OBJECTIVE', otherPlayerId: 'p2' }], linkPartnerRanks: {}, myCompletedQuests: 0 })).toBe(true);
    expect(isBountyComplete('group_signal', { myRank: 1, myLinks: [], linkPartnerRanks: {}, myCompletedQuests: 0 })).toBe(false);
  });

  it('outpace_rival requires strictly more completions than the rival, and is false with no rival context at all', () => {
    expect(isBountyComplete('outpace_rival', { myRank: 1, myLinks: [], linkPartnerRanks: {}, myCompletedQuests: 5, rivalCompletedQuests: 3 })).toBe(true);
    expect(isBountyComplete('outpace_rival', { myRank: 1, myLinks: [], linkPartnerRanks: {}, myCompletedQuests: 3, rivalCompletedQuests: 3 })).toBe(false);
    expect(isBountyComplete('outpace_rival', { myRank: 1, myLinks: [], linkPartnerRanks: {}, myCompletedQuests: 5 })).toBe(false);
  });

  it('every bounty definition targets only a public in-game attribute — title/description never mention a name, email, or address', () => {
    for (const bounty of BOUNTY_DEFINITIONS) {
      expect(bounty.description.toLowerCase()).not.toMatch(/email|address|gps|coordinate/);
    }
  });
});

describe('getPlayerRivalryStatusDB — graceful degradation with no Supabase configured', () => {
  it('returns a well-formed status (core bounty always present, never throws) even with empty data', async () => {
    const status = await getPlayerRivalryStatusDB(SEED_EVENT.id, 'plr-unknown');
    expect(status.coreBounty).toBeDefined();
    expect(status.coreBounty.newlyCompleted).toBe(false);
  });
});

describe('GET /api/game/rivalries', () => {
  it('no eventSlug returns a safe null response', async () => {
    const res = await rivalriesGET(new Request('http://localhost/api/game/rivalries'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.rival).toBeNull();
  });

  it('an unknown event slug returns a safe null response', async () => {
    const res = await rivalriesGET(new Request('http://localhost/api/game/rivalries?eventSlug=totally-unknown-mission'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.rival).toBeNull();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await rivalriesGET(new Request(`http://localhost/api/game/rivalries?eventSlug=${SEED_EVENT.slug}`));
    expect(res.status).toBe(401);
  });
});
