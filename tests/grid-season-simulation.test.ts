import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { runSmallSeasonSimulation } from '../scripts/grid-integration-verify';


describe('The Grid: Deterministic Small-Season Multi-Player Simulation', () => {
  const seed = 20260917;

  it('executes a full 72-hour multi-system season with zero invariant violations', () => {
    const report = runSmallSeasonSimulation(cantonFoundingSeasonPackage, {
      seed,
      seasonHours: 72,
      surgeHours: 24,
    });

    expect(report.invariantViolations).toEqual([]);
    expect(report.events.length).toBeGreaterThan(15);
    expect(report.leaderboard).toHaveLength(4);
    expect(report.finalSurgeState).toBe('finished');

    // All players must maintain solvency
    for (const player of report.players) {
      expect(player.credits).toBeGreaterThanOrEqual(0);
      expect(player.influence).toBeGreaterThanOrEqual(0);
      expect(player.commandPoints).toBeGreaterThanOrEqual(0);
      expect(player.ownedTerritories.length).toBeGreaterThanOrEqual(1);
    }

    // Conservation of territories
    let totalClaimed = 0;
    for (const [, owner] of Object.entries(report.territoryOwnership)) {
      if (owner !== null) totalClaimed += 1;
    }
    const sumPlayerTerritories = report.players.reduce((sum, p) => sum + p.ownedTerritories.length, 0);
    expect(sumPlayerTerritories).toBe(totalClaimed);
  });

  it('guarantees 100% bit-for-bit reproducibility for identical seeds', () => {
    const run1 = runSmallSeasonSimulation(cantonFoundingSeasonPackage, { seed, seasonHours: 72 });
    const run2 = runSmallSeasonSimulation(cantonFoundingSeasonPackage, { seed, seasonHours: 72 });

    expect(run1).toEqual(run2);
  });

  it('produces diverging simulation trajectories for different seeds', () => {
    const runA = runSmallSeasonSimulation(cantonFoundingSeasonPackage, { seed: 1001, seasonHours: 72 });
    const runB = runSmallSeasonSimulation(cantonFoundingSeasonPackage, { seed: 9999, seasonHours: 72 });

    expect(runA.events).not.toEqual(runB.events);
  });

  it('verifies auction settlement successfully transfers property to synthetic winner', () => {
    const report = runSmallSeasonSimulation(cantonFoundingSeasonPackage, { seed, seasonHours: 72 });
    const auctionEvents = report.events.filter((e) => e.type === 'auction_settled');

    expect(auctionEvents.length).toBeGreaterThanOrEqual(1);
    const settled = auctionEvents[0];
    const winnerId = settled.details.winnerId as string;
    const propertySlug = settled.details.propertySlug as string;

    expect(report.propertyOwnership[propertySlug]).toBe(winnerId);
    const winner = report.players.find((p) => p.id === winnerId);
    expect(winner?.ownedProperties).toContain(propertySlug);
  });

  it('verifies Surge finale transition triggers at scheduled threshold', () => {
    const report = runSmallSeasonSimulation(cantonFoundingSeasonPackage, { seed, seasonHours: 72, surgeHours: 24 });
    const surgeEvent = report.events.find((e) => e.type === 'surge_started');

    expect(surgeEvent).toBeDefined();
    expect(surgeEvent?.hour).toBe(48); // 72 - 24 = 48
  });
});
