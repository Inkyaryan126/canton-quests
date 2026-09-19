import {
  evaluateGridMigrationSafety,
  renderMigrationSafetyReportText,
  writeMigrationSafetyEvidence,
} from '../lib/grid/ops/migration-safety';

function value(args: string[], name: string): string | undefined {
  const index = args.indexOf('--' + name);
  return index === -1 ? undefined : args[index + 1];
}

function main(): void {
  const args = process.argv.slice(2);
  const report = evaluateGridMigrationSafety({
    cwd: process.cwd(),
    baseRef: value(args, 'base-ref'),
  });
  const evidence = args.includes('--record')
    ? writeMigrationSafetyEvidence(report, process.cwd())
    : null;

  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(evidence ? { report, evidence } : report, null, 2) + '\n');
  } else {
    process.stdout.write(renderMigrationSafetyReportText(report));
    if (evidence) process.stdout.write(`Evidence recorded for commit: ${evidence.integrationCommit.slice(0, 12)}\n`);
  }

  if (report.status === 'REVIEW') process.exitCode = 1;
  if (report.status === 'BLOCKED') process.exitCode = 2;
}

try {
  main();
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
}
