import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { runEconomySimulation } from '../lib/grid/sim/economy-sim';

const seeds = [20260915, 4242, 1337];
const reports = seeds.map((seed) =>
  runEconomySimulation(cantonFoundingSeasonPackage, {
    seed,
    playerCount: 6,
    seasonHours: 30 * 24,
    activityCadenceHours: [1, 2, 4, 8, 12, 24],
  }),
);

for (const report of reports) {
  console.log('\nSeed', report.seed);
  console.log('totals', report.totals);
  console.log('concentration', report.concentration);
  console.log('milestones', report.milestones);
  console.log('branchRoi', report.branchRoi);
  console.log('invariantViolations', report.invariantViolations);
  console.table(
    report.players.map((player) => ({
      player: player.playerId,
      cadenceH: player.cadenceHours,
      credits: player.credits,
      influence: player.influence,
      territories: player.territories,
      properties: player.properties,
      developed: player.developedProperties,
      offlineLostH: player.discardedOfflineHours,
      firstClaimH: player.firstClaimHour,
      firstPropertyH: player.firstPropertyHour,
      firstUpgradeH: player.firstUpgradeHour,
      firstSkylineH: player.firstSkylineHour,
    })),
  );
}

const avg = (values: number[]) =>
  Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

console.log('\nThree-seed averages');
console.log({
  credits: avg(reports.map((report) => report.totals.credits)),
  influence: avg(reports.map((report) => report.totals.influence)),
  claimedTerritories: avg(
    reports.map((report) => report.totals.claimedTerritories),
  ),
  acquiredProperties: avg(
    reports.map((report) => report.totals.acquiredProperties),
  ),
  developmentLevels: avg(
    reports.map((report) => report.totals.developmentLevels),
  ),
  territoryGini:
    reports.reduce(
      (sum, report) => sum + report.concentration.territoryGini,
      0,
    ) / reports.length,
  propertyGini:
    reports.reduce(
      (sum, report) => sum + report.concentration.propertyGini,
      0,
    ) / reports.length,
});
