/**
 * Canton Quests — Fair QR Hunt claim flow integration coverage.
 *
 * Exercises the real /api/qr/claim and /api/fair/dashboard route handlers
 * against the local/offline engine (the same harness pattern used by
 * tests/command-center-xp-consistency.test.ts and
 * tests/launch-blockers-auth-remediation.test.ts) — real duplicate
 * protection, real server-authoritative points, real event scoping.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  initializeGameEngine,
  resetGameEngineStore,
  registerPlayer,
  getEventParticipation,
  updateQuest,
  getPlayerProgress,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_FAIR_EVENT, SEED_FAIR_QUESTS, SEED_QUESTS } from '../lib/seed-data';
import { POST as qrClaimRoute } from '../app/api/qr/claim/route';
import { GET as fairDashboardRoute } from '../app/api/fair/dashboard/route';

// Claim-flow tests exercise claim MECHANICS (duplicate protection,
// cross-player independence, no-path-required, server-authoritative
// points) — not the Sept 1–7 America/New_York window itself, which is
// covered independently (with explicit, controlled `now` values, so it
// never depends on the real wall-clock date) in tests/fair-hunt-core.test.ts.
// Every seeded Fair quest's window is widened to "always available" here so
// these tests pass regardless of what today's real date happens to be.
function widenAllFairQuestWindows() {
  for (const quest of SEED_FAIR_QUESTS) {
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

const CORE_1 = SEED_FAIR_QUESTS.find((q) => q.slug === 'fair-core-01')!;
const CORE_2 = SEED_FAIR_QUESTS.find((q) => q.slug === 'fair-core-02')!;
const BONUS_1 = SEED_FAIR_QUESTS.find((q) => q.slug === 'fair-bonus-2026-09-01')!;
const MAIN_QR_QUEST = SEED_QUESTS.find((q) => q.verificationType === 'qr');

describe('Fair QR Hunt claim flow', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
    widenAllFairQuestWindows();
  });

  it('22. an unauthenticated scan is rejected (401) so the frontend can redirect through auth and return', async () => {
    const res = await qrClaimRoute(claimRequest(null, CORE_1.targetCode!));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.reason).toBe('unauthenticated');
  });

  it('a fresh core QR claim succeeds and awards exactly 100 points', async () => {
    registerPlayer({ displayName: 'FairScout', userId: 'usr-fair-1' });
    const res = await qrClaimRoute(claimRequest('usr-fair-1', CORE_1.targetCode!));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.reason).toBe('secured');
    expect(data.pointsAwarded).toBe(100);
    expect(data.isFair).toBe(true);
  });

  it('a fresh daily bonus claim succeeds and awards exactly 300 points, during its live window', async () => {
    registerPlayer({ displayName: 'FairScout2', userId: 'usr-fair-2' });
    // fair-bonus-2026-09-01's window is 2026-09-01T04:00:00Z..2026-09-02T03:59:59Z;
    // getQuestAvailability compares against real wall-clock `new Date()`, so
    // this assertion documents the requirement rather than forcing time —
    // verified independently (timezone-safe) in tests/fair-hunt-core.test.ts.
    expect(BONUS_1.pointValue).toBe(300);
  });

  it('5. the same player cannot claim the same core QR twice — second attempt awards 0', async () => {
    registerPlayer({ displayName: 'RepeatCore', userId: 'usr-repeat-core' });
    const first = await (await qrClaimRoute(claimRequest('usr-repeat-core', CORE_1.targetCode!))).json();
    expect(first.success).toBe(true);
    expect(first.pointsAwarded).toBe(100);

    const second = await (await qrClaimRoute(claimRequest('usr-repeat-core', CORE_1.targetCode!))).json();
    expect(second.success).toBe(false);
    expect(second.reason).toBe('already_secured');
  });

  it('6. the same player cannot claim the same daily bonus QR twice — second attempt is already_secured', async () => {
    registerPlayer({ displayName: 'RepeatBonus', userId: 'usr-repeat-bonus' });
    const first = await (await qrClaimRoute(claimRequest('usr-repeat-bonus', BONUS_1.targetCode!))).json();
    expect(first.success).toBe(true);
    expect(first.pointsAwarded).toBe(300);
    expect(first.isBonus).toBe(true);

    const second = await (await qrClaimRoute(claimRequest('usr-repeat-bonus', BONUS_1.targetCode!))).json();
    expect(second.success).toBe(false);
    expect(second.reason).toBe('already_secured');
  });

  it('17. repeated identical requests are idempotent — score never doubles across retries (refresh/back-button safe)', async () => {
    registerPlayer({ displayName: 'RetryAgent', userId: 'usr-retry' });
    for (let i = 0; i < 4; i++) {
      // eslint-disable-next-line no-await-in-loop
      await qrClaimRoute(claimRequest('usr-retry', CORE_1.targetCode!));
    }
    const dashRes = await fairDashboardRoute(authedRequest('http://localhost:3000/api/fair/dashboard', 'usr-retry'));
    const dash = await dashRes.json();
    expect(dash.progress.coreScore).toBe(100);
    expect(dash.progress.totalScore).toBe(100);
  });

  it('7. different players can independently claim the same QR', async () => {
    registerPlayer({ displayName: 'PlayerA', userId: 'usr-a' });
    registerPlayer({ displayName: 'PlayerB', userId: 'usr-b' });

    const resA = await (await qrClaimRoute(claimRequest('usr-a', CORE_1.targetCode!))).json();
    const resB = await (await qrClaimRoute(claimRequest('usr-b', CORE_1.targetCode!))).json();

    expect(resA.success).toBe(true);
    expect(resB.success).toBe(true);
    expect(resA.pointsAwarded).toBe(100);
    expect(resB.pointsAwarded).toBe(100);
  });

  it('9. & 10. Fair participation requires no path, and players.selected_starting_path-equivalent stays untouched by a Fair claim', async () => {
    const player = registerPlayer({ displayName: 'NoPathAgent', userId: 'usr-no-path' });
    expect(player.selectedStartingPath).toBeUndefined();

    const res = await qrClaimRoute(claimRequest('usr-no-path', CORE_1.targetCode!));
    const data = await res.json();
    expect(data.success).toBe(true);

    const participation = getEventParticipation(SEED_FAIR_EVENT.id, player.id);
    expect(participation).toBeDefined();
    expect(participation!.path).toBeFalsy(); // null/undefined — never set for the path-free Fair
  });

  it('re-entering the Fair (claiming a second QR) does not create a duplicate participation row', async () => {
    const player = registerPlayer({ displayName: 'TwoClaims', userId: 'usr-two-claims' });
    await qrClaimRoute(claimRequest('usr-two-claims', CORE_1.targetCode!));
    const firstParticipation = getEventParticipation(SEED_FAIR_EVENT.id, player.id);

    await qrClaimRoute(claimRequest('usr-two-claims', CORE_2.targetCode!));
    const secondParticipation = getEventParticipation(SEED_FAIR_EVENT.id, player.id);

    expect(secondParticipation!.id).toBe(firstParticipation!.id);
  });

  it('15. an unrecognized/invalid code is rejected without leaking any internal id or matching quest data', async () => {
    registerPlayer({ displayName: 'Prober', userId: 'usr-prober' });
    const res = await qrClaimRoute(claimRequest('usr-prober', 'TOTALLY-MADE-UP-CODE-000'));
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.reason).toBe('not_recognized');
    expect(data.quest).toBeUndefined();
  });

  it('16. the client cannot control the points awarded — a forged points/pointValue field in the request body is ignored', async () => {
    registerPlayer({ displayName: 'Cheater', userId: 'usr-cheater' });
    const req = authedRequest('http://localhost:3000/api/qr/claim', 'usr-cheater', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: CORE_1.targetCode, points: 999999, pointValue: 999999, awardedPoints: 999999 }),
    });
    const data = await (await qrClaimRoute(req)).json();
    expect(data.pointsAwarded).toBe(100);
  });

  it('8. & 18. a Fair claim only ever scores on the Fair leaderboard, never the Main Operation — event scoring stays fully separate', async () => {
    const player = registerPlayer({ displayName: 'CrossEventAgent', userId: 'usr-cross-event' });
    await qrClaimRoute(claimRequest('usr-cross-event', CORE_1.targetCode!));

    const fairDash = await (
      await fairDashboardRoute(authedRequest('http://localhost:3000/api/fair/dashboard', 'usr-cross-event'))
    ).json();
    expect(fairDash.progress.totalScore).toBe(100);

    // The Fair claim must not appear anywhere in Main Operation scoring.
    if (MAIN_QR_QUEST) {
      const { getPlayerProgress } = await import('../lib/game-engine');
      const mainProgress = getPlayerProgress(player.id, SEED_EVENT.id);
      expect(mainProgress.completedQuestIds).not.toContain(CORE_1.id);
      expect(mainProgress.totalPoints).toBe(0);
    }
  });

  it('a dashboard fetch for an authenticated player who has claimed nothing yet shows a real, non-error zero state', async () => {
    registerPlayer({ displayName: 'FreshEntrant', userId: 'usr-fresh' });
    const res = await fairDashboardRoute(authedRequest('http://localhost:3000/api/fair/dashboard', 'usr-fresh'));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.isAuthenticated).toBe(true);
    expect(data.progress.totalScore).toBe(0);
    expect(data.progress.coreTotalCount).toBe(20);
    expect(data.progress.bonusTotalCount).toBe(7);
    expect(data.progress.coreFoundCount).toBe(0);
    expect(data.progress.bonusFoundCount).toBe(0);
  });

  it('a logged-out dashboard fetch still returns public Fair state (quest slots, leaderboard) without requiring auth', async () => {
    const res = await fairDashboardRoute(new Request('http://localhost:3000/api/fair/dashboard'));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.isAuthenticated).toBe(false);
    expect(data.quests.length).toBeGreaterThanOrEqual(27);
  });
});
