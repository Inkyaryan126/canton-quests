/**
 * Canton Quests — Fair QR Hunt core content & pure-logic coverage.
 *
 * These tests exercise lib/fair-hunt.ts and lib/quest-rewards.ts directly —
 * no routes, no auth, no DB — so the Fair's content shape (20 core Signals,
 * unique target codes) and its timezone-aware window rules are pinned
 * independently of how any particular API route wires them together.
 *
 * REDESIGN (2026-09-01): the old points/XP/max-score assertions that used
 * to live here (100 pts/core, 300 pts/bonus, 2,600 max score,
 * computeFairDashboardProgress) are retired along with the point system —
 * see tests/fair-mystery-money-hunt.test.ts for the $300 Mystery Money
 * Hunt's own coverage. The 2 daily-bonus Signals are now permanently
 * status: 'inactive' (retired, not part of the Mystery Money game); their
 * old date-window-specific tests are replaced below with a single
 * "always offline regardless of date" assertion.
 */
import { describe, it, expect } from 'vitest';
import { SEED_FAIR_QUESTS } from '../lib/seed-data';
import { getQuestAvailability } from '../lib/quest-rewards';
import {
  CORE_QR_COUNT,
  DAILY_BONUS_COUNT,
  FAIR_BONUS_DATES,
  getFairDateKey,
  getFairOperationPhase,
  isFairCoreQuest,
  isFairBonusQuest,
} from '../lib/fair-hunt';
import { Quest, QuestEvent } from '../lib/types';

const coreQuests = SEED_FAIR_QUESTS.filter(isFairCoreQuest);
const bonusQuests = SEED_FAIR_QUESTS.filter(isFairBonusQuest);

describe('Fair QR Hunt content shape', () => {
  it('1. has exactly 20 core Signal records', () => {
    expect(coreQuests).toHaveLength(20);
    expect(coreQuests).toHaveLength(CORE_QR_COUNT);
  });

  it('2. has exactly 2 daily bonus Signal records (retired), one per legacy Fair date (Sept 4-5)', () => {
    expect(bonusQuests).toHaveLength(2);
    expect(bonusQuests).toHaveLength(DAILY_BONUS_COUNT);
    const slugs = bonusQuests.map((q) => q.slug).sort();
    expect(slugs).toEqual(FAIR_BONUS_DATES.map((d) => `fair-bonus-${d}`).sort());
  });

  it('every daily bonus Signal is permanently retired (status: inactive), regardless of the legacy date it was seeded for', () => {
    for (const quest of bonusQuests) {
      expect(quest.status).toBe('inactive');
    }
  });

  it('no core or bonus Fair quest carries a legacy point/XP value — the $300 Mystery Money Hunt is a fully separate mechanism', () => {
    for (const quest of SEED_FAIR_QUESTS) {
      expect(quest.pointValue).toBe(0);
      expect(quest.xpReward).toBe(0);
    }
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

describe('Retired daily bonus Signals are offline regardless of date', () => {
  it('a daily bonus Signal is unavailable ("inactive") no matter what date is checked — status is checked before any time window', () => {
    const sept4Bonus = bonusQuests.find((q) => q.slug === 'fair-bonus-2026-09-04')!;
    const beforeItsLegacyDate = getQuestAvailability(sept4Bonus, new Date('2026-09-03T20:00:00Z'));
    const duringItsLegacyDate = getQuestAvailability(sept4Bonus, new Date('2026-09-04T18:00:00Z'));
    const afterItsLegacyDate = getQuestAvailability(sept4Bonus, new Date('2026-09-05T05:00:00Z'));

    for (const availability of [beforeItsLegacyDate, duringItsLegacyDate, afterItsLegacyDate]) {
      expect(availability.ok).toBe(false);
      if (!availability.ok) expect(availability.reason).toBe('inactive');
    }
  });
});

describe('Fair QR Hunt core Signal timing (America/New_York)', () => {
  it('an inactive Signal cannot award, regardless of its time window', () => {
    const deactivated: Quest = { ...coreQuests[0], status: 'inactive' };
    const availability = getQuestAvailability(deactivated, new Date('2026-09-04T12:00:00Z'));
    expect(availability.ok).toBe(false);
    if (!availability.ok) expect(availability.reason).toBe('inactive');
  });

  it('a core Signal is available any time inside the whole Fair window', () => {
    const core = coreQuests[0];
    expect(getQuestAvailability(core, new Date('2026-09-04T04:00:00Z')).ok).toBe(true);
    expect(getQuestAvailability(core, new Date('2026-09-05T12:00:00Z')).ok).toBe(true);
    expect(getQuestAvailability(core, new Date('2026-09-06T03:59:00Z')).ok).toBe(true);
  });

  it('the timezone-aware date-key helper still correctly resolves America/New_York calendar days (used for admin/display purposes)', () => {
    // 2026-09-05T02:00:00Z is still Sept 4 evening in America/New_York
    // (UTC-4) — a naive `new Date().toISOString().slice(0,10)` would
    // misreport this instant as "2026-09-05"; the real ET calendar day is
    // "2026-09-04".
    const lateNightEt = new Date('2026-09-05T02:00:00Z');
    expect(getFairDateKey(lateNightEt)).toBe('2026-09-04');
  });

  it('every core Signal is expired once the Fair window has passed', () => {
    const afterFairEnds = new Date('2026-09-10T00:00:00Z');
    for (const quest of coreQuests) {
      const availability = getQuestAvailability(quest, afterFairEnds);
      expect(availability.ok).toBe(false);
    }
  });

  it('no core Signal is available before the Fair opens', () => {
    const beforeFairOpens = new Date('2026-08-15T00:00:00Z');
    for (const quest of coreQuests) {
      const availability = getQuestAvailability(quest, beforeFairOpens);
      expect(availability.ok).toBe(false);
    }
  });
});

describe('Fair Operation phase', () => {
  const event: Pick<QuestEvent, 'startTime' | 'endTime'> = {
    startTime: '2026-09-04T04:00:00Z',
    endTime: '2026-09-06T03:59:59Z',
  };

  it('is pre_launch before Sept 4, active during the Fair, and ended after Sept 5', () => {
    expect(getFairOperationPhase(event, new Date('2026-08-26T00:00:00Z'))).toBe('pre_launch');
    expect(getFairOperationPhase(event, new Date('2026-09-04T12:00:00Z'))).toBe('active');
    expect(getFairOperationPhase(event, new Date('2026-09-10T00:00:00Z'))).toBe('ended');
  });
});
