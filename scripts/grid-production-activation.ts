import { spawnSync } from 'node:child_process';
import { collectGridMasterBoard } from '../lib/grid/master-board/collect';
import {
  evaluateGridProductionActivation,
  GRID_PRODUCTION_RELEASE_GATE_COMMAND,
  GRID_PRODUCTION_REQUIRED_OFF_FLAGS,
  GRID_PRODUCTION_REQUIRED_ON_FLAGS,
  GRID_PRODUCTION_REQUIRED_SECRETS,
} from '../lib/grid/operations/production-activation';

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function isCleanWorktree(cwd: string): boolean {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error('Unable to inspect Git worktree status.');
  }
  return result.stdout.trim().length === 0;
}

function plan() {
  return {
    mutatesProduction: false,
    requiredOnFlags: GRID_PRODUCTION_REQUIRED_ON_FLAGS,
    requiredOffFlags: GRID_PRODUCTION_REQUIRED_OFF_FLAGS,
    requiredSecrets: GRID_PRODUCTION_REQUIRED_SECRETS.map((key) => ({
      key,
      minimumUtf8Bytes: 32,
    })),
    finalVerificationCommand: GRID_PRODUCTION_RELEASE_GATE_COMMAND,
    note:
      'This command never deploys, changes Vercel variables, or applies Supabase migrations. It only evaluates activation readiness.',
  };
}

function printHuman(report: ReturnType<typeof evaluateGridProductionActivation>): void {
  console.log('# GRID CANTON PRODUCTION ACTIVATION PREFLIGHT');
  console.log(`Integration: ${report.integrationRef ?? 'missing'} @ ${report.integrationCommit ?? 'missing'}`);
  console.log(`Status: ${report.status}`);

  if (report.blockers.length > 0) {
    console.log('\nBlockers:');
    for (const item of report.blockers) {
      console.log(`- [${item.kind}] ${item.key}: ${item.detail}`);
    }
  }

  console.log(`\nFinal verification after preflight: ${report.releaseGateCommand}`);
  if (report.readyForReleaseGate) {
    console.log('Preflight is clean. Run the release gate before any production promotion.');
  } else {
    console.log('Production promotion remains blocked until every blocker is resolved.');
  }
}

async function main(): Promise<void> {
  if (hasFlag('--plan')) {
    console.log(JSON.stringify(plan(), null, 2));
    return;
  }

  const cwd = process.cwd();
  const integrationRef = argumentValue('--integration-ref');
  const board = collectGridMasterBoard({
    cwd,
    integrationRef,
    includeHygiene: true,
  });
  const report = evaluateGridProductionActivation({
    board,
    env: process.env,
    cleanWorktree: isCleanWorktree(cwd),
  });

  if (hasFlag('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }

  process.exitCode = report.readyForReleaseGate ? 0 : 1;
}

main().catch((error) => {
  console.error(
    'GRID PRODUCTION ACTIVATION PREFLIGHT: FAIL — ' +
      (error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
});
