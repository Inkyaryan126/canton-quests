/**
 * Canton Quests Boardroom V2 — startup bootstrap.
 *
 * Starting from `main` is the *normal* case (Dustin launches boardroom:start
 * from whatever branch he's on). This module runs the ordered bootstrap
 * sequence and guarantees no agent task executes and no autonomous commit
 * happens until every step has verifiably succeeded.
 */
import { execFileSync } from 'child_process';
import crypto from 'crypto';

export interface GitRunner {
  run(args: string[]): string;
}

/** Real git runner — a thin wrapper so tests can inject a fake one instead of touching the real repo. */
export const realGit: GitRunner = {
  run(args: string[]): string {
    return execFileSync('git', args, { encoding: 'utf8', cwd: process.cwd() });
  },
};

export interface BootstrapResult {
  ok: boolean;
  runId: string;
  branch?: string;
  baseCommit?: string;
  failedStep?: string;
  message: string;
}

export function generateRunId(): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  return `${stamp}-${crypto.randomBytes(2).toString('hex')}`;
}

export interface BootstrapOptions {
  git?: GitRunner;
  /** Escape hatch for rare manual use — bypasses branch creation and allows running on the current branch (including main). */
  overrideBranchCheck?: boolean;
  overrideConfirmed?: boolean;
  /** Resume a specific existing branch instead of creating a new one (still requires the double-flag override). */
  branchOverrideName?: string;
  runId?: string;
}

/**
 * The ordered bootstrap sequence (Section: "Overnight branch"):
 *   1. working tree must be clean
 *   2. record the base commit
 *   3. create boardroom/astra-overnight-<runId> from that base commit
 *      (never the bare fixed name, never touching a prior run's branch)
 *   4. verify the checkout landed on the new branch
 *
 * Any failed step stops here — the caller must not proceed to running
 * tasks or committing. The override path (both flags required) skips
 * steps 3-4's branch creation and permits staying on the current branch.
 */
export function bootstrap(opts: BootstrapOptions = {}): BootstrapResult {
  const git = opts.git ?? realGit;
  const runId = opts.runId ?? generateRunId();

  if (opts.overrideBranchCheck) {
    if (!opts.overrideConfirmed) {
      return {
        ok: false,
        runId,
        failedStep: 'override-confirmation',
        message: '--override-branch-check requires --i-understand-this-runs-on-main to also be set. Refusing to proceed.',
      };
    }
    const currentBranch = safeRun(git, ['branch', '--show-current']);
    const baseCommit = safeRun(git, ['rev-parse', 'HEAD']);
    return {
      ok: true,
      runId,
      branch: opts.branchOverrideName || currentBranch || 'HEAD (detached)',
      baseCommit,
      message: `Override in effect: running on "${currentBranch}" without creating an overnight branch. This was an explicit, double-confirmed manual choice.`,
    };
  }

  // Step 1: working tree must be clean.
  const status = safeRun(git, ['status', '--porcelain']);
  if (status.trim().length > 0) {
    return {
      ok: false,
      runId,
      failedStep: 'clean-working-tree',
      message: 'Working tree has uncommitted changes. Boardroom will not switch branches or stash/discard anything automatically. Commit or clean up first.',
    };
  }

  // Step 2: record the base commit.
  const baseCommit = safeRun(git, ['rev-parse', 'HEAD']);
  if (!baseCommit) {
    return { ok: false, runId, failedStep: 'record-base-commit', message: 'Could not determine HEAD commit.' };
  }

  // Step 3: create a fresh, unique overnight branch from that base commit.
  const branchName = `boardroom/astra-overnight-${runId}`;
  try {
    git.run(['checkout', '-b', branchName, baseCommit]);
  } catch (err: any) {
    return {
      ok: false,
      runId,
      baseCommit,
      failedStep: 'create-branch',
      message: `Failed to create ${branchName}: ${err?.message || err}`,
    };
  }

  // Step 4: verify the checkout actually landed on the new branch.
  const landedOn = safeRun(git, ['branch', '--show-current']);
  if (landedOn !== branchName) {
    return {
      ok: false,
      runId,
      baseCommit,
      failedStep: 'verify-checkout',
      message: `Expected to be on ${branchName} after checkout but found "${landedOn}". Stopping — will not run on an unexpected branch.`,
    };
  }

  return {
    ok: true,
    runId,
    branch: branchName,
    baseCommit,
    message: `Bootstrap succeeded: created ${branchName} from ${baseCommit}.`,
  };
}

function safeRun(git: GitRunner, args: string[]): string {
  try {
    return git.run(args).trim();
  } catch {
    return '';
  }
}

/**
 * "No worktrees" guard: `git worktree list` should show exactly one entry
 * (the main tree Boardroom itself is running from). Cannot physically stop
 * another CLI from creating one, but this catches it before an autonomous
 * run proceeds on top of an unexpected multi-worktree state.
 */
export function assertNoExtraWorktrees(git: GitRunner = realGit): { ok: boolean; worktrees: string[] } {
  const output = safeRun(git, ['worktree', 'list']);
  const lines = output.split('\n').filter(Boolean);
  return { ok: lines.length <= 1, worktrees: lines };
}
