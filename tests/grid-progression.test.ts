import { describe, expect, it } from 'vitest';
import {
  applyGridStatDelta,
  applyGridStatPatch,
  buildGridProgressionSnapshot,
  computeGridRating,
  createEmptyGridProgressionStats,
  deriveGridTitles,
  GRID_STAT_DEFINITIONS,
} from '../lib/grid/core/progression';

describe('Grid progression and ranking', () => {
  it('defines the full player stat surface including scrimmage and legacy play', () => {
    const keys = new Set(GRID_STAT_DEFINITIONS.map(({ key }) => key));

    for (const key of [
      'xp',
      'reputation',
      'missionScore',
      'exploration',
      'signalFinds',
      'intel',
      'territoryControl',
      'propertyValue',
      'netWorth',
      'influence',
      'scrimmageRating',
      'scrimmageWins',
      'strategyRating',
      'districtMastery',
      'cityMastery',
      'leadership',
      'teamwork',
      'bountyScore',
      'heat',
      'wantedLevel',
      'survivalStreak',
      'attendanceStreak',
      'eventWins',
      'legacyScore',
    ]) {
      expect(keys.has(key as any)).toBe(true);
    }
  });

  it('keeps a one-dimensional grinder below a broadly accomplished player', () => {
    const grinder = createEmptyGridProgressionStats();
    grinder.xp = 999999;
    grinder.reputation = 999999;
    grinder.seasonScore = 999999;

    const balanced = createEmptyGridProgressionStats();
    Object.assign(balanced, {
      xp: 12500,
      reputation: 5000,
      seasonScore: 5000,
      missionScore: 7500,
      missionsCompleted: 75,
      exploration: 5000,
      signalFinds: 125,
      intel: 5000,
      territoryControl: 5000,
      territoriesCaptured: 50,
      propertyValue: 125000,
      netWorth: 250000,
      scrimmageRating: 1000,
      scrimmageWins: 50,
      strategyRating: 1000,
      leadership: 2500,
      teamwork: 2500,
      legacyScore: 5000,
    });

    expect(computeGridRating(balanced)).toBeGreaterThan(computeGridRating(grinder));
  });

  it('tracks losses and heat without rewarding them in overall ranking', () => {
    const clean = createEmptyGridProgressionStats();
    const noisy = applyGridStatPatch(clean, {
      scrimmageLosses: 999,
      heat: 100,
      wantedLevel: 5,
    });

    expect(computeGridRating(noisy)).toBe(computeGridRating(clean));
    expect(noisy.heat).toBe(100);
    expect(noisy.wantedLevel).toBe(5);
  });

  it('clamps percent and gauge stats while allowing counters to grow beyond soft caps', () => {
    const stats = applyGridStatPatch(createEmptyGridProgressionStats(), {
      accuracyRating: 140,
      cityMastery: 180,
      wantedLevel: 50,
      xp: 1000000,
    });

    expect(stats.accuracyRating).toBe(100);
    expect(stats.cityMastery).toBe(100);
    expect(stats.wantedLevel).toBe(5);
    expect(stats.xp).toBe(1000000);
  });

  it('applies stat deltas without permitting negative totals', () => {
    const stats = applyGridStatDelta(
      { scrimmageWins: 4, winStreak: 3, reputation: 20 },
      { scrimmageWins: 1, winStreak: -99, reputation: -5 },
    );

    expect(stats.scrimmageWins).toBe(5);
    expect(stats.winStreak).toBe(0);
    expect(stats.reputation).toBe(15);
  });

  it('derives identity titles from the way a player actually plays', () => {
    const { titles, primaryTitle } = deriveGridTitles({
      exploration: 9000,
      signalFinds: 200,
      propertyValue: 130000,
    });

    expect(titles).toContain('The Cartographer');
    expect(titles).toContain('Signal Hunter');
    expect(titles).toContain('Land Baron');
    expect(primaryTitle).toBe('The Cartographer');
  });

  it('builds a deterministic snapshot with level, category scores, rating, and titles', () => {
    const snapshot = buildGridProgressionSnapshot({
      xp: 5000,
      scrimmageRating: 1500,
      scrimmageWins: 60,
      strategyRating: 1200,
      legacyScore: 8000,
    });

    expect(snapshot.version).toBe(1);
    expect(snapshot.totalXp).toBe(5000);
    expect(snapshot.level).toBe(21);
    expect(snapshot.gridRating).toBeGreaterThan(0);
    expect(snapshot.categoryScores.competitive).toBeGreaterThan(0);
    expect(snapshot.titles).toContain('Untouchable');
    expect(snapshot.titles).toContain('Grid Legend');
    expect(buildGridProgressionSnapshot(snapshot.stats)).toEqual(snapshot);
  });
});
