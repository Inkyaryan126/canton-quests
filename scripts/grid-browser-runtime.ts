import { verifyGridBrowserRuntime } from '../lib/grid/ops/browser-runtime-verification';

async function main(): Promise<void> {
  const json = process.argv.slice(2).includes('--json');
  const report = await verifyGridBrowserRuntime({ cwd: process.cwd() });

  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log('# GRID BROWSER RUNTIME VERIFICATION');
    console.log(`Status: ${report.status}`);
    console.log(`Verified: ${report.verifiedAt}`);
    console.log(`Browser: ${report.browser?.kind ?? 'unavailable'}`);
    for (const item of report.cases) {
      console.log(
        `${item.name}: ${item.httpStatus ?? 'n/a'} ${item.requestedPath} -> ${item.finalPath ?? 'n/a'}; ` +
          `heading=${item.heading ?? 'n/a'} consoleErrors=${item.consoleErrors.length} ` +
          `pageErrors=${item.pageErrors.length} overlays=${item.overlayCount} ` +
          `viewport=${item.viewport.width}x${item.viewport.height}`,
      );
      if (item.error) console.log(`  error: ${item.error}`);
    }
    for (const reason of report.skippedReasons) console.log(`Reason: ${reason}`);
    console.log(`Server cleanup: ${report.serverCleanup.completed ? 'complete' : 'incomplete'}`);
  }

  if (report.status !== 'VERIFIED') process.exitCode = report.status === 'SKIPPED' ? 2 : 1;
}

main().catch((error) => {
  console.error(
    'GRID BROWSER RUNTIME VERIFICATION: FAIL — ' +
      (error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
});
