/**
 * Canton Quests — Fair QR Hunt core content & pure-logic coverage.
 *
 * These tests exercise lib/fair-hunt.ts and lib/quest-rewards.ts directly —
 * no routes, no auth, no DB — so the Fair's content shape (20 core QRs, 7
 * daily bonus QRs, correct point values) and its timezone-aware window
 * rules are pinned independently of how any particular API route wires
 * them together.
 */
import { describe, it, expect } from 'vitest';
import { SEED_FAIR_QUESTS } from '../lib/seed-data';
import { getQuestAvailability } from '../lib/quest-rewards';
import {
  CORE_QR_COUNT,
  CORE_QR_POINTS,
  DAILY_BONUS_COUNT,
  DAILY_BONUS_POINTS,
  MAX_CORE_SCORE,
  MAX_BONUS_SCORE,
  MAX_FAIR_SCORE,
  FAIR_BONUS_DATES,
  computeFairDashboardProgress,
  getFairDateKey,
  getFairOperationPhase,
  isFairCoreQuest,
  isFairBonusQuest,
} from '../lib/fair-hunt';
import { Quest, QuestEvent } from '../lib/types';

const coreQuests = SEED_FAIR_QUESTS.filter(isFairCoreQuest);
const bonusQuests = SEED_FAIR_QUESTS.filter(isFairBonusQuest);

describe('Fair QR Hunt content shape', () => {
  it('1. has exactly 20 core QR records', () => {
    expect(coreQuests).toHaveLength(20);
    expect(coreQuests).toHaveLength(CORE_QR_COUNT);
  });

  it('2. has exactly 7 daily bonus QR records, one per Fair date', () => {
    expect(bonusQuests).toHaveLength(7);
    expect(bonusQuests).toHaveLength(DAILY_BONUS_COUNT);
    const slugs = bonusQuests.map((q) => q.slug).sort();
    expect(slugs).toEqual(FAIR_BONUS_DATES.map((d) => `fair-bonus-${d}`).sort());
  });

  it('3. every core QR awards 100 points', () => {
    for (const quest of coreQuests) {
      expect(quest.pointValue).toBe(100);
      expect(quest.pointValue).toBe(CORE_QR_POINTS);
    }
  });

  it('4. every daily bonus QR awards 300 points', () => {
    for (const quest of bonusQuests) {
      expect(quest.pointValue).toBe(300);
      expect(quest.pointValue).toBe(DAILY_BONUS_POINTS);
    }
  });

  it('score structure totals: 2,000 core + 2,100 bonus = 4,100 max', () => {
    expect(MAX_CORE_SCORE).toBe(2000);
    expect(MAX_BONUS_SCORE).toBe(2100);
    expect(MAX_FAIR_SCORE).toBe(4100);
  });

  it('every Fair quest has drawing_entry_reward = 0 — no accidental Sept 11 Entry Token', () => {
    for (const quest of SEED_FAIR_QUESTS) {
      expect(quest.drawingEntryReward).toBe(0);
    }
  });

  it('every Fair quest has no starting path (Family/Challenge/Secret never required)', () => {
    for (const quest of SEED_FAIR_QUESTS) {
      expect(quest.startingPath).toBeUndefined();
    }
  });

  it('every Fair quest has a unique target_code', () => {
    const codes = SEED_FAIR_QUESTS.map((q) => q.targetCode);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('Fair QR Hunt daily bonus timing (America/New_York)', () => {
  it('11. a daily bonus is unavailable before its date', () => {
    const sept2Bonus = bonusQuests.find((q) => q.slug === 'fair-bonus-2026-09-02')!;
    const beforeItsDayInET = new Date('2026-09-01T20:00:00Z'); // Sept 1, 4pm ET — still Sept 1 in NY
    const availability = getQuestAvailability(sept2Bonus, beforeItsDayInET);
    expect(availability.ok).toBe(false);
    if (!availability.ok) expect(availability.reason).toBe('not_yet_active');
  });

  it('12. a daily bonus is unavailable after its date', () => {
    const sept2Bonus = bonusQuests.find((q) => q.slug === 'fair-bonus-2026-09-02')!;
    const afterItsDayInET = new Date('2026-09-03T05:00:00Z'); // Sept 3, 1am ET — already Sept 3 in NY
    const availability = getQuestAvailability(sept2Bonus, afterItsDayInET);
    expect(availability.ok).toBe(false);
    if (!availability.ok) expect(availability.reason).toBe('expired');
  });

  it('13. a daily bonus is available during its correct America/New_York date, including near-midnight UTC edge cases a naive UTC slice would get wrong', () => {
    const sept2Bonus = bonusQuests.find((q) => q.slug === 'fair-bonus-2026-09-02')!;
    // 2026-09-02T02:00:00Z is still Sept 1 evening in America/New_York (UTC-4)
    // — a naive `new Date().toISOString().slice(0,10)` would misreport this
    // instant as "2026-09-02"; the real ET calendar day is "2026-09-01".
    const lateNightEt = new Date('2026-09-02T02:00:00Z');
    expect(getFairDateKey(lateNightEt)).toBe('2026-09-01');

    const middayOnSept2 = new Date('2026-09-02T18:00:00Z'); // 2pm ET
    expect(getFairDateKey(middayOnSept2)).toBe('2026-09-02');
    const availability = getQuestAvailability(sept2Bonus, middayOnSept2);
    expect(availability.ok).toBe(true);
  });

  it('14. an inactive QR cannot award, regardless of its time window', () => {
    const deactivated: Quest = { ...coreQuests[0], status: 'inactive' };
    const availability = getQuestAvailability(deactivated, new Date('2026-09-03T12:00:00Z'));
    expect(availability.ok).toBe(false);
    if (!availability.ok) expect(availability.reason).toBe('inactive');
  });

  it('a core QR is available any time inside the whole Fair window', () => {
    const core = coreQuests[0];
    expect(getQuestAvailability(core, new Date('2026-09-01T04:00:00Z')).ok).toBe(true);
    expect(getQuestAvailability(core, new Date('2026-09-04T12:00:00Z')).ok).toBe(true);
    expect(getQuestAvailability(core, new Date('2026-09-08T03:59:00Z')).ok).toBe(true);
  });

  it('19. Operation end blocks new claims — every Fair quest is expired once the Fair window has passed', () => {
    const afterFairEnds = new Date('2026-09-10T00:00:00Z');
    for (const quest of SEED_FAIR_QUESTS) {
      const availability = getQuestAvailability(quest, afterFairEnds);
      expect(availability.ok).toBe(false);
    }
  });

  it('no Fair quest is available before the Fair opens', () => {
    const beforeFairOpens = new Date('2026-08-15T00:00:00Z');
    for (const quest of SEED_FAIR_QUESTS) {
      const availability = getQuestAvailability(quest, beforeFairOpens);
      expect(availability.ok).toBe(false);
    }
  });
});

describe('Fair Operation phase', () => {
  const event: Pick<QuestEvent, 'startTime' | 'endTime'> = {
    startTime: '2026-09-01T04:00:00Z',
    endTime: '2026-09-08T03:59:59Z',
  };

  it('is pre_launch before Sept 1, active during the Fair, and ended after Sept 7', () => {
    expect(getFairOperationPhase(event, new Date('2026-08-26T00:00:00Z'))).toBe('pre_launch');
    expect(getFairOperationPhase(event, new Date('2026-09-04T12:00:00Z'))).toBe('active');
    expect(getFairOperationPhase(event, new Date('2026-09-10T00:00:00Z'))).toBe('ended');
  });
});

describe('20. Fair dashboard progress counting', () => {
  it('counts core/bonus found, remaining, and score correctly for a mixed-progress player', () => {
    const claimed = new Set([coreQuests[0].id, coreQuests[1].id, bonusQuests[0].id]);
    const progress = computeFairDashboardProgress(SEED_FAIR_QUESTS, claimed);

    expect(progress.coreFoundCount).toBe(2);
    expect(progress.coreTotalCount).toBe(20);
    expect(progress.coreScore).toBe(200);
    expect(progress.bonusFoundCount).toBe(1);
    expect(progress.bonusTotalCount).toBe(7);
    expect(progress.bonusScore).toBe(300);
    expect(progress.totalFoundCount).toBe(3);
    expect(progress.totalScore).toBe(500);
    expect(progress.maxScore).toBe(4100);
  });

  it('21. a zero-score Fair participant (entered, nothing claimed yet) displays correctly, not as an error', () => {
    const progress = computeFairDashboardProgress(SEED_FAIR_QUESTS, new Set());

    expect(progress.coreFoundCount).toBe(0);
    expect(progress.bonusFoundCount).toBe(0);
    expect(progress.totalFoundCount).toBe(0);
    expect(progress.totalScore).toBe(0);
    expect(progress.coreTotalCount).toBe(20);
    expect(progress.bonusTotalCount).toBe(7);
  });

  it('a player who found every Signal hits the true maximum score', () => {
    const everyQuestId = new Set(SEED_FAIR_QUESTS.map((q) => q.id));
    const progress = computeFairDashboardProgress(SEED_FAIR_QUESTS, everyQuestId);
    expect(progress.totalScore).toBe(MAX_FAIR_SCORE);
  });
});
