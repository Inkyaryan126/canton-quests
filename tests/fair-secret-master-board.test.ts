/**
 * Canton Quests — Fair Mystery Money production activation coverage.
 *
 * Covers the 18 proofs required for the admin Secret Master Board
 * (app/admin/fair-qr) plus the map-center correction and a concurrent-claim
 * regression, all against the real route handlers and the local/offline
 * engine — same harness pattern as tests/fair-mystery-money-hunt.test.ts,
 * which already covers the public claim-flow/board security proofs this
 * file does not repeat.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { resetGameEngineStore, initializeGameEngine, registerPlayer, updateQuest, getQuestsForEvent, updateEvent } from '../lib/game-engine';
import { SEED_EVENT, SEED_FAIR_EVENT, SEED_FAIR_QUESTS, SEED_FAIR_MYSTERY_PRIZES } from '../lib/seed-data';
import { isFairCoreQuest, parseMysterySignalNumber, CORE_QR_COUNT, MYSTERY_TOTAL_POOL_CENTS } from '../lib/fair-hunt';
import { GET as adminFairQrGet, POST as adminFairQrPost } from '../app/api/admin/fair-qr/route';
import { POST as qrClaimRoute } from '../app/api/qr/claim/route';
import { FAIR_MAP_CENTER } from '../components/FairLiveMap';

const GM_HEADERS = { 'x-admin-key': 'canton-gm-2026' };

function widenAllCoreSignalWindows() {
  updateEvent(SEED_FAIR_EVENT.id, { startTime: undefined, endTime: undefined, status: 'active', isPaused: false });
  for (const quest of SEED_FAIR_QUESTS.filter(isFairCoreQuest)) {
    updateQuest(quest.id, { startsAt: undefined, expiresAt: undefined });
  }
}

function adminGetRequest(authed = true): Request {
  return new Request('http://localhost:3000/api/admin/fair-qr', { headers: authed ? GM_HEADERS : {} });
}

function adminPostRequest(body: Record<string, unknown>, authed = true): Request {
  return new Request('http://localhost:3000/api/admin/fair-qr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authed ? GM_HEADERS : {}) },
    body: JSON.stringify(body),
  });
}

function authedClaimRequest(userId: string, code: string): Request {
  return new Request('http://localhost:3000/api/qr/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer mock-jwt-${userId}` },
    body: JSON.stringify({ code }),
  });
}

async function getAdminData() {
  const res = await adminFairQrGet(adminGetRequest());
  return { status: res.status, data: await res.json() };
}

const coreQuests = SEED_FAIR_QUESTS.filter(isFairCoreQuest);
const SIGNAL_01 = coreQuests.find((q) => q.slug === 'fair-core-01')!;
const SIGNAL_08 = coreQuests.find((q) => q.slug === 'fair-core-08')!;
const SIGNAL_11 = coreQuests.find((q) => q.slug === 'fair-core-11')!;
const cents = (slug: string) => SEED_FAIR_MYSTERY_PRIZES.find((p) => p.questId === coreQuests.find((q) => q.slug === slug)!.id)!.cashCents;

describe('Secret Master Board — admin API', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
    widenAllCoreSignalWindows();
  });

  it('1. board positions are permanently 01-20 — every core Signal parses to a unique number in that exact range', () => {
    const numbers = coreQuests.map((q) => parseMysterySignalNumber(q.slug)).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(numbers).toEqual(Array.from({ length: CORE_QR_COUNT }, (_, i) => i + 1));
  });

  it('2. the board never shuffles — claiming, placing, and deactivating a Signal does not change any quest\'s board-position number', async () => {
    const before = await getAdminData();
    const beforeNumbers = new Map(
      before.data.quests.filter((q: any) => q.category === 'fair_core').map((q: any) => [q.id, parseMysterySignalNumber(q.slug)])
    );

    registerPlayer({ displayName: 'Shuffle Test', userId: 'usr-shuffle' });
    await qrClaimRoute(authedClaimRequest('usr-shuffle', SIGNAL_08.targetCode!));
    await adminFairQrPost(adminPostRequest({ questId: SIGNAL_01.id, action: 'update_placement', gmNotes: 'Funnel cake stand' }));
    await adminFairQrPost(adminPostRequest({ questId: SIGNAL_11.id, action: 'set_status', status: 'inactive' }));

    const after = await getAdminData();
    for (const quest of after.data.quests.filter((q: any) => q.category === 'fair_core')) {
      expect(parseMysterySignalNumber(quest.slug)).toBe(beforeNumbers.get(quest.id));
    }
  });

  it('3. Signal 01 is $50 admin-side', async () => {
    const { data } = await getAdminData();
    const row = data.quests.find((q: any) => q.slug === 'fair-core-01');
    expect(row.cashValueCents).toBe(5000);
    expect(cents('fair-core-01')).toBe(5000);
  });

  it('4. Signal 08 is $30 admin-side', async () => {
    const { data } = await getAdminData();
    const row = data.quests.find((q: any) => q.slug === 'fair-core-08');
    expect(row.cashValueCents).toBe(3000);
    expect(cents('fair-core-08')).toBe(3000);
  });

  it('5. Signal 11 is $30 admin-side', async () => {
    const { data } = await getAdminData();
    const row = data.quests.find((q: any) => q.slug === 'fair-core-11');
    expect(row.cashValueCents).toBe(3000);
    expect(cents('fair-core-11')).toBe(3000);
  });

  it('8. admin sees the hidden cash value for an UNFOUND Signal (unlike the public board)', async () => {
    const { data } = await getAdminData();
    const row = data.quests.find((q: any) => q.slug === 'fair-core-01');
    expect(row.found).toBe(false);
    expect(row.cashValueCents).toBe(5000);
  });

  it('9. admin can see placement details and the cash value together on the same record', async () => {
    await adminFairQrPost(
      adminPostRequest({
        questId: SIGNAL_01.id,
        action: 'update_placement',
        gmNotes: 'Funnel cake stand, north post',
        placementDetails: { description: 'Behind the funnel cake stand', setupNotes: 'Laminated card, zip-tied' },
      })
    );
    const { data } = await getAdminData();
    const row = data.quests.find((q: any) => q.slug === 'fair-core-01');
    expect(row.cashValueCents).toBe(5000);
    expect(row.gmNotes).toBe('Funnel cake stand, north post');
    expect(row.placementDetails.description).toBe('Behind the funnel cake stand');
  });

  it('10/11/12. claimed total, hidden total, and their sum are correct at every stage of the hunt', async () => {
    const zero = await getAdminData();
    expect(zero.data.mysteryMoney.totalClaimedCents).toBe(0);
    expect(zero.data.mysteryMoney.totalRemainingCents).toBe(MYSTERY_TOTAL_POOL_CENTS);
    expect(zero.data.mysteryMoney.totalClaimedCents + zero.data.mysteryMoney.totalRemainingCents).toBe(30000);

    registerPlayer({ displayName: 'Claimer', userId: 'usr-claimer' });
    await qrClaimRoute(authedClaimRequest('usr-claimer', SIGNAL_01.targetCode!)); // $50
    await qrClaimRoute(authedClaimRequest('usr-claimer', SIGNAL_08.targetCode!)); // $30

    const mid = await getAdminData();
    expect(mid.data.mysteryMoney.totalClaimedCents).toBe(5000 + 3000);
    expect(mid.data.mysteryMoney.totalRemainingCents).toBe(30000 - 8000);
    expect(mid.data.mysteryMoney.totalClaimedCents + mid.data.mysteryMoney.totalRemainingCents).toBe(30000);

    for (const quest of coreQuests) {
      if (quest.slug === 'fair-core-01' || quest.slug === 'fair-core-08') continue;
      // eslint-disable-next-line no-await-in-loop
      await qrClaimRoute(authedClaimRequest('usr-claimer', quest.targetCode!));
    }
    const full = await getAdminData();
    expect(full.data.mysteryMoney.totalClaimedCents).toBe(30000);
    expect(full.data.mysteryMoney.totalRemainingCents).toBe(0);
    expect(full.data.mysteryMoney.signalsFound).toBe(20);
  });

  it('13. exactly 20 board squares\' worth of data exist — one fair_core row per Signal, positions 1-20 with no gap or duplicate', async () => {
    const { data } = await getAdminData();
    const coreRows = data.quests.filter((q: any) => q.category === 'fair_core');
    expect(coreRows).toHaveLength(20);
    const numbers = coreRows.map((q: any) => parseMysterySignalNumber(q.slug)).sort((a: number, b: number) => a - b);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('14. bonus quests never carry Mystery Money fields — they cannot render as Mystery Money squares', async () => {
    const { data } = await getAdminData();
    const bonusRows = data.quests.filter((q: any) => q.category === 'fair_bonus');
    expect(bonusRows.length).toBeGreaterThan(0);
    for (const row of bonusRows) {
      expect(row.cashValueCents).toBeUndefined();
      expect(row.found).toBeUndefined();
      expect('finderDisplayName' in row).toBe(false);
    }
  });

  it('15. a request without admin credentials is denied (401) and leaks no quest or Mystery Money data', async () => {
    const res = await adminFairQrGet(adminGetRequest(false));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.quests).toBeUndefined();
    expect(data.mysteryMoney).toBeUndefined();
  });

  it('15b. an unauthenticated admin POST is also denied and cannot mutate placement or status', async () => {
    const res = await adminFairQrPost(adminPostRequest({ questId: SIGNAL_01.id, action: 'set_status', status: 'inactive' }, false));
    expect(res.status).toBe(401);
    const { data } = await getAdminData();
    const row = data.quests.find((q: any) => q.slug === 'fair-core-01');
    expect(row.status).toBe('active');
  });

  it('16. physical placement edits never alter board ordering or the prize value', async () => {
    const beforeNumber = parseMysterySignalNumber(SIGNAL_08.slug);
    await adminFairQrPost(
      adminPostRequest({
        questId: SIGNAL_08.id,
        action: 'update_placement',
        placementDetails: { description: 'Midway, west entrance railing', latitude: 40.802, longitude: -81.408 },
      })
    );
    await adminFairQrPost(adminPostRequest({ questId: SIGNAL_08.id, action: 'mark_placed' }));

    const { data } = await getAdminData();
    const row = data.quests.find((q: any) => q.slug === 'fair-core-08');
    expect(parseMysterySignalNumber(row.slug)).toBe(beforeNumber);
    expect(row.cashValueCents).toBe(3000);
    expect(row.placementDetails.description).toBe('Midway, west entrance railing');
    expect(row.placedAt).toBeTruthy();
  });

  it('17. Founder\'s Cipher quest rewards are never touched by any Fair admin or claim action', async () => {
    // Read live runtime state (not the static SEED_QUESTS constant, which
    // initializeGameEngine only ever copies FROM, never mutates) both
    // before and after a batch of real Fair actions.
    const beforeRewards = getQuestsForEvent(SEED_EVENT.id).map((q) => ({ id: q.id, pointValue: q.pointValue, xpReward: q.xpReward }));
    expect(beforeRewards.length).toBeGreaterThan(0);
    expect(beforeRewards.some((q) => q.pointValue > 0)).toBe(true);

    registerPlayer({ displayName: 'Isolation Check', userId: 'usr-isolation' });
    await qrClaimRoute(authedClaimRequest('usr-isolation', SIGNAL_01.targetCode!));
    await adminFairQrPost(adminPostRequest({ questId: SIGNAL_08.id, action: 'update_placement', gmNotes: 'test' }));
    await adminFairQrPost(adminPostRequest({ questId: SIGNAL_11.id, action: 'set_status', status: 'inactive' }));

    const afterRewards = new Map(getQuestsForEvent(SEED_EVENT.id).map((q) => [q.id, q]));
    for (const before of beforeRewards) {
      const current = afterRewards.get(before.id)!;
      expect(current.pointValue).toBe(before.pointValue);
      expect(current.xpReward).toBe(before.xpReward);
    }
    expect(SEED_EVENT.id).not.toBe(SEED_FAIR_EVENT.id);
  });

  it('18. the corrected Fair event map center matches FairLiveMap.tsx\'s FAIR_MAP_CENTER exactly', () => {
    expect(SEED_FAIR_EVENT.mapCenterLat).toBe(FAIR_MAP_CENTER.lat);
    expect(SEED_FAIR_EVENT.mapCenterLon).toBe(FAIR_MAP_CENTER.lng);
    expect(SEED_FAIR_EVENT.mapCenterLat).toBe(40.80192286342209);
    expect(SEED_FAIR_EVENT.mapCenterLon).toBe(-81.40825970719298);
  });

  it('the Fair map-center correction does not touch Founder\'s Cipher\'s own event coordinates', () => {
    expect(SEED_EVENT.mapCenterLat).toBe(40.7989);
    expect(SEED_EVENT.mapCenterLon).toBe(-81.3748);
  });
});

describe('Claim flow regression — concurrent first claim', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
    widenAllCoreSignalWindows();
  });

  it('two simultaneous first claims for the same Signal: exactly one wins, the other is told it is already claimed', async () => {
    registerPlayer({ displayName: 'RacerA', userId: 'usr-racer-a' });
    registerPlayer({ displayName: 'RacerB', userId: 'usr-racer-b' });

    const [resA, resB] = await Promise.all([
      qrClaimRoute(authedClaimRequest('usr-racer-a', SIGNAL_01.targetCode!)),
      qrClaimRoute(authedClaimRequest('usr-racer-b', SIGNAL_01.targetCode!)),
    ]);
    const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);

    const outcomes = [dataA, dataB];
    const winners = outcomes.filter((d) => d.success && d.reason === 'signal_secured');
    const losers = outcomes.filter((d) => !d.success && d.reason === 'signal_already_found');

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].winnerDisplayName).toBe(winners[0].winnerDisplayName);
    expect(losers[0].cashCents).toBe(winners[0].cashCents);
  });
});
