import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { evaluateChangedPaths } from '../lib/boardroom/commitGate';
import { salvageWorkingTree } from '../lib/boardroom/salvage';
import { runSupervisor, type GitOps } from '../lib/boardroom/supervisor';
import { createTask, getTask } from '../lib/boardroom/tasks';

let repoDir: string;
let wrapperDir: string;

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' });
}

function gitOps(): GitOps {
  return { run: git };
}

function script(name: string, body: string): string {
  const p = path.join(wrapperDir, name);
  fs.writeFileSync(p, `#!/bin/sh\nset -eu\n${body}\n`, { mode: 0o755 });
  return p;
}

beforeEach(() => {
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-extra-hardening-'));
  wrapperDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-extra-wrappers-'));

  execFileSync('git', ['init', '-q'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.email', 'boardroom-test@example.com'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.name', 'Boardroom Test'], { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'init\n');
  fs.writeFileSync(path.join(repoDir, '.gitignore'), '.boardroom/\nboardroom/\n');
  git(['add', 'README.md', '.gitignore']);
  git(['commit', '-q', '-m', 'init']);
});

afterEach(() => {
  fs.rmSync(repoDir, { recursive: true, force: true });
  fs.rmSync(wrapperDir, { recursive: true, force: true });
});

describe('REGRESSION (second overnight run): brand-new scope directory vs exact-staging verification', () => {
  it('does not falsely fail EXACT_STAGING_VERIFICATION when an agent writes the first-ever file into a never-before-tracked scope directory', async () => {
    // Reproduces exactly what happened to TASK-20260906-060642-jq1v on run
    // 20260906-135634-ab4a: `git status --short` (without --untracked-files=all)
    // collapses a wholly-new, never-before-tracked directory into a single
    // directory-level entry ("?? lib/motion/") instead of listing the real
    // file inside it. That bare directory string then becomes the "approved"
    // path, while `git add`/`git diff --cached` (which never collapse) report
    // the real file — a false mismatch between two different string
    // representations of the exact same, entirely-in-scope content.
    //
    // `lib/` itself must already be a known, tracked directory (as it always
    // is in the real repo) so that ONLY `lib/motion/` collapses — otherwise
    // git collapses all the way up to the shallowest wholly-untracked
    // ancestor (`lib/` itself here), which produces a plain out-of-scope
    // BLOCK instead of exercising the exact-staging-verification path.
    fs.mkdirSync(path.join(repoDir, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'lib', 'existing.ts'), 'export const already = true;\n');
    git(['add', 'lib/existing.ts']);
    git(['commit', '-q', '-m', 'lib/ already exists and is tracked']);

    const task = createTask({
      title: 'First write into a brand-new scope directory',
      goal: 'lib/motion/ does not exist yet anywhere in this repo',
      priority: 'HIGH',
      phase: 'PHASE_2_CORE_EXPERIENCE_SYSTEM',
      primaryAgent: 'AGY',
      writeScope: ['lib/motion/'],
      testsRequired: [],
      root: repoDir,
    });

    const agy = script('agy-newdir.sh', `mkdir -p lib/motion\nprintf 'export const tokens = {};\n' > lib/motion/tokens.ts`);

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { AGY: agy },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 5,
      perTaskTimeoutMs: 5_000,
    });

    expect(result.stopReason).toBe('NO_MORE_READY_TASKS');
    const updated = getTask(task.taskId, repoDir)!;
    expect(updated.status).toBe('DONE');
    expect(updated.currentCommit).toBeTruthy();
    expect(fs.existsSync(path.join(repoDir, 'lib/motion/tokens.ts'))).toBe(true);

    const committedFiles = git(['show', '--name-only', '--pretty=format:', updated.currentCommit!]).trim();
    expect(committedFiles).toBe('lib/motion/tokens.ts');
    expect(git(['status', '--short']).trim()).toBe('');
  });
});

describe('extra write-scope hardening', () => {
  it('does not authorize a sibling path merely because it shares a string prefix', () => {
    expect(evaluateChangedPaths(['lib/board'], ['lib/boardroom/x.ts']).decision).toBe('BLOCK');
    expect(evaluateChangedPaths(['components/QuestCard.tsx'], ['components/QuestCard.tsx.bak']).decision).toBe('BLOCK');
    expect(evaluateChangedPaths(['lib/boardroom'], ['lib/boardroom/tasks.ts']).decision).toBe('COMMIT');
  });
});

describe('salvage identity verification', () => {
  it('refuses to reuse a pre-existing stash when the requested path has nothing new to salvage', () => {
    fs.writeFileSync(path.join(repoDir, 'old-wip.txt'), 'old\n');
    git(['stash', 'push', '-u', '-m', 'old-wip']);
    const previous = git(['rev-parse', 'stash@{0}']).trim();

    expect(() =>
      salvageWorkingTree(gitOps(), {
        taskId: 'TASK-CLEAN',
        agent: 'AGY',
        attempt: 1,
        runId: 'RUN-CLEAN',
        paths: ['README.md'],
        reason: 'should not reuse old stash',
      })
    ).toThrow();

    expect(git(['rev-parse', 'stash@{0}']).trim()).toBe(previous);
  });
});

describe('phase barrier', () => {
  it('does not advance into a later phase when an earlier run-queue phase is blocked', async () => {
    const phase1 = createTask({
      title: 'Recon must finish first',
      goal: 'Stay in scope',
      priority: 'HIGH',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'AGY',
      writeScope: ['allowed.txt'],
      testsRequired: [],
      root: repoDir,
    });
    const phase2 = createTask({
      title: 'Core system must wait',
      goal: 'Do not run while Phase 1 is blocked',
      priority: 'HIGH',
      phase: 'PHASE_2_CORE_EXPERIENCE_SYSTEM',
      primaryAgent: 'CLAUDE',
      writeScope: ['phase2.txt'],
      testsRequired: [],
      root: repoDir,
    });

    const agy = script('agy-oob.sh', `printf 'oops\n' > out-of-scope.txt`);
    const claude = script('claude-should-not-run.sh', `printf 'should-not-run\n' > phase2.txt`);

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { AGY: agy, CLAUDE: claude },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 10,
      perTaskTimeoutMs: 5_000,
    });

    expect(result.stopReason).toBe('PHASE_BARRIER_BLOCKED');
    expect(getTask(phase1.taskId, repoDir)?.status).toBe('BLOCKED');
    expect(getTask(phase2.taskId, repoDir)?.status).toBe('QUEUED');
    expect(fs.existsSync(path.join(repoDir, 'phase2.txt'))).toBe(false);
    expect(git(['status', '--short']).trim()).toBe('');
  });
});

describe('git-history guard', () => {
  it('stops immediately if an agent commits or otherwise moves HEAD', async () => {
    createTask({
      title: 'Agent must not commit',
      goal: 'Boardroom owns commits',
      priority: 'HIGH',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'AGY',
      writeScope: ['agent-owned.txt'],
      testsRequired: [],
      root: repoDir,
    });

    const agy = script(
      'agy-commits.sh',
      `printf 'agent commit\n' > agent-owned.txt\ngit add agent-owned.txt\ngit commit -q -m 'agent illegally committed'`
    );

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { AGY: agy },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 5,
      perTaskTimeoutMs: 5_000,
    });

    expect(result.stopReason).toBe('AGENT_MUTATED_GIT_HISTORY');
    expect(result.actionsRequired.join(' ')).toMatch(/changed git history/i);
  });
});

describe('agent-staged-file quarantine', () => {
  it('quarantines the task and fails over to a fallback agent when an agent stages files without committing', async () => {
    const task = createTask({
      title: 'Agent must not stage its own work',
      goal: 'Boardroom owns staging and commits',
      priority: 'HIGH',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'AGY',
      fallbackAgent1: 'CLAUDE',
      fallbackAgent2: 'ASTRA',
      writeScope: ['staged-owned.txt'],
      testsRequired: [],
      root: repoDir,
    });

    // Stages but deliberately does NOT commit and does NOT move HEAD —
    // distinct from the git-history-guard scenario above.
    const agy = script('agy-stages.sh', `printf 'agent staged this\n' > staged-owned.txt\ngit add staged-owned.txt`);
    const claude = script('claude-fallback.sh', `printf 'fixed properly\n' > staged-owned.txt`);

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { AGY: agy, CLAUDE: claude },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 10,
      perTaskTimeoutMs: 5_000,
    });

    const updated = getTask(task.taskId, repoDir)!;
    expect(updated.status).toBe('DONE');
    expect(updated.attempts.some((a) => a.agent === 'AGY' && a.outcome === 'FAILED' && /staged files/i.test(a.approachSummary))).toBe(true);
    expect(updated.attempts.some((a) => a.agent === 'CLAUDE' && a.outcome === 'SUCCEEDED')).toBe(true);
    // AGY's staged-but-uncommitted work was salvaged, not silently discarded
    // or accidentally committed under Boardroom's name.
    expect(updated.salvage.length).toBeGreaterThanOrEqual(1);
    expect(git(['status', '--short']).trim()).toBe('');
    expect(fs.readFileSync(path.join(repoDir, 'staged-owned.txt'), 'utf8')).toBe('fixed properly\n');
  });
});

describe('exact staged-set verification', () => {
  it('refuses to commit when the actual git index contains a path Boardroom did not approve', async () => {
    createTask({
      title: 'Only note.txt is approved',
      goal: 'Boardroom must stage exactly what it approved',
      priority: 'HIGH',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'AGY',
      writeScope: ['note.txt'],
      testsRequired: [],
      root: repoDir,
    });

    const agy = script('agy-ok.sh', `printf 'note\n' > note.txt`);

    // Simulates something outside Boardroom's own bookkeeping getting into
    // the git index at exactly the moment Boardroom stages its approved
    // paths (e.g. a stray concurrent process) — not something a well-behaved
    // agent would do on its own (that's the out-of-scope BLOCK path, already
    // covered elsewhere), and the file must not exist before bootstrap's own
    // clean-tree check runs, so it's created lazily inside the 'add' hook.
    const instrumentedGit: GitOps = {
      run(args: string[]): string {
        const result = git(args);
        if (args[0] === 'add') {
          try {
            fs.writeFileSync(path.join(repoDir, 'unexpected.txt'), 'sneaked in\n');
            git(['add', '--', 'unexpected.txt']);
          } catch {
            /* ignore if already staged */
          }
        }
        return result;
      },
    };

    const result = await runSupervisor({
      root: repoDir,
      git: instrumentedGit,
      binaryOverrides: { AGY: agy },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 5,
      perTaskTimeoutMs: 5_000,
    });

    expect(result.stopReason).toBe('EXACT_STAGING_VERIFICATION_FAILED');
    // Nothing was committed under Boardroom's name with the extra file smuggled in.
    expect(git(['log', '--oneline']).split('\n').filter(Boolean)).toHaveLength(1); // init only
  });
});

describe('post-commit clean invariant', () => {
  it('stops if the source worktree is unexpectedly dirty immediately after Boardroom commits', async () => {
    createTask({
      title: 'Tree must be clean after commit',
      goal: 'Post-commit invariant',
      priority: 'HIGH',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'AGY',
      writeScope: ['note.txt'],
      testsRequired: [],
      root: repoDir,
    });

    const agy = script('agy-ok.sh', `printf 'note\n' > note.txt`);

    // Simulates something dirtying the tree at exactly the moment Boardroom
    // finishes its own commit — e.g. a stray concurrent process — by piggy-
    // backing on the commit git call itself.
    const instrumentedGit: GitOps = {
      run(args: string[]): string {
        const result = git(args);
        if (args[0] === 'commit') {
          fs.writeFileSync(path.join(repoDir, 'post-commit-stray.txt'), 'stray\n');
        }
        return result;
      },
    };

    const result = await runSupervisor({
      root: repoDir,
      git: instrumentedGit,
      binaryOverrides: { AGY: agy },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 5,
      perTaskTimeoutMs: 5_000,
    });

    expect(result.stopReason).toBe('POST_COMMIT_DIRTY_WORKTREE');
    // The real task commit still landed (this invariant is a post-commit
    // safety check, not a pre-commit gate) — it just refuses to continue
    // dispatching more agents onto an unexpectedly dirty tree.
    expect(git(['log', '--oneline']).split('\n').filter(Boolean)).toHaveLength(2);
  });
});

describe('Astra exhaustion failover and reset conservation', () => {
  it('fails over the task after probe-confirmed Astra exhaustion without immediately asking for reset #1', async () => {
    const task = createTask({
      title: 'Fallback can finish',
      goal: 'Do not spend Astra reset if Claude can finish',
      priority: 'HIGH',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'ASTRA',
      fallbackAgent1: 'CLAUDE',
      fallbackAgent2: 'AGY',
      writeScope: ['fix.txt'],
      testsRequired: [],
      root: repoDir,
    });

    const astra = script('astra-exhausted.sh', `printf 'Error: usage limit reached for this account\n' >&2\nexit 1`);
    const claude = script('claude-fallback.sh', `printf 'fixed\n' > fix.txt`);

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { ASTRA: astra, CLAUDE: claude },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 10,
      perTaskTimeoutMs: 5_000,
    });

    expect(getTask(task.taskId, repoDir)?.status).toBe('DONE');
    expect(getTask(task.taskId, repoDir)?.attempts.some((a) => a.agent === 'CLAUDE' && a.outcome === 'SUCCEEDED')).toBe(true);
    expect(result.actionsRequired.join(' ')).not.toContain('ASTRA RESET CREDIT #1');
  });

  it('requests the reset at the protected final-integration barrier if Astra is still unavailable', async () => {
    createTask({
      title: 'Warmup task',
      goal: 'Force Astra exhaustion, then let Claude finish',
      priority: 'HIGH',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'ASTRA',
      fallbackAgent1: 'CLAUDE',
      fallbackAgent2: 'AGY',
      writeScope: ['warmup.txt'],
      testsRequired: [],
      root: repoDir,
    });
    const finalTask = createTask({
      title: 'Protected final Astra pass',
      goal: 'Must wait for Astra',
      priority: 'LOW',
      phase: 'PHASE_6_ASTRA_FINAL_PASS',
      primaryAgent: 'ASTRA',
      fallbackAgent1: 'CLAUDE',
      fallbackAgent2: 'AGY',
      writeScope: ['final.txt'],
      testsRequired: [],
      root: repoDir,
    });

    const astra = script('astra-exhausted-final.sh', `printf 'Error: usage limit reached for this account\n' >&2\nexit 1`);
    const claude = script('claude-warmup.sh', `printf 'warm\n' > warmup.txt`);

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { ASTRA: astra, CLAUDE: claude },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 10,
      perTaskTimeoutMs: 5_000,
    });

    expect(result.stopReason).toBe('ASTRA_RESET_REQUIRED_FOR_FINAL_INTEGRATION');
    expect(result.actionsRequired.join(' ')).toContain('ASTRA RESET CREDIT #1');
    expect(getTask(finalTask.taskId, repoDir)?.status).toBe('QUEUED');
  });
});
