import { spawnSync } from 'node:child_process';
import { writeGridReleaseGateEvidence } from '../lib/grid/ops/release-gate-evidence';

interface CommandStep {
  id: string;
  label: string;
  kind: 'command';
  command: string;
  env?: {
    NODE_ENV: 'production';
  };
}

interface DiagnosticStep {
  id: string;
  label: string;
  kind: 'diagnostics';
}

interface PlayableLoopStep {
  id: string;
  label: string;
  kind: 'playable-loop';
}

type ReleaseGateStep = CommandStep | DiagnosticStep | PlayableLoopStep;

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
      id: 'playable-loop',
      label: 'Playable-loop evidence safety check',
      kind: 'playable-loop',
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
      env: { NODE_ENV: 'production' },
    });
  }

  return steps;
}

function runCommand(command: string, env: NodeJS.ProcessEnv = process.env): void {
  const result = spawnSync(command, {
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
    env,
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

async function runPlayableLoopCheck(): Promise<void> {
  const { collectGridMasterBoard } = await import('../lib/grid/master-board/collect');
  const { collectPlayableLoopScore } = await import('../lib/grid/ops/playable-loop-score');
  const score = collectPlayableLoopScore({
    cwd: process.cwd(),
    board: collectGridMasterBoard({ cwd: process.cwd(), includeHygiene: true }),
  });

  console.log(
    JSON.stringify(
      {
        score: score.score,
        status: score.status,
        integrationRef: score.integrationRef,
        highestValueBrokenLink: score.highestValueBrokenLink,
      },
      null,
      2,
    ),
  );

  if (score.status === 'RED') {
    throw new Error(
      'Playable-loop evidence contains a RED stage: ' +
        (score.highestValueBrokenLink?.title ?? 'unknown broken link') +
        '.',
    );
  }
}

async function main(): Promise<void> {
  const skipBuild = hasFlag('--skip-build');
  const planOnly = hasFlag('--plan');
  const shouldRecord = hasFlag('--record');
  const steps = releaseGateSteps(skipBuild);

  if (shouldRecord && skipBuild) {
    throw new Error('Release-gate evidence requires the production build. Remove --skip-build before using --record.');
  }
  if (shouldRecord && planOnly) {
    throw new Error('Release-gate evidence cannot be recorded from --plan output.');
  }

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

  const completedSteps: string[] = [];
  let currentStep: string | undefined;

  try {
    assertCleanWorktree();

    for (const [index, step] of steps.entries()) {
      currentStep = step.id;
      console.log('\n[' + String(index + 1) + '/' + String(steps.length) + '] ' + step.label);
      if (step.kind === 'diagnostics') {
        await runDiagnostics();
      } else if (step.kind === 'playable-loop') {
        await runPlayableLoopCheck();
      } else {
        runCommand(step.command, step.env ? { ...process.env, ...step.env } : process.env);
      }
      completedSteps.push(step.id);
    }

    assertCleanWorktree();
    if (shouldRecord) {
      const evidence = writeGridReleaseGateEvidence({
        passed: true,
        buildIncluded: !skipBuild,
        completedSteps,
      });
      console.log('Release-gate evidence recorded for commit: ' + evidence.integrationCommit.slice(0, 12));
    }
    console.log('\nGRID RELEASE GATE: PASS');
  } catch (error) {
    if (shouldRecord) {
      try {
        writeGridReleaseGateEvidence({
          passed: false,
          buildIncluded: !skipBuild,
          completedSteps,
          failedStep: currentStep,
        });
      } catch {
        console.error('Release-gate failure evidence could not be recorded.');
      }
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(
    'GRID RELEASE GATE: FAIL — ' + (error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
});
