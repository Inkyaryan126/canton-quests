import {
  collectGridReleaseCandidate,
  renderReleaseCandidateText,
} from '../lib/grid/ops/release-candidate';

interface CliArgs {
  json: boolean;
  check: boolean;
  skipBuild: boolean;
  integrationRef?: string;
  worktree?: string;
  help: boolean;
}

function parseCliArgs(args: string[]): CliArgs {
  let json = false;
  let check = false;
  let skipBuild = false;
  let integrationRef: string | undefined;
  let worktree: string | undefined;
  let help = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--check') {
      check = true;
    } else if (arg === '--skip-build') {
      skipBuild = true;
    } else if (arg === '--integration-ref') {
      integrationRef = args[i + 1];
      if (!integrationRef) throw new Error('--integration-ref requires a value');
      i += 1;
    } else if (arg === '--worktree') {
      worktree = args[i + 1];
      if (!worktree) throw new Error('--worktree requires a directory path');
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else {
      throw new Error(`Unknown option: ${arg}. Use --help for usage.`);
    }
  }

  return { json, check, skipBuild, integrationRef, worktree, help };
}

function printHelp(): void {
  const text = `
The Grid — Release Candidate Manifest

Usage:
  node scripts/grid-release-candidate.ts [options]

Options:
  --json                 Output complete manifest as structured JSON.
  --check                Exit with code 1 if status is not READY_FOR_HUMAN_RELEASE_DECISION.
  --integration-ref REF  Specify integration branch or ref to evaluate.
  --worktree PATH        Specify target worktree directory (defaults to current working directory).
  --skip-build           Model the release-gate plan without requiring the production build step.
  --help, -h             Show this help message.

Safety:
  This script is strictly read-only. It inspects local Git history, Master Board,
  Control Tower claims, and pure evaluator APIs without deploying, mutating files,
  or modifying environment variables or databases.
`;
  process.stdout.write(text.trim() + '\n');
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const manifest = collectGridReleaseCandidate({
    cwd: args.worktree ?? process.cwd(),
    integrationRef: args.integrationRef,
    skipBuild: args.skipBuild,
  });

  if (args.json) {
    process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
  } else {
    process.stdout.write(renderReleaseCandidateText(manifest));
  }

  if (args.check && manifest.status !== 'READY_FOR_HUMAN_RELEASE_DECISION') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`GRID RELEASE CANDIDATE ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
