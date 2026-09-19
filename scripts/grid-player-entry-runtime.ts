import {
  runtimeEvidenceFromGridPlayerEntryReport,
  verifyGridPlayerEntryRuntime,
} from '../lib/grid/ops/player-entry-runtime';

async function main(): Promise<void> {
  const json = process.argv.slice(2).includes('--json');
  const report = await verifyGridPlayerEntryRuntime({ cwd: process.cwd() });
  const evidence = runtimeEvidenceFromGridPlayerEntryReport(report);

  if (json) {
    process.stdout.write(`${JSON.stringify({ report, evidence }, null, 2)}\n`);
    return;
  }

  console.log('# GRID PLAYER ENTRY RUNTIME');
  console.log(`Verified: ${report.verifiedAt}`);
  for (const item of report.cases) {
    console.log(
      `${item.mode}: ${item.status} -> ${item.destination} (${item.destinationStatus})`,
    );
  }
  console.log('Status: GREEN — real Next runtime entry redirects verified.');
}

main().catch((error) => {
  console.error(
    'GRID PLAYER ENTRY RUNTIME: FAIL — ' +
      (error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
});
