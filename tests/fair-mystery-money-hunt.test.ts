/**
 * Canton Quests — Fair QR Hunt $300 Mystery Money redesign coverage.
 *
 * Exercises the real /api/qr/claim and /api/fair/dashboard route handlers
 * against the local/offline engine (the same harness pattern used by
 * tests/command-center-xp-consistency.test.ts and the retired
 * fair-hunt-claim-flow.test.ts this file replaces) — real global-claim
 * safety, real hidden-value security, real cross-Mission isolation.
 *
 * The point/XP/leaderboard mechanic this redesign retires has its own
 * remaining coverage in tests/fair-hunt-core.test.ts (content shape,
 * window timing) — this file covers only the new Mystery Money claims
 * mechanism end to end.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  initializeGameEngine,
  resetGameEngineStore,
  registerPlayer,
  getEventParticipation,
  getPlayerProgress,
  updateQuest,
  updateEvent,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_FAIR_EVENT, SEED_FAIR_QUESTS, SEED_FAIR_MYSTERY_PRIZES, SEED_QUESTS } from '../lib/seed-data';
import { isFairCoreQuest, MYSTERY_TOTAL_POOL_CENTS, MYSTERY_SIGNAL_COUNT } from '../lib/fair-hunt';
import { POST as qrClaimRoute } from '../app/api/qr/claim/route';
import { GET as fairDashboardRoute } from '../app/api/fair/dashboard/route';

// Mystery-money tests exercise claim MECHANICS (global-first-claim,
// hidden-value security, cross-player independence) — not the Sept 4–5
// America/New_York window itself, which is covered independently in
// tests/fair-hunt-core.test.ts. Every seeded core Signal's window is
// widened to "always available" here so these tests pass regardless of
// what today's real date happens to be.
function widenAllCoreSignalWindows() {
  updateEvent(SEED_FAIR_EVENT.id, { startTime: undefined, endTime: undefined, status: 'active', isPaused: false });
  for (const quest of SEED_FAIR_QUESTS.filter(isFairCoreQuest)) {
    updateQuest(quest.id, { startsAt: undefined, expiresAt: undefined });
  }
}

function authedRequest(url: string, userId: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer mock-jwt-${userId}`,
    },
  });
}

function claimRequest(userId: string | null, code: string): Request {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  };
  return userId ? authedRequest('http://localhost:3000/api/qr/claim', userId, init) : new Request('http://localhost:3000/api/qr/claim', init);
}

const coreQuests = SEED_FAIR_QUESTS.filter(isFairCoreQuest);
const SIGNAL_01 = coreQuests.find((q) => q.slug === 'fair-core-01')!;
const SIGNAL_02 = coreQuests.find((q) => q.slug === 'fair-core-02')!;
const MAIN_QUEST = SEED_QUESTS[0];

describe('$300 Mystery Money Hunt — prize configuration', () => {
  it('1. exactly 20 Fair Signals exist, and exactly 20 are part of the Mystery Money game', () => {
    expect(coreQuests).toHaveLength(20);
    expect(coreQuests).toHaveLength(MYSTERY_SIGNAL_COUNT);
  });

  it('2. the configured mystery values total exactly $300 (30,000 cents)', () => {
    const total = SEED_FAIR_MYSTERY_PRIZES.reduce((sum, p) => sum + p.cashCents, 0);
    expect(total).toBe(30000);
    expect(total).toBe(MYSTERY_TOTAL_POOL_CENTS);
  });

  it('every core Signal has exactly one configured prize, and every prize maps to a real core Signal', () => {
    const coreIds = new Set(coreQuests.map((q) => q.id));
    expect(SEED_FAIR_MYSTERY_PRIZES).toHaveLength(20);
    const prizeIds = new Set(SEED_FAIR_MYSTERY_PRIZES.map((p) => p.questId));
    expect(prizeIds.size).toBe(20);
    for (const prize of SEED_FAIR_MYSTERY_PRIZES) {
      expect(coreIds.has(prize.questId)).toBe(true);
    }
  });

  it('matches the approved distribution: 6x$5, 4x$10, 4x$15, 3x$20, 2x$30, 1x$50', () => {
    const counts = new Map<number, number>();
    for (const p of SEED_FAIR_MYSTERY_PRIZES) {
      counts.set(p.cashCents, (counts.get(p.cashCents) || 0) + 1);
    }
    expect(counts.get(500)).toBe(6);
    expect(counts.get(1000)).toBe(4);
    expect(counts.get(1500)).toBe(4);
    expect(counts.get(2000)).toBe(3);
    expect(counts.get(3000)).toBe(2);
    expect(counts.get(5000)).toBe(1);
  });

  it('every prize value is a positive whole-cent amount — never zero, never fractional', () => {
    for (const p of SEED_FAIR_MYSTERY_PRIZES) {
      expect(p.cashCents).toBeGreaterThan(0);
      expect(Number.isInteger(p.cashCents)).toBe(true);
    }
  });
});

describe('$300 Mystery Money Hunt — claim flow', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
    widenAllCoreSignalWindows();
  });

  it('an unauthenticated scan is rejected (401)', async () => {
    const res = await qrClaimRoute(claimRequest(null, SIGNAL_01.targetCode!));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.reason).toBe('unauthenticated');
  });

  it('3. the first authenticated scanner of an unclaimed Signal wins it — the actual configured cash value is revealed to them', async () => {
    const player = registerPlayer({ displayName: 'FirstFinder', userId: 'usr-first' });
    const res = await qrClaimRoute(claimRequest('usr-first', SIGNAL_01.targetCode!));
    const data = await res.json();
    const expectedCents = SEED_FAIR_MYSTERY_PRIZES.find((p) => p.questId === SIGNAL_01.id)!.cashCents;

    expect(data.success).toBe(true);
    expect(data.reason).toBe('signal_secured');
    expect(data.isFair).toBe(true);
    expect(data.isMysterySignal).toBe(true);
    expect(data.cashCents).toBe(expectedCents);
    expect(data.winnerDisplayName).toBe(player.displayName);
    expect(data.pointsAwarded).toBeUndefined();
  });

  it('4. the cash value is not present anywhere before a successful first claim — only appears in the response once won', async () => {
    registerPlayer({ displayName: 'Watcher', userId: 'usr-watcher' });
    const preClaimDash = await (await fairDashboardRoute(authedRequest('http://localhost:3000/api/fair/dashboard', 'usr-watcher'))).json();
    const preClaimSignal = preClaimDash.board.signals.find((s: any) => s.questId === SIGNAL_01.id);
    expect(preClaimSignal.found).toBe(false);
    expect(preClaimSignal.cashCents).toBeUndefined();

    await qrClaimRoute(claimRequest('usr-watcher', SIGNAL_01.targetCode!));

    const postClaimDash = await (await fairDashboardRoute(authedRequest('http://localhost:3000/api/fair/dashboard', 'usr-watcher'))).json();
    const postClaimSignal = postClaimDash.board.signals.find((s: any) => s.questId === SIGNAL_01.id);
    expect(postClaimSignal.found).toBe(true);
    expect(postClaimSignal.cashCents).toBe(SEED_FAIR_MYSTERY_PRIZES.find((p) => p.questId === SIGNAL_01.id)!.cashCents);
  });

  it('5. a second scanner of an already-claimed Signal is awarded $0 — no cash, no ability to claim', async () => {
    registerPlayer({ displayName: 'Winner', userId: 'usr-winner' });
    registerPlayer({ displayName: 'TooLate', userId: 'usr-too-late' });

    const first = await (await qrClaimRoute(claimRequest('usr-winner', SIGNAL_01.targetCode!))).json();
    expect(first.success).toBe(true);

    const second = await (await qrClaimRoute(claimRequest('usr-too-late', SIGNAL_01.targetCode!))).json();
    expect(second.success).toBe(false);
    expect(second.reason).toBe('signal_already_found');
    expect(second.winnerDisplayName).toBe('Winner');
    // The amount IS revealed to the second scanner (per spec — publicly
    // revealed once any claim exists) but no money is awarded to them.
    expect(second.cashCents).toBe(first.cashCents);
  });

  it('6. only one global winner can ever exist per Signal — a third, fourth, fifth scan all see the same original winner', async () => {
    registerPlayer({ displayName: 'RealWinner', userId: 'usr-real-winner' });
    await qrClaimRoute(claimRequest('usr-real-winner', SIGNAL_01.targetCode!));

    for (let i = 0; i < 3; i++) {
      registerPlayer({ displayName: `LateComer${i}`, userId: `usr-late-${i}` });
      // eslint-disable-next-line no-await-in-loop
      const attempt = await (await qrClaimRoute(claimRequest(`usr-late-${i}`, SIGNAL_01.targetCode!))).json();
      expect(attempt.success).toBe(false);
      expect(attempt.reason).toBe('signal_already_found');
      expect(attempt.winnerDisplayName).toBe('RealWinner');
    }
  });

  it('7. rapid repeated claims from the same identity never double-award money — idempotent, refresh/back-button safe', async () => {
    const player = registerPlayer({ displayName: 'RetryAgent', userId: 'usr-retry' });
    for (let i = 0; i < 4; i++) {
      // eslint-disable-next-line no-await-in-loop
      await qrClaimRoute(claimRequest('usr-retry', SIGNAL_01.targetCode!));
    }
    const winners = await (await fairDashboardRoute(authedRequest('http://localhost:3000/api/fair/dashboard', 'usr-retry'))).json();
    const mine = winners.winners.find((w: any) => w.playerId === player.id);
    expect(mine.signalsFound).toBe(1);
    expect(mine.totalCents).toBe(SEED_FAIR_MYSTERY_PRIZES.find((p) => p.questId === SIGNAL_01.id)!.cashCents);
  });

  it('different players can each win a different Signal independently', async () => {
    registerPlayer({ displayName: 'PlayerA', userId: 'usr-a' });
    registerPlayer({ displayName: 'PlayerB', userId: 'usr-b' });

    const resA = await (await qrClaimRoute(claimRequest('usr-a', SIGNAL_01.targetCode!))).json();
    const resB = await (await qrClaimRoute(claimRequest('usr-b', SIGNAL_02.targetCode!))).json();

    expect(resA.success).toBe(true);
    expect(resB.success).toBe(true);
    expect(resA.winnerDisplayName).toBe('PlayerA');
    expect(resB.winnerDisplayName).toBe('PlayerB');
  });

  it('Fair participation requires no path, and it is not created twice for the same player', async () => {
    const player = registerPlayer({ displayName: 'NoPathAgent', userId: 'usr-no-path' });
    expect(player.selectedStartingPath).toBeUndefined();

    await qrClaimRoute(claimRequest('usr-no-path', SIGNAL_01.targetCode!));
    const firstParticipation = getEventParticipation(SEED_FAIR_EVENT.id, player.id);
    expect(firstParticipation).toBeDefined();
    expect(firstParticipation!.path).toBeFalsy();

    await qrClaimRoute(claimRequest('usr-no-path', SIGNAL_02.targetCode!));
    const secondParticipation = getEventParticipation(SEED_FAIR_EVENT.id, player.id);
    expect(secondParticipation!.id).toBe(firstParticipation!.id);
  });

  it('an unrecognized/invalid code is rejected without leaking any internal id or matching quest data', async () => {
    registerPlayer({ displayName: 'Prober', userId: 'usr-prober' });
    const res = await qrClaimRoute(claimRequest('usr-prober', 'TOTALLY-MADE-UP-CODE-000'));
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.reason).toBe('not_recognized');
    expect(data.quest).toBeUndefined();
    expect(data.cashCents).toBeUndefined();
  });

  it('the client cannot control the awarded cash value — a forged cashCents/pointsAwarded field in the request body is ignored', async () => {
    registerPlayer({ displayName: 'Cheater', userId: 'usr-cheater' });
    const req = authedRequest('http://localhost:3000/api/qr/claim', 'usr-cheater', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: SIGNAL_01.targetCode, cashCents: 999999, pointsAwarded: 999999 }),
    });
    const data = await (await qrClaimRoute(req)).json();
    expect(data.cashCents).toBe(SEED_FAIR_MYSTERY_PRIZES.find((p) => p.questId === SIGNAL_01.id)!.cashCents);
  });

  it('14. a Fair Signal claim never touches Founder\'s Cipher / Main Operation XP or quest completion — full Mission isolation', async () => {
    const player = registerPlayer({ displayName: 'CrossMissionAgent', userId: 'usr-cross-mission' });
    await qrClaimRoute(claimRequest('usr-cross-mission', SIGNAL_01.targetCode!));

    const mainProgress = getPlayerProgress(player.id, SEED_EVENT.id);
    expect(mainProgress.completedQuestIds).not.toContain(SIGNAL_01.id);
    expect(mainProgress.totalPoints).toBe(0);
    if (MAIN_QUEST) {
      expect(mainProgress.completedQuestIds).not.toContain(MAIN_QUEST.id);
    }
  });
});

describe('$300 Mystery Money Hunt — public board & security', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
    widenAllCoreSignalWindows();
  });

  it('8. an unfound Signal in the public board response does NOT contain its dollar amount, in any field', async () => {
    const res = await fairDashboardRoute(new Request('http://localhost:3000/api/fair/dashboard'));
    const data = await res.json();
    const raw = JSON.stringify(data);

    const unfoundSignal = data.board.signals.find((s: any) => !s.found);
    expect(unfoundSignal).toBeDefined();
    expect(unfoundSignal.cashCents).toBeUndefined();
    expect(unfoundSignal).not.toHaveProperty('cashCents');

    // Belt-and-suspenders: none of the unfound Signals' actual configured
    // values should appear anywhere in the raw response body at all.
    const unfoundCents = data.board.signals.filter((s: any) => !s.found).map((s: any) => s.questId);
    for (const questId of unfoundCents) {
      const cents = SEED_FAIR_MYSTERY_PRIZES.find((p) => p.questId === questId)?.cashCents;
      // A small/common value like 500 could coincidentally appear as some
      // unrelated number (e.g. a timestamp fragment) — so this check is
      // scoped to the distinctive $50 (5000) top prize, which cannot
      // plausibly appear by coincidence.
      if (cents === 5000) {
        expect(raw).not.toContain('5000');
      }
    }
  });

  it('9. hidden values cannot be recovered from the public dashboard API by any authenticated OR unauthenticated caller', async () => {
    registerPlayer({ displayName: 'Snooper', userId: 'usr-snooper' });
    const authed = await (await fairDashboardRoute(authedRequest('http://localhost:3000/api/fair/dashboard', 'usr-snooper'))).json();
    const anon = await (await fairDashboardRoute(new Request('http://localhost:3000/api/fair/dashboard'))).json();

    for (const payload of [authed, anon]) {
      for (const signal of payload.board.signals) {
        if (!signal.found) {
          expect(signal.cashCents).toBeUndefined();
          expect(signal.claimedAt).toBeUndefined();
          expect(signal.finderDisplayName).toBeUndefined();
        }
      }
    }
  });

  it('10. a claimed Signal DOES publicly reveal its dollar amount and finder — to both authenticated and unauthenticated callers', async () => {
    registerPlayer({ displayName: 'PublicWinner', userId: 'usr-public-winner' });
    await qrClaimRoute(claimRequest('usr-public-winner', SIGNAL_01.targetCode!));
    const expectedCents = SEED_FAIR_MYSTERY_PRIZES.find((p) => p.questId === SIGNAL_01.id)!.cashCents;

    const anon = await (await fairDashboardRoute(new Request('http://localhost:3000/api/fair/dashboard'))).json();
    const foundSignal = anon.board.signals.find((s: any) => s.questId === SIGNAL_01.id);
    expect(foundSignal.found).toBe(true);
    expect(foundSignal.cashCents).toBe(expectedCents);
    expect(foundSignal.finderDisplayName).toBe('PublicWinner');
    expect(foundSignal.claimedAt).toBeTruthy();
  });

  it('11. player cash totals calculate correctly across multiple Signals found by the same player', async () => {
    const player = registerPlayer({ displayName: 'MultiFinder', userId: 'usr-multi' });
    const res1 = await (await qrClaimRoute(claimRequest('usr-multi', SIGNAL_01.targetCode!))).json();
    const res2 = await (await qrClaimRoute(claimRequest('usr-multi', SIGNAL_02.targetCode!))).json();
    const expectedTotal = (res1.cashCents || 0) + (res2.cashCents || 0);

    const dash = await (await fairDashboardRoute(authedRequest('http://localhost:3000/api/fair/dashboard', 'usr-multi'))).json();
    const mine = dash.winners.find((w: any) => w.playerId === player.id);
    expect(mine.signalsFound).toBe(2);
    expect(mine.totalCents).toBe(expectedTotal);
    expect(dash.myWinnings.signalsFound).toBe(2);
    expect(dash.myWinnings.totalCents).toBe(expectedTotal);
  });

  it('12. public dashboard never leaks aggregate revealed/hidden money totals (prevents deduction leaks)', async () => {
    registerPlayer({ displayName: 'Auditor', userId: 'usr-auditor' });

    const zero = await (await fairDashboardRoute(new Request('http://localhost:3000/api/fair/dashboard'))).json();
    expect(zero.board).not.toHaveProperty('revealedCents');
    expect(zero.board).not.toHaveProperty('hiddenCents');
    expect(zero.board.totalPoolCents).toBe(30000);
    expect(zero.board.foundCount).toBe(0);
    expect(zero.board.totalCount).toBe(20);

    await qrClaimRoute(claimRequest('usr-auditor', SIGNAL_01.targetCode!));
    const partial = await (await fairDashboardRoute(new Request('http://localhost:3000/api/fair/dashboard'))).json();
    expect(partial.board).not.toHaveProperty('revealedCents');
    expect(partial.board).not.toHaveProperty('hiddenCents');
    expect(partial.board.foundCount).toBe(1);

    // Claim every remaining Signal and confirm public board still omits aggregate totals
    let i = 0;
    for (const quest of coreQuests) {
      if (quest.id === SIGNAL_01.id) continue;
      // eslint-disable-next-line no-await-in-loop
      registerPlayer({ displayName: `Sweep${i}`, userId: `usr-sweep-${i}` });
      // eslint-disable-next-line no-await-in-loop
      await qrClaimRoute(claimRequest(`usr-sweep-${i}`, quest.targetCode!));
      i += 1;
    }
    const full = await (await fairDashboardRoute(new Request('http://localhost:3000/api/fair/dashboard'))).json();
    expect(full.board).not.toHaveProperty('revealedCents');
    expect(full.board).not.toHaveProperty('hiddenCents');
    expect(full.board.foundCount).toBe(20);
  });

  it('13. no Fair point-based leaderboard field remains anywhere in the dashboard response', async () => {
    const res = await fairDashboardRoute(new Request('http://localhost:3000/api/fair/dashboard'));
    const data = await res.json();
    expect(data).not.toHaveProperty('leaderboardPreview');
    expect(data).not.toHaveProperty('leaderboardSize');
    expect(data).not.toHaveProperty('quests'); // the old flat point-quest list
    expect(data.board).not.toHaveProperty('maxScore');
    expect(data.board).not.toHaveProperty('totalScore');
  });

  it('15. the board correctly reports found/unfound state and totals for a mixed-progress hunt', async () => {
    registerPlayer({ displayName: 'MixedProgress', userId: 'usr-mixed' });
    await qrClaimRoute(claimRequest('usr-mixed', SIGNAL_01.targetCode!));

    const res = await fairDashboardRoute(new Request('http://localhost:3000/api/fair/dashboard'));
    const data = await res.json();
    expect(data.board.totalCount).toBe(20);
    expect(data.board.foundCount).toBe(1);
    const foundSignal = data.board.signals.find((s: any) => s.questId === SIGNAL_01.id);
    const unfoundSignal = data.board.signals.find((s: any) => s.questId !== SIGNAL_01.id);
    expect(foundSignal.found).toBe(true);
    expect(unfoundSignal.found).toBe(false);
  });

  it('a logged-out dashboard fetch still returns the public Mystery Money board without requiring auth', async () => {
    const res = await fairDashboardRoute(new Request('http://localhost:3000/api/fair/dashboard'));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.isAuthenticated).toBe(false);
    expect(data.board.totalCount).toBe(20);
    expect(data.board.totalPoolCents).toBe(30000);
  });

  it('16. server-side guard blocks claims before event start time with HUNT_NOT_OPEN', async () => {
    registerPlayer({ displayName: 'EarlyBird', userId: 'usr-early' });
    updateEvent(SEED_FAIR_EVENT.id, { startTime: '2099-01-01T00:00:00Z', status: 'upcoming' });

    const res = await qrClaimRoute(claimRequest('usr-early', SIGNAL_01.targetCode!));
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.reason).toBe('hunt_not_open');
    expect(data.code).toBe('HUNT_NOT_OPEN');
  });

  it('17. server-side guard blocks claims after event end time with HUNT_CLOSED', async () => {
    registerPlayer({ displayName: 'LateComer', userId: 'usr-late' });
    updateEvent(SEED_FAIR_EVENT.id, { startTime: '2020-01-01T00:00:00Z', endTime: '2020-01-02T00:00:00Z', status: 'ended' });

    const res = await qrClaimRoute(claimRequest('usr-late', SIGNAL_01.targetCode!));
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.reason).toBe('hunt_closed');
    expect(data.code).toBe('HUNT_CLOSED');
  });
});
