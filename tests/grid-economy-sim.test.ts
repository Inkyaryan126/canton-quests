import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { runEconomySimulation } from '../lib/grid/sim/economy-sim';
import { validateGridCityPackage } from '../lib/grid/core/city-package';

const OPTIONS = {
  seed: 20260915,
  playerCount: 6,
  seasonHours: 30 * 24,
  activityCadenceHours: [1, 2, 4, 8, 12, 24],
};

describe('Grid economy simulation', () => {
  it('keeps the tuned Canton package valid', () => {
    expect(validateGridCityPackage(cantonFoundingSeasonPackage)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it('replays the same season identically for the same seed and config', () => {
    const first = runEconomySimulation(cantonFoundingSeasonPackage, OPTIONS);
    const second = runEconomySimulation(cantonFoundingSeasonPackage, OPTIONS);

    expect(first).toEqual(second);
  });

  it('changes the trajectory when the seed changes', () => {
    const first = runEconomySimulation(cantonFoundingSeasonPackage, OPTIONS);
    const second = runEconomySimulation(cantonFoundingSeasonPackage, {
      ...OPTIONS,
      seed: OPTIONS.seed + 1,
    });

    expect(first.events).not.toEqual(second.events);
  });

  it('holds structural ownership, adjacency, and resource invariants for a full season', () => {
    const report = runEconomySimulation(cantonFoundingSeasonPackage, OPTIONS);

    expect(report.invariantViolations).toEqual([]);
    expect(report.totals.claimedTerritories).toBeGreaterThan(0);
    expect(report.totals.acquiredProperties).toBeGreaterThan(0);
    expect(report.totals.developmentLevels).toBeGreaterThan(0);

    for (const player of report.players) {
      expect(player.credits).toBeGreaterThanOrEqual(0);
      expect(player.influence).toBeGreaterThanOrEqual(0);
      expect(player.commandPoints).toBeGreaterThanOrEqual(0);
    }
  });

  it('reports snapshots, saturation milestones, and branch ROI for tuning', () => {
    const report = runEconomySimulation(cantonFoundingSeasonPackage, OPTIONS);
    const claims = report.events.filter((event) => event.type === 'claim');
    const acquisitions = report.events.filter((event) => event.type === 'acquire');

    expect(report.snapshots[0]?.hour).toBe(0);
    expect(report.snapshots[report.snapshots.length - 1]?.hour).toBe(OPTIONS.seasonHours);
    expect(report.branchRoi.commerce.creditsPerHour).toBeGreaterThan(0);
    expect(report.branchRoi.commerce.creditPaybackHours).toBeGreaterThan(0);
    expect(report.branchRoi.fortress.creditPaybackHours).toBeNull();
    expect(report.milestones.allTerritoriesClaimedHour).toBe(
      report.totals.claimedTerritories === cantonFoundingSeasonPackage.territories.length
        ? claims[claims.length - 1]?.hour ?? null
        : null,
    );
    expect(report.milestones.allPropertiesAcquiredHour).toBe(
      report.totals.acquiredProperties === cantonFoundingSeasonPackage.properties.length
        ? acquisitions[acquisitions.length - 1]?.hour ?? null
        : null,
    );
  });

  it('exercises the configured offline accrual cap with slower players', () => {
    const report = runEconomySimulation(cantonFoundingSeasonPackage, OPTIONS);
    const dailyPlayer = report.players.find((player) => player.cadenceHours === 24);

    expect(dailyPlayer).toBeDefined();
    expect(dailyPlayer!.discardedOfflineHours).toBeGreaterThan(0);
  });

  it('gives every simulated player a fair starter opportunity in the six-slot seed', () => {
    const report = runEconomySimulation(cantonFoundingSeasonPackage, OPTIONS);

    expect(report.players).toHaveLength(6);
    expect(report.players.every((player) => player.firstClaimHour !== null)).toBe(true);
    expect(report.events.filter((event) => event.type === 'claim')).toHaveLength(
      report.totals.claimedTerritories,
    );
  });
});
