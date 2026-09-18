import { spawnSync } from 'node:child_process';

interface CommandStep {
  id: string;
  label: string;
  kind: 'command';
  command: string;
}

interface DiagnosticStep {
  id: string;
  label: string;
  kind: 'diagnostics';
}

type ReleaseGateStep = CommandStep | DiagnosticStep;

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function releaseGateSteps(skipBuild: boolean): ReleaseGateStep[] {
  const steps: ReleaseGateStep[] = [
    {
      id: 'coordination',
      label: 'Control Tower coordination preflight',
      kind: 'command',
      command: 'npm run grid:agents -- check',
    },
    {
      id: 'diagnostics',
      label: 'Grid launch diagnostics',
      kind: 'diagnostics',
    },
    {
      id: 'integration-tests',
      label: 'Integration, security, and deterministic season tests',
      kind: 'command',
      command:
        './node_modules/.bin/vitest run tests/grid-integration-journey.test.ts tests/grid-integration-security.test.ts tests/grid-season-simulation.test.ts',
    },
    {
      id: 'typecheck',
      label: 'TypeScript typecheck',
      kind: 'command',
      command: './node_modules/.bin/tsc --noEmit',
    },
    {
      id: 'lint',
      label: 'Next.js lint',
      kind: 'command',
      command: 'npm run lint',
    },
    {
      id: 'diff-check',
      label: 'Git whitespace/conflict-marker check',
      kind: 'command',
      command: 'git diff --check HEAD',
    },
  ];

  if (!skipBuild) {
    steps.push({
      id: 'build',
      label: 'Production Next.js build',
      kind: 'command',
      command: 'npm run build',
    });
  }

  return steps;
}

function runCommand(command: string): void {
  const result = spawnSync(command, {
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error('Command failed (' + String(result.status ?? 'unknown') + '): ' + command);
  }
}

function assertCleanWorktree(): void {
  const result = spawnSync('git status --porcelain', {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error('Unable to inspect Git worktree status.');
  }
  if (result.stdout.trim().length > 0) {
    throw new Error('Release gate requires a clean worktree. Commit or reconcile changes first.');
  }
}

async function runDiagnostics(): Promise<void> {
  const { executeGridLaunchVerification } = await import('./grid-integration-verify');
  const report = await executeGridLaunchVerification(process.cwd());
  console.log(
    JSON.stringify(
      {
        readyForIntegration: report.readyForIntegration,
        activeClaimsCount: report.activeClaimsCount,
        blockedLanes: report.blockedLanes,
        summary: report.summary,
      },
      null,
      2,
    ),
  );

  if (!report.readyForIntegration || report.summary.REAL_REGRESSION > 0) {
    throw new Error(
      'Grid launch diagnostics failed with ' +
        String(report.summary.REAL_REGRESSION) +
        ' real regression(s).',
    );
  }
}

async function main(): Promise<void> {
  const skipBuild = hasFlag('--skip-build');
  const planOnly = hasFlag('--plan');
  const steps = releaseGateSteps(skipBuild);

  if (planOnly) {
    console.log(
      JSON.stringify(
        {
          cleanWorktreeRequired: true,
          skipBuild,
          steps,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log('# GRID RELEASE GATE');
  console.log('Worktree: ' + process.cwd());
  console.log('Production build: ' + (skipBuild ? 'SKIPPED BY FLAG' : 'REQUIRED'));

  assertCleanWorktree();

  for (const [index, step] of steps.entries()) {
    console.log('\n[' + String(index + 1) + '/' + String(steps.length) + '] ' + step.label);
    if (step.kind === 'diagnostics') {
      await runDiagnostics();
    } else {
      runCommand(step.command);
    }
  }

  assertCleanWorktree();
  console.log('\nGRID RELEASE GATE: PASS');
}

main().catch((error) => {
  console.error(
    'GRID RELEASE GATE: FAIL — ' + (error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
});
